import "server-only";
import type {
  AssistantRequest,
  AssistantResult,
} from "@/features/advanced/contracts";
export interface AssistantProvider {
  readonly status: "unavailable" | "integrated";
  generate(request: AssistantRequest): Promise<AssistantResult>;
}
export function getAssistantProvider(): AssistantProvider {
  return {
    status: "unavailable",
    async generate() {
      return {
        ok: false,
        error: {
          code: "unavailable",
          message:
            "AI provider is not connected. No writing, caption, translation, accessibility description, or summary was generated. Your text was not sent to an external service.",
        },
      };
    },
  };
}
