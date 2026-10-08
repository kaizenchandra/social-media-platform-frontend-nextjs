import type { PublicationState, Decision } from "./contracts";
const transitions: Record<PublicationState, readonly PublicationState[]> = {
  DRAFT: ["VALIDATING"],
  VALIDATING: ["UPLOADING", "FAILED", "CANCELLED"],
  UPLOADING: ["UPLOADING", "PROCESSING", "FAILED", "CANCELLED"],
  PROCESSING: ["SCREENING", "FAILED", "CANCELLED"],
  SCREENING: [
    "REVIEW_REQUIRED",
    "APPROVED",
    "RESTRICTED",
    "REJECTED",
    "FAILED",
    "CANCELLED",
  ],
  REVIEW_REQUIRED: ["APPROVED", "RESTRICTED", "REJECTED", "CANCELLED"],
  APPROVED: ["PUBLISHED", "RESTRICTED", "REJECTED", "CANCELLED"],
  PUBLISHED: ["RESTRICTED", "REJECTED"],
  RESTRICTED: ["SCREENING"],
  REJECTED: ["SCREENING"],
  FAILED: ["VALIDATING"],
  CANCELLED: [],
};
// This helper validates adapter/service events. It is not an authorization boundary.
// Clients never submit a destination state or a decision through Server Actions.
export function transition(
  from: PublicationState,
  to: PublicationState,
  evidence?: Decision,
  simulation = false,
): PublicationState {
  if (!transitions[from].includes(to))
    throw new Error("Invalid publication transition.");
  if (["APPROVED", "PUBLISHED", "RESTRICTED", "REJECTED"].includes(to)) {
    if (!evidence?.id || (evidence.source !== "backend" && !simulation))
      throw new Error("A service decision is required.");
    if (to === "PUBLISHED" && (simulation || evidence.source !== "backend"))
      throw new Error("Simulated content cannot be distributed.");
  }
  return to;
}
