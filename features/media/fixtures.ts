import type { MediaRecord } from "./contracts";
import type { ProfileIdentity } from "@/features/profiles/contracts";
const creators = {
  ava: {
    id: "demo-ava",
    name: "Ava Reed",
    username: "ava",
    bio: "Collecting small moments and creative experiments.",
  },
  noah: {
    id: "demo-noah",
    name: "Noah Ellis",
    username: "noah",
    bio: "Making thoughtful things with a community.",
  },
  milo: {
    id: "demo-milo",
    name: "Milo Chen",
    username: "milo",
    bio: "Gardens, books and shared tables.",
  },
};
export function mediaFixtures(now: number): MediaRecord[] {
  const make = (
    id: string,
    kind: MediaRecord["kind"],
    title: string,
    creator: keyof typeof creators,
    poster: string,
  ): MediaRecord => ({
    id,
    kind,
    title,
    description:
      "Repository-authored synthetic artwork. This is a viewing fixture, not screened or published user media.",
    creator: creators[creator],
    poster,
    asset: kind === "story" ? "image" : "video",
    src: kind === "story" ? poster : "/media/synthetic-motion.webm",
    captions: kind === "story" ? undefined : "/media/captions.vtt",
    transcript:
      "A synthetic landscape moves gently through the frame. This animation is bundled preview artwork, not a user upload.",
    duration: kind === "story" ? 8 : 6,
    expiresAt: kind === "story" ? now + 24 * 60 * 60 * 1000 : null,
    audience: "public",
    source: "fixture",
    publication: "FIXTURE",
    decision: null,
    distributionEnabled: false,
    creatorHighlight: false,
  });
  return [
    make(
      "story-coast",
      "story",
      "A slower morning",
      "ava",
      "/artwork/coast.svg",
    ),
    make(
      "story-garden",
      "story",
      "Room to grow",
      "milo",
      "/artwork/garden.svg",
    ),
    {
      ...make(
        "story-animation",
        "story",
        "A moving moment",
        "ava",
        "/artwork/coast.svg",
      ),
      asset: "video",
      src: "/media/synthetic-motion.webm",
      captions: "/media/captions.vtt",
      duration: 6,
    },
    {
      ...make(
        "story-highlight",
        "story",
        "The weekend collection",
        "noah",
        "/artwork/studio.svg",
      ),
      expiresAt: now - 1000,
      creatorHighlight: true,
    },
    make(
      "reel-quiet",
      "reel",
      "Six seconds of quiet",
      "ava",
      "/artwork/coast.svg",
    ),
    make(
      "reel-garden",
      "reel",
      "A little green inspiration",
      "noah",
      "/artwork/garden.svg",
    ),
    make(
      "video-studio",
      "video",
      "Inside the creative process",
      "noah",
      "/artwork/studio.svg",
    ),
    make(
      "video-coast",
      "video",
      "Finding a moment to pause",
      "ava",
      "/artwork/coast.svg",
    ),
    {
      ...make(
        "held-reel",
        "reel",
        "Held synthetic fixture",
        "ava",
        "/artwork/studio.svg",
      ),
      source: "author-draft",
      publication: "REVIEW_REQUIRED",
    },
    {
      ...make(
        "restricted-video",
        "video",
        "Restricted synthetic fixture",
        "noah",
        "/artwork/studio.svg",
      ),
      publication: "RESTRICTED",
    },
  ];
}
export function ownStoryFixture(
  actor: ProfileIdentity,
  now: number,
): MediaRecord {
  return {
    ...mediaFixtures(now)[0],
    id: `story-${actor.id}`,
    title: "Your synthetic story",
    creator: {
      id: actor.id,
      name: actor.displayName,
      username: actor.username,
      bio: actor.bio,
    },
    poster: "/artwork/garden.svg",
    src: "/artwork/garden.svg",
    audience: "private",
  };
}
