import type { AuthError } from "@/features/auth/contracts";
import type {
  Person,
  ProfilePost,
  Relationship,
} from "@/features/profiles/contracts";
export const feedModes = [
  "home",
  "friends",
  "following",
  "chronological",
  "recommended",
  "saved",
] as const;
export type FeedMode = (typeof feedModes)[number];
export type Reaction = "like" | "love" | "support";
export type Engagement = {
  version: number;
  reaction: Reaction | null;
  reactions: number;
  saved: boolean;
  reposted: boolean;
  comments: number;
};
export type FeedPost = ProfilePost & {
  author: Person;
  relationship: Relationship;
  engagement: Engagement;
  repostedBy: Person[];
  explanation: string;
};
export type FeedComment = {
  id: string;
  parentId: string | null;
  author: Person | null;
  text: string;
  version: number;
  createdAt: string;
  edited: boolean;
  deleted: boolean;
  canEdit: boolean;
};
export type FeedPreferences = {
  defaultMode: Exclude<FeedMode, "saved">;
  includeRecommendations: boolean;
  prioritizeFavorites: boolean;
  mediaOnly: boolean;
  version: number;
  hiddenCount: number;
  muted: { id: string; displayName: string }[];
};
export type FeedPage = {
  mode: FeedMode;
  items: FeedPost[];
  nextCursor: string | null;
  preferences: FeedPreferences;
};
export type FeedRead =
  { ok: true; page: FeedPage } | { ok: false; error: AuthError };
export type PostRead =
  | { ok: true; post: FeedPost; comments: FeedComment[] }
  | { ok: false; error: AuthError };
export type FeedOutcome =
  | { ok: true; message: string; sharePath?: string }
  | { ok: false; error: AuthError };
export type ContentSource = {
  author: Person;
  relationship: Relationship;
  post: ProfilePost;
};
