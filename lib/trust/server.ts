import "server-only";
import { TrustStore } from "./store";
import { getAuthMode } from "@/lib/auth/server";
const state = globalThis as typeof globalThis & { commonTrust?: TrustStore };
export function getTrustStore() {
  if (getAuthMode() !== "mock") throw new Error("Trust services unavailable");
  state.commonTrust ??= new TrustStore((id) => {
    // Trusted server deployment configuration only; no role field or email selector from the browser.
    if ((process.env.COMMON_PREVIEW_ADMIN_IDS ?? "").split(",").includes(id))
      return "admin";
    if (
      (process.env.COMMON_PREVIEW_MODERATOR_IDS ?? "").split(",").includes(id)
    )
      return "moderator";
    return "member";
  });
  return state.commonTrust;
}
