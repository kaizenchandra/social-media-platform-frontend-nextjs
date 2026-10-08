import type { WellbeingPreferences } from "./contracts";
export function isQuiet(p: WellbeingPreferences, now: Date): boolean {
  if (!p.quietEnabled) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: p.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const current = `${parts.find((x) => x.type === "hour")?.value}:${parts.find((x) => x.type === "minute")?.value}`;
  return p.quietStart < p.quietEnd
    ? current >= p.quietStart && current < p.quietEnd
    : current >= p.quietStart || current < p.quietEnd;
}
export function mayNotify(
  p: WellbeingPreferences,
  channel: "inApp" | "push" | "email",
  now: Date,
) {
  return (
    !isQuiet(p, now) &&
    (channel === "inApp"
      ? p.inAppNotifications
      : channel === "push"
        ? p.pushNotifications
        : p.emailNotifications)
  );
}
export function activeDelta(
  previous: number,
  current: number,
  active: boolean,
) {
  return active ? Math.max(0, Math.min(5000, current - previous)) : 0;
}
