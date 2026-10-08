"use server";
import { refresh } from "next/cache";
import { getAuthAdapter, readAuthContext } from "@/lib/auth/server";
import { getProfilesAdapter } from "@/lib/profiles/server";
import { getAdvancedAdapter } from "@/lib/advanced/server";
import { advancedFailure } from "@/lib/advanced/development-adapter";
import { getAssistantProvider } from "@/lib/advanced/ai-provider";
import { advancedCommand, assistantRequest } from "./validation";
import type { AssistantResult } from "./contracts";
async function actor() {
  const context = await readAuthContext(),
    account = await getAuthAdapter().account(context.sessionToken);
  return account?.profile.onboarded ? account.profile : null;
}
export async function advancedAction(input: unknown, requestId: string) {
  const parsed = advancedCommand.safeParse(input);
  if (!parsed.success || !/^[\w-]{8,100}$/.test(requestId))
    return advancedFailure(
      "validation",
      parsed.success
        ? "Invalid request identity."
        : (parsed.error.issues[0]?.message ?? "Check the fields."),
    );
  try {
    const identity = await actor();
    if (!identity)
      return advancedFailure(
        "unauthorized",
        "Your session expired. Sign in again.",
      );
    const result = await getAdvancedAdapter().execute(
      identity,
      parsed.data,
      requestId,
    );
    if (result.ok) refresh();
    return result;
  } catch {
    return advancedFailure(
      "network",
      "Connection interrupted. Reload to reconcile the result, or explicitly retry this request.",
    );
  }
}
export async function requestAssistance(
  input: unknown,
): Promise<AssistantResult> {
  const parsed = assistantRequest.safeParse(input);
  if (!parsed.success)
    return advancedFailure(
      "validation",
      "Provide eligible text, acknowledge synthetic details, and consent before requesting assistance.",
    );
  try {
    const identity = await actor();
    if (!identity)
      return advancedFailure(
        "unauthorized",
        "Sign in again before requesting assistance.",
      );
    let request = parsed.data;
    if (request.task === "translation" || request.task === "summary") {
      const sources = await getProfilesAdapter().content(identity),
        source = sources.find(
          (s) => s.post.id === request.sourceId && s.post.audience === "public",
        );
      if (!source)
        return advancedFailure(
          "forbidden",
          "That public source is no longer available. Private, restricted, or blocked content cannot be sent for translation or summary.",
        );
      request = { ...request, text: source.post.text };
    }
    return await getAssistantProvider().generate(request);
  } catch {
    return advancedFailure(
      "network",
      "Assistance request failed. No output is available; retry manually when connected.",
    );
  }
}
export async function readWellbeing() {
  try {
    const identity = await actor();
    if (!identity) return { actorId: null, preferences: null };
    const result = await getAdvancedAdapter().wellbeing(identity);
    return result.ok
      ? { actorId: identity.id, preferences: result.data }
      : { actorId: null, preferences: null };
  } catch {
    return { actorId: null, preferences: null };
  }
}
