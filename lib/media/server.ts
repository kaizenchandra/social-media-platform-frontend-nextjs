import "server-only";
import { getAuthAdapter, getAuthMode } from "@/lib/auth/server";
import { getProfilesAdapter } from "@/lib/profiles/server";
import { createDevelopmentMediaAdapter, mediaFailure } from "./mock-adapter";
import type { MediaAdapter } from "./adapter";
const unavailable: MediaAdapter = {
  async catalog() {
    return mediaFailure("unavailable", "Media services are not connected.");
  },
  async read() {
    return mediaFailure("unavailable", "Media services are not connected.");
  },
  async execute() {
    return mediaFailure("unavailable", "Media services are not connected.");
  },
};
const state = globalThis as typeof globalThis & {
  commonPreviewMedia?: MediaAdapter;
};
export function getMediaAdapter(): MediaAdapter {
  if (getAuthMode() !== "mock") return unavailable;
  state.commonPreviewMedia ??= createDevelopmentMediaAdapter(
    { nodeEnv: process.env.NODE_ENV!, mode: "mock" },
    (id) => getAuthAdapter().profileIdentity(id),
    async (actor) => {
      const content = await getProfilesAdapter().content(actor);
      return {
        actorId: actor.id,
        allowedCreators: new Set([
          actor.id,
          ...content.map((c) => c.author.id),
        ]),
        friendCreators: new Set(
          content
            .filter((c) => c.post.audience === "friends")
            .map((c) => c.author.id),
        ),
      };
    },
  );
  return state.commonPreviewMedia;
}
