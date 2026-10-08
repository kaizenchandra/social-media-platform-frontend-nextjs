"use server";
import {
  getAuthMode,
  getAuthAdapter,
  readAuthContext,
} from "@/lib/auth/server";
import { getPublicationAdapter } from "@/lib/publication/server";
import { publicationFailure } from "@/lib/publication/mock-adapter";
import { publicationCommand, publicationFields } from "./validation";
import type { PublicationResult } from "./contracts";
async function actor() {
  const context = await readAuthContext();
  const account = await getAuthAdapter().account(context.sessionToken);
  return account?.profile.onboarded ? account.profile.id : null;
}
export async function mutatePublication(
  input: unknown,
  requestId: string,
): Promise<PublicationResult> {
  if (getAuthMode() !== "mock")
    return publicationFailure(
      "unavailable",
      "Upload, screening and publication are not connected.",
    );
  const parsed = publicationCommand.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: "validation",
        message: "Check the highlighted fields.",
        fields: publicationFields(parsed.error),
        retryable: false,
      },
    };
  try {
    const id = await actor();
    if (!id)
      return publicationFailure(
        "unauthorized",
        "Your session expired. Sign in again.",
      );
    return await getPublicationAdapter().execute(id, parsed.data, requestId);
  } catch {
    return publicationFailure(
      "network",
      "Connection interrupted. Nothing was confirmed. Retry with the same request or reload status to reconcile.",
      true,
    );
  }
}
export async function readPublication(id: string): Promise<PublicationResult> {
  if (getAuthMode() !== "mock")
    return publicationFailure(
      "unavailable",
      "The publication service is not connected.",
    );
  try {
    const user = await actor();
    return user
      ? await getPublicationAdapter().read(user, id)
      : publicationFailure(
          "unauthorized",
          "Your session expired. Sign in again.",
        );
  } catch {
    return publicationFailure(
      "network",
      "Status could not be checked. Try again.",
      true,
    );
  }
}
