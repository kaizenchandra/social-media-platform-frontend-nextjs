"use server";
import { refresh } from "next/cache";
import {
  getAuthAdapter,
  readAuthContext,
  getAuthMode,
} from "@/lib/auth/server";
import { getCommunityStore } from "@/lib/community/server";
import { communityCommand } from "./validation";
import type { Outcome } from "./contracts";
export async function communityAction(
  input: unknown,
  requestId: string,
): Promise<Outcome> {
  const parsed = communityCommand.safeParse(input);
  if (!parsed.success || !/^[\w-]{8,100}$/.test(requestId))
    return { ok: false, message: "Check the fields and try again." };
  if (getAuthMode() !== "mock")
    return { ok: false, message: "Community services unavailable." };
  try {
    const ctx = await readAuthContext(),
      account = await getAuthAdapter().account(ctx.sessionToken);
    if (!account?.profile.onboarded)
      return { ok: false, message: "Sign in again." };
    const result = await getCommunityStore().execute(
      account.profile.id,
      parsed.data,
      requestId,
    );
    if (result.ok) refresh();
    return result;
  } catch {
    return {
      ok: false,
      message:
        "Connection interrupted. Reload to check whether the change completed.",
    };
  }
}
