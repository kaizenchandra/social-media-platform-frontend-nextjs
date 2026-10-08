"use server";
import { refresh } from "next/cache";
import {
  getAuthMode,
  getAuthAdapter,
  readAuthContext,
} from "@/lib/auth/server";
import { getFeedAdapter } from "@/lib/feed/server";
import { feedFailure } from "@/lib/feed/mock-adapter";
import { feedCommand } from "./validation";
import { validationFields } from "@/features/auth/validation";
import type { FeedOutcome } from "./contracts";
export async function mutateFeed(
  input: unknown,
  requestId: string,
): Promise<FeedOutcome> {
  if (getAuthMode() !== "mock")
    return feedFailure(
      "unavailable",
      "Engagement is not connected to a service.",
    );
  const parsed = feedCommand.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: "validation",
        message: "Check the highlighted fields.",
        fields: validationFields(parsed.error),
        retryable: false,
      },
    };
  try {
    const context = await readAuthContext();
    const account = await getAuthAdapter().account(context.sessionToken);
    if (!account?.profile.onboarded)
      return feedFailure(
        "unauthorized",
        "Your session expired. Sign in again.",
      );
    const result = await getFeedAdapter().execute(
      account.profile,
      parsed.data,
      requestId,
    );
    if (
      result.ok &&
      parsed.data.operation !== "share" &&
      parsed.data.operation !== "report-draft"
    )
      refresh();
    return result;
  } catch {
    return feedFailure(
      "network",
      "Connection interrupted. The update was not confirmed. Retry or reload to reconcile it.",
      true,
    );
  }
}
