import "server-only";
import {
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import type {
  AuthProfile,
  AuthErrorCode,
  AccountSnapshot,
} from "@/features/auth/contracts";
import { previewProfileUsernames } from "@/features/profiles/contracts";
import { previewHints } from "@/features/auth/contracts";
import { safeReturnTo, type AuthCommand } from "@/features/auth/validation";
import type { AuthAdapter, AuthContext, AdapterResult } from "./adapter";

type User = {
  profile: AuthProfile;
  salt: string;
  passwordHash: Buffer;
  active: boolean;
  verified: boolean;
  mfa: boolean;
};
type Session = {
  id: string;
  userId: string;
  label: string;
  trusted: boolean;
  createdAt: number;
  expiresAt: number;
};
type Challenge = {
  userId?: string;
  kind: "email" | "mfa" | "reset";
  attempts: number;
  sends: number;
  expiresAt: number;
  browserId: string;
};
export function authFailure(
  code: AuthErrorCode,
  message: string,
  retryable = false,
): AdapterResult {
  return { outcome: { ok: false, error: { code, message, retryable } } };
}

// Explicitly simulated, process-local authority. NEVER instantiate in production.
export function createDevelopmentAuthAdapter(
  environment: { nodeEnv: string; mode: string },
  now = () => Date.now(),
): AuthAdapter {
  if (
    process.env.NODE_ENV === "production" ||
    environment.nodeEnv === "production" ||
    environment.mode !== "mock"
  )
    throw new Error("Development authentication is disabled.");
  const users = new Map<string, User>();
  const sessions = new Map<string, Session>();
  const challenges = new Map<string, Challenge>();
  const replays = new Map<
    string,
    { result: AdapterResult; expiresAt: number; fingerprint: string }
  >();
  const expiry = 15 * 60_000;
  function makeUser(
    email: string,
    name: string,
    password: string,
    verified: boolean,
    mfa: boolean,
    onboarded = true,
    id: string = randomUUID(),
  ) {
    const salt = randomUUID();
    const user: User = {
      profile: {
        id,
        email: email.toLowerCase(),
        displayName: name,
        username: onboarded ? `preview_${id.slice(0, 8)}` : "",
        bio: "",
        onboarded,
        version: 1,
      },
      salt,
      passwordHash: scryptSync(password, salt, 32),
      active: true,
      verified,
      mfa,
    };
    users.set(id, user);
    return user;
  }
  const demo = makeUser(
    "member@example.test",
    "Preview member",
    previewHints.password,
    true,
    false,
    true,
    previewHints.accountId,
  );
  demo.profile.username = previewHints.username;
  makeUser(
    "mfa@example.test",
    "MFA preview",
    previewHints.password,
    true,
    true,
  );
  makeUser(
    "unverified@example.test",
    "Verification preview",
    previewHints.password,
    false,
    false,
    false,
  );
  const lookup = (email: string) =>
    [...users.values()].find(
      (user) => user.profile.email === email.toLowerCase(),
    );
  const validPassword = (user: User, password: string) =>
    timingSafeEqual(scryptSync(password, user.salt, 32), user.passwordHash);
  function clean() {
    for (const [key, value] of sessions)
      if (value.expiresAt <= now()) sessions.delete(key);
    for (const [key, value] of challenges)
      if (value.expiresAt <= now()) challenges.delete(key);
    for (const [key, value] of replays)
      if (value.expiresAt <= now()) replays.delete(key);
  }
  function current(token?: string) {
    clean();
    const session = token ? sessions.get(token) : undefined;
    const user = session ? users.get(session.userId) : undefined;
    return session && user?.active && user.verified ? { session, user } : null;
  }
  function revokeUser(userId: string) {
    for (const [key, value] of sessions)
      if (value.userId === userId) sessions.delete(key);
  }
  function mint(user: User, next?: string): AdapterResult {
    const sessionToken = randomUUID();
    sessions.set(sessionToken, {
      id: randomUUID(),
      userId: user.profile.id,
      label: "This browser (preview)",
      trusted: false,
      createdAt: now(),
      expiresAt: now() + expiry,
    });
    if (
      ![...sessions.values()].some(
        (session) =>
          session.userId === user.profile.id &&
          session.label === "Example mobile device",
      )
    )
      sessions.set(randomUUID(), {
        id: randomUUID(),
        userId: user.profile.id,
        label: "Example mobile device",
        trusted: true,
        createdAt: now(),
        expiresAt: now() + expiry,
      });
    return {
      sessionToken,
      clearChallenge: true,
      outcome: {
        ok: true,
        message:
          "Preview session started. No production identity was verified.",
        next: user.profile.onboarded ? safeReturnTo(next) : "/onboarding",
      },
    };
  }
  function challenge(
    user: User | undefined,
    kind: Challenge["kind"],
    browserId: string,
  ): AdapterResult {
    const challengeToken = randomUUID();
    challenges.set(challengeToken, {
      userId: user?.profile.id,
      kind,
      attempts: 0,
      sends: 0,
      browserId,
      expiresAt: now() + 10 * 60_000,
    });
    return {
      challengeToken,
      outcome: {
        ok: true,
        message:
          kind === "reset"
            ? "If an eligible preview account exists, a simulated reset has been prepared. No email was sent."
            : "A simulated challenge is ready. No email or authenticator service is connected.",
        next:
          kind === "email"
            ? "/verify-email"
            : kind === "mfa"
              ? "/mfa"
              : "/reset-password",
      },
    };
  }
  async function execute(
    command: AuthCommand,
    context: AuthContext,
    requestId: string,
  ): Promise<AdapterResult> {
    clean();
    const privateOperation = [
      "onboarding",
      "update-account",
      "revoke-session",
      "trust-device",
      "deactivate",
      "delete-account",
      "expire-session",
    ].includes(command.operation);
    const actor = current(context.sessionToken);
    if (privateOperation && !actor)
      return authFailure(
        "unauthorized",
        "Your preview session expired. Sign in again.",
      );
    const replayScope = privateOperation
      ? actor!.user.profile.id
      : (context.challengeToken ?? "public");
    const replayKey = `${context.browserId}:${replayScope}:${requestId}`;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(command))
      .digest("hex");
    const replay = replays.get(replayKey);
    if (replay) {
      if (replay.fingerprint !== fingerprint)
        return authFailure(
          "conflict",
          "The same preview request was reused with different input. Start a new action.",
        );
      if (replay.result.sessionToken && !current(replay.result.sessionToken))
        return authFailure(
          "expired",
          "That preview session has expired. Sign in again.",
        );
      if (
        replay.result.challengeToken &&
        !challenges.has(replay.result.challengeToken)
      )
        return authFailure(
          "invalid_challenge",
          "That preview challenge expired. Start again.",
        );
      return replay.result;
    }
    if (
      users.size > 100 ||
      replays.size > 1000 ||
      sessions.size > 500 ||
      challenges.size > 500
    )
      return authFailure(
        "rate_limited",
        "The preview is at capacity. Restart the development server.",
      );
    const result = await apply(command, context, actor);
    if (result.outcome.ok)
      replays.set(replayKey, {
        result,
        expiresAt: now() + 60_000,
        fingerprint,
      });
    return result;
  }
  async function apply(
    command: AuthCommand,
    context: AuthContext,
    actor: ReturnType<typeof current>,
  ): Promise<AdapterResult> {
    switch (command.operation) {
      case "login": {
        if (!command.email.toLowerCase().endsWith(".test"))
          return authFailure(
            "validation",
            "Use an example.test address. Do not enter real credentials.",
          );
        if (command.email === "offline@example.test")
          return authFailure(
            "network",
            "Simulated network interruption. Your input is preserved; try another preview scenario.",
            true,
          );
        if (command.email === "locked@example.test")
          return authFailure(
            "forbidden",
            "This example account is locked. Use account recovery.",
          );
        if (command.email === "expired@example.test")
          return authFailure(
            "expired",
            "This example session expired. Sign in with the member preview.",
          );
        const user = lookup(command.email);
        if (!user || !user.active || !validPassword(user, command.password))
          return authFailure(
            "invalid_credentials",
            "Email or password is incorrect.",
          );
        if (!user.verified) return challenge(user, "email", context.browserId);
        if (user.mfa) return challenge(user, "mfa", context.browserId);
        return mint(user, command.returnTo);
      }
      case "register": {
        if (!command.email.toLowerCase().endsWith(".test"))
          return authFailure(
            "validation",
            "Use a synthetic .test email address in this preview.",
          );
        if (lookup(command.email))
          return authFailure(
            "conflict",
            "This preview email is already registered. Sign in or choose another .test address.",
          );
        return challenge(
          makeUser(
            command.email,
            command.displayName,
            command.password,
            false,
            false,
            false,
          ),
          "email",
          context.browserId,
        );
      }
      case "forgot-password": {
        if (!command.email.toLowerCase().endsWith(".test"))
          return authFailure(
            "validation",
            "Use a synthetic .test email address in this preview.",
          );
        return challenge(lookup(command.email), "reset", context.browserId);
      }
      case "verify-email":
      case "mfa":
      case "reset-password":
      case "resend-email": {
        const proof = context.challengeToken
          ? challenges.get(context.challengeToken)
          : undefined;
        const expected =
          command.operation === "mfa"
            ? "mfa"
            : command.operation === "reset-password"
              ? "reset"
              : "email";
        if (
          !proof ||
          proof.browserId !== context.browserId ||
          proof.kind !== expected
        )
          return authFailure(
            "invalid_challenge",
            "This preview challenge is missing or expired. Start again.",
          );
        if (proof.attempts >= 5)
          return authFailure(
            "rate_limited",
            "Too many preview attempts. Start a new challenge.",
          );
        if (command.operation === "resend-email") {
          if (proof.sends >= 3)
            return authFailure(
              "rate_limited",
              "Preview resend limit reached. Start again.",
            );
          proof.sends++;
          return {
            outcome: {
              ok: true,
              message: "A preview code was prepared again. No email was sent.",
            },
          };
        }
        const user = proof.userId ? users.get(proof.userId) : undefined;
        if (command.code !== previewHints.verificationCode) {
          proof.attempts++;
          return authFailure(
            "invalid_challenge",
            "The preview code is incorrect.",
            true,
          );
        }
        if (!user || (!user.active && command.operation !== "reset-password"))
          return authFailure(
            "invalid_challenge",
            "This preview challenge is unavailable. Start again.",
          );
        challenges.delete(context.challengeToken!);
        if (command.operation === "reset-password") {
          user.active = true;
          user.passwordHash = scryptSync(command.password, user.salt, 32);
          revokeUser(user.profile.id);
          return {
            clearChallenge: true,
            clearSession: true,
            outcome: {
              ok: true,
              message: "The preview password was changed. Sign in again.",
              next: "/login?reason=reset",
            },
          };
        }
        user.verified = true;
        if (command.operation === "verify-email" && user.mfa)
          return challenge(user, "mfa", context.browserId);
        return mint(user);
      }
      case "recovery": {
        const user = lookup(command.email);
        if (!user || command.recoveryCode !== previewHints.recoveryCode)
          return authFailure(
            "invalid_credentials",
            "The preview recovery details are incorrect.",
          );
        // Public synthetic recovery code is not an identity check.
        return challenge(user, "reset", context.browserId);
      }
      case "logout": {
        if (context.sessionToken) sessions.delete(context.sessionToken);
        return {
          clearSession: true,
          clearChallenge: true,
          outcome: {
            ok: true,
            message: "Preview session ended.",
            next: "/login?reason=signed-out",
          },
        };
      }
      case "onboarding": {
        if (
          previewProfileUsernames.includes(command.username) ||
          [...users.values()].some(
            (user) =>
              user.profile.id !== actor!.user.profile.id &&
              user.profile.username === command.username,
          )
        )
          return authFailure(
            "conflict",
            "That preview username is already in use.",
          );
        Object.assign(actor!.user.profile, {
          displayName: command.displayName,
          username: command.username,
          bio: command.bio,
          onboarded: true,
          version: actor!.user.profile.version + 1,
        });
        return {
          outcome: {
            ok: true,
            message: "Preview profile prepared.",
            next: "/account",
          },
        };
      }
      case "update-account": {
        if (actor!.user.profile.version !== command.version)
          return authFailure(
            "conflict",
            "The preview changed in another tab. Reload to review it before saving.",
          );
        Object.assign(actor!.user.profile, {
          displayName: command.displayName,
          bio: command.bio,
          version: command.version + 1,
        });
        return {
          outcome: { ok: true, message: "Preview account details updated." },
        };
      }
      case "trust-device":
      case "revoke-session": {
        const entry = [...sessions.entries()].find(
          ([, session]) =>
            session.id === command.sessionId &&
            session.userId === actor!.user.profile.id,
        );
        if (!entry)
          return authFailure(
            "forbidden",
            "This preview session is unavailable.",
          );
        if (command.operation === "trust-device") {
          entry[1].trusted = command.trusted;
          return {
            outcome: {
              ok: true,
              message: "Preview device preference changed.",
            },
          };
        }
        sessions.delete(entry[0]);
        return {
          clearSession: entry[0] === context.sessionToken,
          outcome: {
            ok: true,
            message: "Preview session revoked.",
            next:
              entry[0] === context.sessionToken
                ? "/login?reason=expired"
                : undefined,
          },
        };
      }
      case "deactivate":
      case "delete-account": {
        if (!validPassword(actor!.user, command.password))
          return authFailure(
            "invalid_credentials",
            "Confirm your current preview password to continue.",
          );
        revokeUser(actor!.user.profile.id);
        for (const [key, proof] of challenges)
          if (proof.userId === actor!.user.profile.id) challenges.delete(key);
        if (command.operation === "delete-account")
          users.delete(actor!.user.profile.id);
        else actor!.user.active = false;
        return {
          clearSession: true,
          clearChallenge: true,
          outcome: {
            ok: true,
            message:
              "The preview account lifecycle was updated. No real account or data was affected.",
            next: `/login?reason=${command.operation === "deactivate" ? "deactivated" : "deleted"}`,
          },
        };
      }
      case "expire-session": {
        sessions.delete(context.sessionToken!);
        return {
          clearSession: true,
          outcome: {
            ok: true,
            message: "Preview expiry simulated.",
            next: "/login?reason=expired",
          },
        };
      }
    }
  }
  return {
    execute,
    async profileIdentity(idOrUsername) {
      const user =
        users.get(idOrUsername) ??
        [...users.values()].find(
          (user) => user.profile.username === idOrUsername,
        );
      if (!user?.active || !user.verified || !user.profile.onboarded)
        return null;
      const { displayName, username, bio, version } = user.profile;
      return { id: user.profile.id, displayName, username, bio, version };
    },
    async account(token?: string): Promise<AccountSnapshot | null> {
      const actor = current(token);
      if (!actor) return null;
      return {
        profile: { ...actor.user.profile },
        expiresAt: new Date(actor.session.expiresAt).toISOString(),
        sessions: [...sessions.values()]
          .filter((session) => session.userId === actor.user.profile.id)
          .map((session) => ({
            id: session.id,
            label: session.label,
            trusted: session.trusted,
            current: session.id === actor.session.id,
            createdAt: new Date(session.createdAt).toISOString(),
            expiresAt: new Date(session.expiresAt).toISOString(),
          })),
      };
    },
  };
}
