import type { AuthError } from "@/features/auth/contracts";
export const previewProfileUsernames: readonly string[] = [
  "ava",
  "milo",
  "noah",
  "leila",
  "quinn",
];
export type Audience = "public" | "friends" | "private";
export type ProfileIdentity = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  version: number;
};
export const artwork = {
  coast: { src: "/artwork/coast.svg", label: "Quiet coast" },
  garden: { src: "/artwork/garden.svg", label: "Community garden" },
  studio: { src: "/artwork/studio.svg", label: "Creative studio" },
} as const;
export type ArtworkKey = keyof typeof artwork;
export type Person = {
  id: string;
  username: string;
  displayName: string;
  avatar: ArtworkKey;
};
export type Relationship = {
  kind: "owner" | "friend" | "follower" | "visitor" | "blocked";
  request: "none" | "incoming" | "outgoing";
  following: boolean;
  followedBy: boolean;
  favorite: boolean;
  restricted: boolean;
  blockedByMe: boolean;
  version: number;
};
export type ProfilePost = {
  id: string;
  title: string;
  text: string;
  audience: Audience;
  date: string;
  media?: ArtworkKey;
};
export type ProfileView = {
  kind: "visible";
  person: Person;
  bio: string;
  cover: ArtworkKey;
  version: string;
  relationship: Relationship;
  canAct: boolean;
  details: { location: string; work: string; website: string } | null;
  settings: {
    visibility: Audience;
    detailsAudience: Audience;
    connectionsAudience: Audience;
  } | null;
  posts: ProfilePost[];
  featured: ProfilePost[];
  media: ProfilePost[];
  connections: {
    friends: Person[];
    followers: Person[];
    following: Person[];
    mutual: Person[];
  } | null;
};
export type ProfileRead = ProfileView | { kind: "unavailable" };
export type ConnectionPerson = Person & {
  relationship: Relationship;
  mutualCount: number;
};
export type ConnectionsView = {
  incoming: ConnectionPerson[];
  outgoing: ConnectionPerson[];
  friends: ConnectionPerson[];
  followers: ConnectionPerson[];
  following: ConnectionPerson[];
  suggestions: ConnectionPerson[];
  favorites: ConnectionPerson[];
  blocked: ConnectionPerson[];
  restricted: ConnectionPerson[];
};
export type ProfileOutcome =
  { ok: true; message: string } | { ok: false; error: AuthError };
export type GraphOperation =
  | "request"
  | "accept"
  | "reject"
  | "cancel"
  | "unfriend"
  | "follow"
  | "unfollow"
  | "favorite"
  | "unfavorite"
  | "block"
  | "unblock"
  | "restrict"
  | "unrestrict";
