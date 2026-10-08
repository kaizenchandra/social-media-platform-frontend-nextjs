import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { createDevelopmentAuthAdapter } from "@/lib/auth/mock-adapter";
import { resolveAuthMode } from "@/lib/auth/config";
import {
  commands,
  safeReturnTo,
  type AuthCommand,
} from "@/features/auth/validation";
import { previewHints } from "@/features/auth/contracts";
import type { AuthContext } from "@/lib/auth/adapter";
const mock = () =>
  createDevelopmentAuthAdapter({ nodeEnv: "development", mode: "mock" });
const context = (): AuthContext => ({ browserId: randomUUID() });
const login: AuthCommand = {
  operation: "login",
  email: previewHints.email,
  password: previewHints.password,
};

describe("Authentication contracts and development authority", () => {
  it("fails closed unless explicit development mock mode is selected", () => {
    expect(resolveAuthMode("production", "mock")).toBe("unavailable");
    expect(resolveAuthMode("development", undefined)).toBe("unavailable");
    expect(resolveAuthMode("development", "mock")).toBe("mock");
    expect(() =>
      createDevelopmentAuthAdapter({ nodeEnv: "production", mode: "mock" }),
    ).toThrow();
  });
  it("grants the verified dummy account a session and rejects incorrect passwords", async () => {
    const adapter = mock();
    const command = commands.parse({
      operation: "login",
      email: previewHints.username,
      password: previewHints.password,
      returnTo: "/creator",
    });
    if (command.operation !== "login")
      throw new Error("Expected login command");
    const result = await adapter.execute(command, context(), randomUUID());
    expect(result.outcome.ok).toBe(true);
    expect(result.outcome.ok && result.outcome.next).toBe("/creator");
    const account = await adapter.account(result.sessionToken);
    expect(account?.profile.id).toBe(previewHints.accountId);
    expect(account?.profile.onboarded).toBe(true);
    expect(
      (
        await adapter.execute(
          { ...command, password: "incorrect" },
          context(),
          randomUUID(),
        )
      ).outcome.ok,
    ).toBe(false);
  });
  it("validates passwords, matching confirmation and onboarding identifiers", () => {
    expect(
      commands.safeParse({
        operation: "register",
        displayName: "A",
        email: "not-an-email",
        password: "short",
        confirmPassword: "different",
        consent: false,
      }).success,
    ).toBe(false);
    expect(
      commands.safeParse({
        operation: "onboarding",
        displayName: "A",
        username: "INVALID!",
        bio: "",
      }).success,
    ).toBe(false);
    expect(safeReturnTo("https://attacker.test")).toBe("/account");
    expect(safeReturnTo("//attacker.test")).toBe("/account");
    expect(safeReturnTo("/account/sessions")).toBe("/account/sessions");
  });
  it("rejects invalid credentials and synthetic network failures without a session", async () => {
    const adapter = mock();
    const actor = context();
    expect(
      (
        await adapter.execute(
          { ...login, password: "wrong" },
          actor,
          randomUUID(),
        )
      ).outcome,
    ).toMatchObject({ ok: false, error: { code: "invalid_credentials" } });
    const network = await adapter.execute(
      { ...login, email: "offline@example.test" },
      actor,
      randomUUID(),
    );
    expect(network.outcome).toMatchObject({
      ok: false,
      error: { code: "network", retryable: true },
    });
    expect(network.sessionToken).toBeUndefined();
  });
  it("requires the MFA challenge before minting a session and limits attempts", async () => {
    const adapter = mock();
    const actor = context();
    const challenge = await adapter.execute(
      { ...login, email: "mfa@example.test" },
      actor,
      randomUUID(),
    );
    expect(challenge.sessionToken).toBeUndefined();
    actor.challengeToken = challenge.challengeToken;
    for (let attempt = 0; attempt < 5; attempt++)
      expect(
        (
          await adapter.execute(
            { operation: "mfa", code: "000000" },
            actor,
            randomUUID(),
          )
        ).outcome.ok,
      ).toBe(false);
    expect(
      (
        await adapter.execute(
          { operation: "mfa", code: previewHints.verificationCode },
          actor,
          randomUUID(),
        )
      ).outcome,
    ).toMatchObject({ ok: false, error: { code: "rate_limited" } });
  });
  it("binds challenges to the browser, rejects expired challenges and does not expose unknown account existence", async () => {
    let time = 1000;
    const adapter = createDevelopmentAuthAdapter(
      { nodeEnv: "development", mode: "mock" },
      () => time,
    );
    const actor = context();
    const known = await adapter.execute(
      { operation: "forgot-password", email: previewHints.email },
      actor,
      randomUUID(),
    );
    const unknown = await adapter.execute(
      { operation: "forgot-password", email: "missing@example.test" },
      actor,
      randomUUID(),
    );
    expect(known.outcome).toEqual(unknown.outcome);
    const borrowed = await adapter.execute(
      {
        operation: "reset-password",
        code: previewHints.verificationCode,
        password: "New-preview-42!",
        confirmPassword: "New-preview-42!",
      },
      { ...context(), challengeToken: known.challengeToken },
      randomUUID(),
    );
    expect(borrowed.outcome.ok).toBe(false);
    time += 10 * 60_000 + 1;
    expect(
      (
        await adapter.execute(
          { operation: "verify-email", code: previewHints.verificationCode },
          { ...actor, challengeToken: known.challengeToken },
          randomUUID(),
        )
      ).outcome.ok,
    ).toBe(false);
  });
  it("checks ownership on reads and every account mutation", async () => {
    const adapter = mock();
    const first = context();
    const second = context();
    first.sessionToken = (
      await adapter.execute(login, first, randomUUID())
    ).sessionToken;
    second.sessionToken = (
      await adapter.execute(login, second, randomUUID())
    ).sessionToken;
    const snapshot = await adapter.account(first.sessionToken);
    expect(snapshot).not.toBeNull();
    expect(await adapter.account("forged-cookie")).toBeNull();
    const foreign = randomUUID();
    expect(
      (
        await adapter.execute(
          { operation: "revoke-session", sessionId: foreign },
          first,
          randomUUID(),
        )
      ).outcome,
    ).toMatchObject({ ok: false, error: { code: "forbidden" } });
    const rejected = await adapter.execute(
      {
        operation: "update-account",
        displayName: "Changed",
        bio: "",
        version: 1,
      },
      context(),
      randomUUID(),
    );
    expect(rejected.outcome).toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    const current = snapshot!.sessions.find((session) => session.current)!;
    await adapter.execute(
      { operation: "revoke-session", sessionId: current.id },
      first,
      randomUUID(),
    );
    expect(await adapter.account(first.sessionToken)).toBeNull();
    expect(await adapter.account(second.sessionToken)).not.toBeNull();
  });
  it("deduplicates successful submissions but rejects reused request IDs with different input", async () => {
    const adapter = mock();
    const actor = context();
    const id = randomUUID();
    const first = await adapter.execute(login, actor, id);
    const duplicate = await adapter.execute(login, actor, id);
    expect(first.sessionToken).toBe(duplicate.sessionToken);
    expect(
      (
        await adapter.execute(
          { ...login, email: "mfa@example.test" },
          actor,
          id,
        )
      ).outcome,
    ).toMatchObject({ ok: false, error: { code: "conflict" } });
  });
  it("rejects stale edits and expired sessions", async () => {
    let time = 1000;
    const adapter = createDevelopmentAuthAdapter(
      { nodeEnv: "development", mode: "mock" },
      () => time,
    );
    const actor = context();
    actor.sessionToken = (
      await adapter.execute(login, actor, randomUUID())
    ).sessionToken;
    await adapter.execute(
      {
        operation: "update-account",
        displayName: "Changed",
        bio: "",
        version: 1,
      },
      actor,
      randomUUID(),
    );
    expect(
      (
        await adapter.execute(
          {
            operation: "update-account",
            displayName: "Lost update",
            bio: "",
            version: 1,
          },
          actor,
          randomUUID(),
        )
      ).outcome,
    ).toMatchObject({ ok: false, error: { code: "conflict" } });
    time += 15 * 60_000 + 1;
    expect(await adapter.account(actor.sessionToken)).toBeNull();
    expect(
      (
        await adapter.execute(
          {
            operation: "deactivate",
            confirmation: "DEACTIVATE",
            password: previewHints.password,
          },
          actor,
          randomUUID(),
        )
      ).outcome.ok,
    ).toBe(false);
  });
});

describe("Account ownership and reset regression boundaries", () => {
  it("rejects another account’s real session ID for both trust and revocation", async () => {
    const adapter = mock();
    const first = context();
    first.sessionToken = (
      await adapter.execute(login, first, randomUUID())
    ).sessionToken;
    const second = context();
    const registration = await adapter.execute(
      {
        operation: "register",
        email: "other@example.test",
        displayName: "Other preview",
        password: previewHints.password,
        confirmPassword: previewHints.password,
        consent: true,
      },
      second,
      randomUUID(),
    );
    second.challengeToken = registration.challengeToken;
    second.sessionToken = (
      await adapter.execute(
        { operation: "verify-email", code: previewHints.verificationCode },
        second,
        randomUUID(),
      )
    ).sessionToken;
    const otherId = (await adapter.account(second.sessionToken))!.sessions.find(
      (session) => session.current,
    )!.id;
    for (const command of [
      { operation: "revoke-session", sessionId: otherId },
      { operation: "trust-device", sessionId: otherId, trusted: true },
    ] as AuthCommand[])
      expect(
        (await adapter.execute(command, first, randomUUID())).outcome,
      ).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(await adapter.account(second.sessionToken)).not.toBeNull();
  });
  it("reset requires the matching challenge and revokes all older sessions", async () => {
    const adapter = mock();
    const first = context();
    first.sessionToken = (
      await adapter.execute(login, first, randomUUID())
    ).sessionToken;
    const second = context();
    second.sessionToken = (
      await adapter.execute(login, second, randomUUID())
    ).sessionToken;
    const reset = await adapter.execute(
      { operation: "forgot-password", email: previewHints.email },
      first,
      randomUUID(),
    );
    first.challengeToken = reset.challengeToken;
    const command: AuthCommand = {
      operation: "reset-password",
      password: "New-preview-42!",
      confirmPassword: "New-preview-42!",
      code: "000000",
    };
    expect(
      (await adapter.execute(command, first, randomUUID())).outcome.ok,
    ).toBe(false);
    expect(await adapter.account(second.sessionToken)).not.toBeNull();
    expect(
      (
        await adapter.execute(
          { ...command, code: previewHints.verificationCode },
          first,
          randomUUID(),
        )
      ).outcome.ok,
    ).toBe(true);
    expect(await adapter.account(first.sessionToken)).toBeNull();
    expect(await adapter.account(second.sessionToken)).toBeNull();
    expect(
      (await adapter.execute(login, context(), randomUUID())).outcome.ok,
    ).toBe(false);
  });
});

it("minimizes profile identity, reserves seeded profile slugs, and removes inactive identities", async () => {
  const adapter = mock();
  const actor = context();
  actor.sessionToken = (
    await adapter.execute(login, actor, randomUUID())
  ).sessionToken;
  const account = (await adapter.account(actor.sessionToken))!;
  const identity = await adapter.profileIdentity(account.profile.id);
  expect(await adapter.profileIdentity(account.profile.username)).toEqual(
    identity,
  );
  expect(identity).not.toHaveProperty("email");
  expect(identity).not.toHaveProperty("sessions");
  expect(
    (
      await adapter.execute(
        {
          operation: "onboarding",
          displayName: "Synthetic",
          username: "ava",
          bio: "",
        },
        actor,
        randomUUID(),
      )
    ).outcome,
  ).toMatchObject({ ok: false, error: { code: "conflict" } });
  expect(
    (
      await adapter.execute(
        {
          operation: "deactivate",
          password: previewHints.password,
          confirmation: "DEACTIVATE",
        },
        actor,
        randomUUID(),
      )
    ).outcome.ok,
  ).toBe(true);
  expect(await adapter.profileIdentity(account.profile.id)).toBeNull();
  expect(await adapter.profileIdentity(account.profile.username)).toBeNull();
});
