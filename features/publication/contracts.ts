import type { AuthError } from "@/features/auth/contracts";
export const publicationStates = [
  "DRAFT",
  "VALIDATING",
  "UPLOADING",
  "PROCESSING",
  "SCREENING",
  "REVIEW_REQUIRED",
  "APPROVED",
  "PUBLISHED",
  "RESTRICTED",
  "REJECTED",
  "FAILED",
  "CANCELLED",
] as const;
export type PublicationState = (typeof publicationStates)[number];
export const scenarios = [
  "low-risk",
  "review",
  "rejected",
  "restricted",
  "upload-interruption",
  "moderation-timeout",
] as const;
export type Scenario = (typeof scenarios)[number];
export const mediaTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
] as const;
export type MediaInput = {
  name: string;
  type: (typeof mediaTypes)[number];
  size: number;
  alt: string;
};
export type PostDraft = {
  format?: "post" | "story" | "reel" | "video";
  text: string;
  audience: "private" | "friends" | "public";
  disclosure: "not-declared" | "ai-generated" | "ai-edited" | "unknown";
  media: MediaInput[];
  scenario: Scenario;
  syntheticOnly: true;
};
export type Decision = {
  source: "backend" | "simulation";
  id: string;
  reason: string;
  appealEligible: boolean;
};
export type Publication = {
  id: string;
  version: number;
  state: PublicationState;
  mode: "simulated" | "integrated";
  draft: PostDraft;
  progress: number;
  attempt: number;
  updatedAt: string;
  targetAt: string | null;
  decision: Decision | null;
  retryable: boolean;
  explanation: string;
  distributionEnabled: boolean;
};
export type PublicationResult =
  { ok: true; item: Publication } | { ok: false; error: AuthError };
export type PublicationList =
  { ok: true; items: Publication[] } | { ok: false; error: AuthError };
export const activeStates: readonly PublicationState[] = [
  "VALIDATING",
  "UPLOADING",
  "PROCESSING",
  "SCREENING",
];
export const cancellableStates: readonly PublicationState[] = [
  ...activeStates,
  "REVIEW_REQUIRED",
  "APPROVED",
];
