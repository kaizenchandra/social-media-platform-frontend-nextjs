import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { createDevelopmentPublicationAdapter } from "@/lib/publication/mock-adapter";
import {
  publicationCommand,
  draftInput,
} from "@/features/publication/validation";
import { transition } from "@/features/publication/state-machine";
import type {
  PostDraft,
  PublicationResult,
  Publication,
  Scenario,
} from "@/features/publication/contracts";
import type { PublicationCommand } from "@/features/publication/validation";
const draft: PostDraft = {
  text: "A **synthetic** thought",
  audience: "private",
  disclosure: "ai-generated",
  media: [
    {
      name: "preview.png",
      type: "image/png",
      size: 100,
      alt: "Synthetic landscape",
    },
  ],
  scenario: "low-risk",
  syntheticOnly: true,
};
function setup() {
  const actors = new Set(["owner", "other"]);
  let time = Date.now();
  const adapter = createDevelopmentPublicationAdapter(
    { nodeEnv: "development", mode: "mock" },
    async (id) => actors.has(id),
    () => time,
  );
  const execute = (
    command: PublicationCommand,
    actor = "owner",
    id = randomUUID(),
  ) => adapter.execute(actor, command, id);
  const save = async (scenario: Scenario = "low-risk") =>
    item(await execute({ operation: "save", draft: { ...draft, scenario } }));
  const advance = async (snapshot: Publication) =>
    item(
      await execute({
        operation: "advance",
        id: snapshot.id,
        version: snapshot.version,
      }),
    );
  const begin = async (snapshot: Publication) =>
    item(
      await execute({
        operation: "begin",
        id: snapshot.id,
        version: snapshot.version,
      }),
    );
  const complete = async (snapshot: Publication) => {
    let value = snapshot;
    for (
      let steps = 0;
      ["VALIDATING", "UPLOADING", "PROCESSING", "SCREENING"].includes(
        value.state,
      ) && steps < 12;
      steps++
    )
      value = await advance(value);
    return value;
  };
  return {
    adapter,
    actors,
    execute,
    save,
    begin,
    advance,
    complete,
    later: () => {
      time += 48 * 60 * 60_000;
    },
  };
}
function item(result: PublicationResult) {
  if (!result.ok) throw new Error(result.error.message);
  return result.item;
}
describe("Publication authority and development workflow", () => {
  it("fails closed outside explicit development mode and rejects inactive/other owners", async () => {
    expect(() =>
      createDevelopmentPublicationAdapter(
        { nodeEnv: "production", mode: "mock" },
        async () => true,
      ),
    ).toThrow();
    expect(() =>
      createDevelopmentPublicationAdapter(
        { nodeEnv: "development", mode: "unavailable" },
        async () => true,
      ),
    ).toThrow();
    const ctx = setup(),
      snapshot = await ctx.save();
    expect(await ctx.adapter.read("other", snapshot.id)).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(
      await ctx.execute(
        { operation: "begin", id: snapshot.id, version: snapshot.version },
        "other",
      ),
    ).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(await ctx.adapter.list("other")).toEqual({ ok: true, items: [] });
    ctx.actors.delete("owner");
    expect(await ctx.adapter.read("owner", snapshot.id)).toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    expect(
      await ctx.execute({ operation: "cancel", id: snapshot.id }),
    ).toMatchObject({ ok: false, error: { code: "unauthorized" } });
  });
  it("validates declared types, limits, descriptions, revision pairs and forbids client decision fields", () => {
    expect(
      draftInput.safeParse({ ...draft, text: "", media: [] }).success,
    ).toBe(false);
    for (const media of [
      { ...draft.media[0], type: "image/svg+xml" },
      { ...draft.media[0], name: "document.html" },
      { ...draft.media[0], size: 11 * 1024 * 1024 },
      { ...draft.media[0], alt: "" },
    ])
      expect(draftInput.safeParse({ ...draft, media: [media] }).success).toBe(
        false,
      );
    expect(
      publicationCommand.safeParse({
        operation: "save",
        id: randomUUID(),
        draft,
      }).success,
    ).toBe(false);
    expect(
      publicationCommand.safeParse({
        operation: "advance",
        id: randomUUID(),
        version: 1,
        state: "PUBLISHED",
        decision: { source: "backend" },
      }).success,
    ).toBe(false);
    expect(
      publicationCommand.safeParse({ operation: "approve", id: randomUUID() })
        .success,
    ).toBe(false);
  });
  it("requires decision evidence for sensitive transitions and never distributes simulation", () => {
    expect(() => transition("UPLOADING", "APPROVED")).toThrow();
    expect(() => transition("SCREENING", "APPROVED")).toThrow();
    const evidence = {
      id: "service-decision",
      source: "backend" as const,
      reason: "service reason",
      appealEligible: false,
    };
    expect(transition("SCREENING", "APPROVED", evidence)).toBe("APPROVED");
    expect(transition("APPROVED", "PUBLISHED", evidence)).toBe("PUBLISHED");
    expect(() =>
      transition(
        "APPROVED",
        "PUBLISHED",
        { ...evidence, source: "simulation" },
        true,
      ),
    ).toThrow();
    expect(() =>
      transition("REVIEW_REQUIRED", "PUBLISHED", evidence),
    ).toThrow();
  });
  it("separates successful low-risk transfer, processing, screening and simulated approval", async () => {
    const ctx = setup();
    let snapshot = await ctx.begin(await ctx.save());
    const states = [snapshot.state];
    while (snapshot.state !== "APPROVED") {
      snapshot = await ctx.advance(snapshot);
      states.push(snapshot.state);
      if (snapshot.state === "PROCESSING")
        expect(snapshot).toMatchObject({
          progress: 100,
          decision: null,
          distributionEnabled: false,
        });
    }
    expect(states).toContain("UPLOADING");
    expect(states).toContain("PROCESSING");
    expect(states).toContain("SCREENING");
    expect(snapshot).toMatchObject({
      mode: "simulated",
      distributionEnabled: false,
      decision: { source: "simulation", appealEligible: false },
    });
    expect(
      await ctx.execute({
        operation: "publish",
        id: snapshot.id,
        version: snapshot.version,
      }),
    ).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(item(await ctx.adapter.read("owner", snapshot.id)).state).toBe(
      "APPROVED",
    );
    expect(JSON.stringify(snapshot)).not.toMatch(
      /https?:|blob:|base64|ownerId/,
    );
  });
  it.each([
    ["review", "REVIEW_REQUIRED", false],
    ["rejected", "REJECTED", true],
    ["restricted", "RESTRICTED", true],
  ] as const)(
    "keeps %s fixture non-public with truthful review/appeal metadata",
    async (scenario, state, appealEligible) => {
      const ctx = setup(),
        snapshot = await ctx.complete(
          await ctx.begin(await ctx.save(scenario)),
        );
      expect(snapshot.state).toBe(state);
      expect(snapshot.distributionEnabled).toBe(false);
      expect(snapshot.decision?.appealEligible ?? false).toBe(appealEligible);
      expect(
        await ctx.execute({
          operation: "publish",
          id: snapshot.id,
          version: snapshot.version,
        }),
      ).toMatchObject({ ok: false, error: { code: "forbidden" } });
    },
  );
  it("never approves an overdue moderation target, including after 48 hours", async () => {
    const ctx = setup(),
      snapshot = await ctx.complete(
        await ctx.begin(await ctx.save("moderation-timeout")),
      );
    expect(snapshot.state).toBe("REVIEW_REQUIRED");
    expect(new Date(snapshot.targetAt!).getTime()).toBeLessThan(Date.now());
    ctx.later();
    expect(item(await ctx.adapter.read("owner", snapshot.id))).toMatchObject({
      state: "REVIEW_REQUIRED",
      distributionEnabled: false,
      decision: null,
    });
    expect(
      await ctx.execute({
        operation: "advance",
        id: snapshot.id,
        version: snapshot.version,
      }),
    ).toMatchObject({ ok: false, error: { code: "conflict" } });
  });
  it("recovers an interrupted upload with the same content and a new validating attempt", async () => {
    const ctx = setup(),
      failure = await ctx.complete(
        await ctx.begin(await ctx.save("upload-interruption")),
      );
    expect(failure).toMatchObject({
      state: "FAILED",
      progress: 50,
      retryable: true,
      attempt: 1,
    });
    const retry = item(
      await ctx.execute({
        operation: "retry",
        id: failure.id,
        version: failure.version,
      }),
    );
    expect(retry).toMatchObject({
      state: "VALIDATING",
      progress: 0,
      attempt: 2,
      draft: failure.draft,
    });
    const complete = await ctx.complete(retry);
    expect(complete.state).toBe("APPROVED");
    expect(complete.distributionEnabled).toBe(false);
    expect(
      await ctx.execute({
        operation: "retry",
        id: complete.id,
        version: complete.version,
      }),
    ).toMatchObject({ ok: false, error: { code: "conflict" } });
  });
  it("cancels despite an in-flight step and returns current cancellation state on a late replay", async () => {
    const ctx = setup(),
      snapshot = await ctx.begin(await ctx.save()),
      request = randomUUID();
    const command: PublicationCommand = {
      operation: "advance",
      id: snapshot.id,
      version: snapshot.version,
    };
    await ctx.execute(command, "owner", request);
    const cancel = item(
      await ctx.execute({ operation: "cancel", id: snapshot.id }),
    );
    expect(cancel.state).toBe("CANCELLED");
    expect(item(await ctx.execute(command, "owner", request)).state).toBe(
      "CANCELLED",
    );
    expect(
      await ctx.execute({
        operation: "advance",
        id: cancel.id,
        version: cancel.version,
      }),
    ).toMatchObject({ ok: false, error: { code: "conflict" } });
  });
  it("deduplicates simultaneous draft saves, rejects stale edits and does not share mutable DTO references", async () => {
    const ctx = setup(),
      id = randomUUID();
    const command: PublicationCommand = { operation: "save", draft };
    const [a, b] = await Promise.all([
      ctx.execute(command, "owner", id),
      ctx.execute(command, "owner", id),
    ]);
    expect(item(a).id).toBe(item(b).id);
    const snapshot = item(a);
    snapshot.draft.text = "Tampered client object";
    expect(item(await ctx.adapter.read("owner", snapshot.id)).draft.text).toBe(
      draft.text,
    );
    const changed = item(
      await ctx.execute({
        operation: "save",
        id: snapshot.id,
        version: snapshot.version,
        draft: { ...draft, audience: "public" },
      }),
    );
    expect(
      await ctx.execute({
        operation: "begin",
        id: snapshot.id,
        version: snapshot.version,
      }),
    ).toMatchObject({ ok: false, error: { code: "conflict" } });
    await ctx.begin(changed);
    expect(
      await ctx.execute({
        operation: "save",
        id: changed.id,
        version: changed.version + 1,
        draft,
      }),
    ).toMatchObject({ ok: false, error: { code: "conflict" } });
    const list = await ctx.adapter.list("owner");
    expect(list.ok && list.items.length).toBe(1);
  });
});
