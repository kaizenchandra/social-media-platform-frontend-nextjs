import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { randomUUID } from "node:crypto";
import { resolveAuthMode } from "./config";
import { createDevelopmentAuthAdapter, authFailure } from "./mock-adapter";
import type { AuthAdapter, AuthContext, AdapterResult } from "./adapter";
import type { AccountSnapshot } from "@/features/auth/contracts";
import { safeReturnTo } from "@/features/auth/validation";

export const authCookieNames = {
  session: "common.preview.session",
  challenge: "common.preview.challenge",
  browser: "common.preview.browser",
};
const unavailable: AuthAdapter = {
  async execute() {
    return authFailure(
      "unavailable",
      "Authentication is not connected. Preview authentication is available only in explicitly enabled development mode.",
    );
  },
  async profileIdentity() {
    return null;
  },
  async account() {
    return null;
  },
};
const processState = globalThis as typeof globalThis & {
  commonPreviewAuth?: AuthAdapter;
};
export function getAuthMode() {
  return resolveAuthMode(process.env.NODE_ENV, process.env.COMMON_AUTH_MODE);
}
export function getAuthAdapter(): AuthAdapter {
  if (getAuthMode() !== "mock") return unavailable;
  processState.commonPreviewAuth ??= createDevelopmentAuthAdapter({
    nodeEnv: process.env.NODE_ENV!,
    mode: "mock",
  });
  return processState.commonPreviewAuth;
}
export async function readAuthContext(): Promise<AuthContext> {
  const jar = await cookies();
  return {
    sessionToken: jar.get(authCookieNames.session)?.value,
    challengeToken: jar.get(authCookieNames.challenge)?.value,
    browserId: jar.get(authCookieNames.browser)?.value ?? randomUUID(),
  };
}
export async function writeAuthCookies(
  result: AdapterResult,
  browserId: string,
) {
  const jar = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
  jar.set(authCookieNames.browser, browserId, { ...options, maxAge: 3600 });
  if (result.clearSession) jar.delete(authCookieNames.session);
  if (result.clearChallenge) jar.delete(authCookieNames.challenge);
  if (result.sessionToken)
    jar.set(authCookieNames.session, result.sessionToken, {
      ...options,
      maxAge: 15 * 60,
    });
  if (result.challengeToken)
    jar.set(authCookieNames.challenge, result.challengeToken, {
      ...options,
      maxAge: 10 * 60,
    });
}
// Authoritative development adapter check on every protected read; no shared cache.
export async function requireAccount(
  returnTo = "/account",
): Promise<AccountSnapshot> {
  await connection();
  const context = await readAuthContext();
  const account = await getAuthAdapter().account(context.sessionToken);
  if (!account)
    redirect(
      `/login?reason=expired&returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`,
    );
  return account;
}
