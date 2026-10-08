"use server";
import { refresh } from "next/cache";
import {
  getAuthAdapter,
  readAuthContext,
  getAuthMode,
} from "@/lib/auth/server";
import { getTrustStore } from "@/lib/trust/server";
import { trustCommand } from "./validation";
import type { Outcome } from "@/features/community/contracts";
import { getProfilesAdapter } from "@/lib/profiles/server";
export async function trustAction(
  input: unknown,
  requestId: string,
): Promise<Outcome> {
  const parsed = trustCommand.safeParse(input);
  if (!parsed.success || !/^[\w-]{8,100}$/.test(requestId))
    return { ok: false, message: "Check the fields and try again." };
  if (getAuthMode() !== "mock")
    return { ok: false, message: "Trust services unavailable." };
  try {
    const ctx = await readAuthContext(),
      account = await getAuthAdapter().account(ctx.sessionToken);
    if (!account?.profile.onboarded)
      return { ok: false, message: "Sign in again." };
    const store = getTrustStore();
    // Audience is enforced by the existing authoritative profile graph as well as the dashboard.
    if (parsed.data.operation === "privacy") {
      if (store.privacy(account.profile.id).version !== parsed.data.version)
        return { ok: false, message: "Privacy settings changed. Reload." };
      const profiles = getProfilesAdapter(),
        view = await profiles.profile(account.profile);
      if (view.kind !== "visible" || !view.settings || !view.details)
        return { ok: false, message: "Profile unavailable." };
      const result = await profiles.execute(
        account.profile,
        {
          operation: "edit",
          version: view.version,
          displayName: account.profile.displayName,
          bio: account.profile.bio,
          location: view.details.location,
          work: view.details.work,
          website: view.details.website,
          avatar: view.person.avatar,
          cover: view.cover,
          visibility: parsed.data.audience,
          detailsAudience: parsed.data.audience,
          connectionsAudience: parsed.data.audience,
        },
        `${requestId}-audience`,
        async () => ({ ok: true, message: "Identity unchanged." }),
      );
      if (!result.ok) return { ok: false, message: result.error.message };
    }
    const result = store.execute(account.profile.id, parsed.data, requestId);
    if (result.ok) refresh();
    return result;
  } catch {
    return {
      ok: false,
      message: "Connection interrupted. Reload before retrying.",
    };
  }
}
