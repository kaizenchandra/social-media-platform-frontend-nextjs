import "server-only";
import type { LiveCapabilities } from "@/features/media/contracts";
import { unavailableLive } from "@/features/media/policy";
export type LiveSessionRequest = {
  title: string;
  audience: "private" | "friends" | "public";
  eligibilityToken: string;
  requestId: string;
};
export type LiveProviderResult = {
  ok: false;
  code: "unavailable";
  message: string;
};
// No speculative endpoint, ingest URL, camera permission, viewer count, or monitoring promise.
// A provider implementation must derive identity and validate eligibility/audience on the server.
export interface LiveProvider {
  capabilities(): LiveCapabilities;
  start(request: LiveSessionRequest): Promise<LiveProviderResult>;
  stop(sessionId: string): Promise<LiveProviderResult>;
}
const provider: LiveProvider = {
  capabilities: () => ({ ...unavailableLive }),
  async start() {
    return {
      ok: false,
      code: "unavailable",
      message:
        "Live ingest, authorization, monitoring and interruption services are not connected.",
    };
  },
  async stop() {
    return {
      ok: false,
      code: "unavailable",
      message: "No live provider session exists.",
    };
  },
};
export function getLiveProvider(): LiveProvider {
  return provider;
}
