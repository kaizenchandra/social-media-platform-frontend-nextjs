"use server";
import { revalidatePath } from "next/cache";
import { commands, validationFields } from "./validation";
import type { AuthOutcome } from "./contracts";
import {
  getAuthAdapter,
  readAuthContext,
  writeAuthCookies,
  getAuthMode,
} from "@/lib/auth/server";

export async function submitAuth(
  input: unknown,
  requestId: string,
): Promise<AuthOutcome> {
  const parsed = commands.safeParse(input);
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
  if (typeof requestId !== "string" || !/^[a-zA-Z0-9-]{8,80}$/.test(requestId))
    return {
      ok: false,
      error: {
        code: "validation",
        message: "Start the action again.",
        retryable: false,
      },
    };
  try {
    const context = await readAuthContext();
    const result = await getAuthAdapter().execute(
      parsed.data,
      context,
      requestId,
    );
    if (getAuthMode() === "mock" && result.outcome.ok) {
      await writeAuthCookies(result, context.browserId);
      revalidatePath("/account", "layout");
      revalidatePath("/onboarding");
    }
    // Opaque session/challenge values never cross the server/client DTO boundary.
    return result.outcome;
  } catch {
    return {
      ok: false,
      error: {
        code: "network",
        message:
          "The request could not be completed. Your input is preserved. Try again.",
        retryable: true,
      },
    };
  }
}
export async function checkSession(): Promise<{ active: boolean }> {
  const context = await readAuthContext();
  return { active: !!(await getAuthAdapter().account(context.sessionToken)) };
}
