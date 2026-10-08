"use server";
import { refresh } from "next/cache";
import {
  getAuthMode,
  getAuthAdapter,
  readAuthContext,
} from "@/lib/auth/server";
import { getProfilesAdapter } from "@/lib/profiles/server";
import { failure } from "@/lib/profiles/mock-adapter";
import { profileCommand } from "./validation";
import { validationFields } from "@/features/auth/validation";
import type { ProfileOutcome } from "./contracts";
export async function mutateProfile(
  input: unknown,
  requestId: string,
): Promise<ProfileOutcome> {
  if (getAuthMode() !== "mock")
    return failure(
      "unavailable",
      "Profiles and connections are not connected to a service.",
    );
  const parsed = profileCommand.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: "validation",
        message: "Check the highlighted fields.",
        retryable: false,
        fields: validationFields(parsed.error),
      },
    };
  try {
    const context = await readAuthContext();
    const auth = getAuthAdapter();
    const account = await auth.account(context.sessionToken);
    if (!account?.profile.onboarded)
      return failure("unauthorized", "Your session expired. Sign in again.");
    const result = await getProfilesAdapter().execute(
      account.profile,
      parsed.data,
      requestId,
      async (displayName, bio, version) => {
        // The identity adapter owns names/bios; its existing mutation rechecks session and version.
        return (
          await auth.execute(
            { operation: "update-account", displayName, bio, version },
            context,
            `${requestId}-identity`,
          )
        ).outcome;
      },
    );
    if (result.ok) refresh();
    return result;
  } catch {
    return failure(
      "network",
      "Connection interrupted. Your changes were not confirmed. Retry or reload before continuing.",
      true,
    );
  }
}
