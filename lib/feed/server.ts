import "server-only";
import { getAuthMode, getAuthAdapter } from "@/lib/auth/server";
import { getProfilesAdapter } from "@/lib/profiles/server";
import { createDevelopmentFeedAdapter, feedFailure } from "./mock-adapter";
import type { FeedAdapter } from "./adapter";
const unavailable: FeedAdapter = {
  async read() {
    return feedFailure("unavailable", "The feed service is not connected.");
  },
  async post() {
    return feedFailure("unavailable", "The post service is not connected.");
  },
  async execute() {
    return feedFailure(
      "unavailable",
      "Engagement is not connected to a service.",
    );
  },
};
const state = globalThis as typeof globalThis & {
  commonPreviewFeed?: FeedAdapter;
};
export function getFeedAdapter() {
  if (getAuthMode() !== "mock") return unavailable;
  state.commonPreviewFeed ??= createDevelopmentFeedAdapter(
    { nodeEnv: process.env.NODE_ENV!, mode: "mock" },
    getProfilesAdapter(),
    (id) => getAuthAdapter().profileIdentity(id),
  );
  return state.commonPreviewFeed;
}
