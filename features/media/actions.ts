"use server";
import {
  getAuthAdapter,
  getAuthMode,
  readAuthContext,
} from "@/lib/auth/server";
import { getMediaAdapter } from "@/lib/media/server";
import { mediaFailure } from "@/lib/media/mock-adapter";
import { mediaCommand } from "./validation";
import type { CatalogResult, MediaOutcome } from "./contracts";
async function actor() {
  const context = await readAuthContext();
  const account = await getAuthAdapter().account(context.sessionToken);
  return account?.profile.onboarded ? account.profile : null;
}
export async function refreshMedia(): Promise<CatalogResult> {
  if (getAuthMode() !== "mock")
    return mediaFailure("unavailable", "Media services are not connected.");
  try {
    const identity = await actor();
    return identity
      ? await getMediaAdapter().catalog(identity)
      : mediaFailure("unauthorized", "Your session expired. Sign in again.");
  } catch {
    return mediaFailure(
      "network",
      "Media access could not be refreshed. Retry manually.",
      true,
    );
  }
}
export async function mutateMedia(
  input: unknown,
  requestId: string,
): Promise<MediaOutcome> {
  if (getAuthMode() !== "mock")
    return mediaFailure("unavailable", "Media services are not connected.");
  const parsed = mediaCommand.safeParse(input);
  if (!parsed.success)
    return mediaFailure("validation", "Check the supplied media action.");
  try {
    const identity = await actor();
    return identity
      ? await getMediaAdapter().execute(identity, parsed.data, requestId)
      : mediaFailure("unauthorized", "Your session expired. Sign in again.");
  } catch {
    return mediaFailure(
      "network",
      "Action unconfirmed. Retry with the same request ID.",
      true,
    );
  }
}
