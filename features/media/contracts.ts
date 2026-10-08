import type {
  PublicationState,
  Decision,
} from "@/features/publication/contracts";
export type MediaKind = "story" | "reel" | "video";
export type MediaRecord = {
  id: string;
  kind: MediaKind;
  title: string;
  description: string;
  creator: { id: string; name: string; username: string; bio: string };
  poster: string;
  asset: "image" | "video";
  src: string;
  captions?: string;
  transcript: string;
  duration: number;
  expiresAt: number | null;
  audience: "public" | "friends" | "private";
  source: "fixture" | "service" | "author-draft";
  publication: "FIXTURE" | PublicationState;
  decision: Decision | null;
  distributionEnabled: boolean;
  creatorHighlight: boolean;
};
export type MediaItem = MediaRecord & {
  saved: boolean;
  reaction: "love" | "like" | null;
  highlighted: boolean;
};
export type VideoComment = {
  id: string;
  authorId: string;
  name: string;
  text: string;
  sequence: number;
};
export type Catalog = {
  items: MediaItem[];
  mode: "fixture-preview";
  generatedAt: number;
};
export type MediaError = {
  code:
    | "unavailable"
    | "forbidden"
    | "unauthorized"
    | "validation"
    | "network"
    | "conflict";
  message: string;
  retryable: boolean;
};
export type CatalogResult =
  { ok: true; catalog: Catalog } | { ok: false; error: MediaError };
export type MediaRead =
  | { ok: true; item: MediaItem; comments: VideoComment[]; generatedAt: number }
  | { ok: false; error: MediaError };
export type MediaOutcome =
  | { ok: true; item: MediaItem; comments: VideoComment[]; sharePath?: string }
  | { ok: false; error: MediaError };
export type AccessContext = {
  actorId: string;
  allowedCreators: ReadonlySet<string>;
  friendCreators: ReadonlySet<string>;
};
export type LiveCapabilities = {
  provider: "unavailable" | "integrated";
  ingest: boolean;
  authorizedPlayback: boolean;
  eligibility: boolean;
  continuousMonitoring: boolean;
  emergencyInterruption: boolean;
  reporting: boolean;
  captions: boolean;
};
export type LivePreviewState =
  | "unavailable"
  | "connecting-preview"
  | "disconnected-preview"
  | "interrupted-preview";
