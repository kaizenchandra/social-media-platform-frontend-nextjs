import type { AccessContext, LiveCapabilities, MediaRecord } from "./contracts";
export const fixtureAssets = new Set([
  "/artwork/coast.svg",
  "/artwork/garden.svg",
  "/artwork/studio.svg",
  "/media/synthetic-motion.webm",
]);
export function canViewMedia(
  item: MediaRecord,
  context: AccessContext,
  now: number,
) {
  if (!context.allowedCreators.has(item.creator.id)) return false;
  if (item.audience === "private" && item.creator.id !== context.actorId)
    return false;
  if (
    item.audience === "friends" &&
    item.creator.id !== context.actorId &&
    !context.friendCreators.has(item.creator.id)
  )
    return false;
  if (
    item.kind === "story" &&
    item.expiresAt !== null &&
    item.expiresAt <= now &&
    !item.creatorHighlight
  )
    return false;
  if (item.source === "fixture")
    return (
      item.publication === "FIXTURE" &&
      !item.distributionEnabled &&
      fixtureAssets.has(item.src) &&
      fixtureAssets.has(item.poster)
    );
  return (
    item.source === "service" &&
    item.publication === "PUBLISHED" &&
    item.distributionEnabled &&
    item.decision?.source === "backend" &&
    !!item.decision.id
  );
}
export function mayPublishRecording(input: {
  state: string;
  distributionEnabled: boolean;
  decision: { source: string; id: string } | null;
  mode: string;
}) {
  return (
    input.mode === "integrated" &&
    input.state === "PUBLISHED" &&
    input.distributionEnabled &&
    input.decision?.source === "backend" &&
    !!input.decision.id
  );
}
export const unavailableLive: LiveCapabilities = {
  provider: "unavailable",
  ingest: false,
  authorizedPlayback: false,
  eligibility: false,
  continuousMonitoring: false,
  emergencyInterruption: false,
  reporting: false,
  captions: false,
};
// Capability requirements only. No provider or authority is configured by the UI.
export function liveReady(capabilities: LiveCapabilities) {
  return (
    capabilities.provider === "integrated" &&
    capabilities.ingest &&
    capabilities.authorizedPlayback &&
    capabilities.eligibility &&
    capabilities.continuousMonitoring &&
    capabilities.emergencyInterruption &&
    capabilities.reporting
  );
}
export function seekTime(current: number, delta: number, duration: number) {
  return Number.isFinite(duration) && duration > 0
    ? Math.max(
        0,
        Math.min(duration, Number.isFinite(current) ? current + delta : 0),
      )
    : 0;
}
