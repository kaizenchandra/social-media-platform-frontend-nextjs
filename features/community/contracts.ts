export type Membership = "none" | "requested" | "member" | "admin";
export type CommunityPost = {
  id: string;
  authorId: string;
  text: string;
  topic: string;
  announcement: boolean;
};
export type CommunityEvent = {
  id: string;
  authorId: string;
  title: string;
  date: string;
  going: string[];
  discussions: { authorId: string; text: string }[];
};
export type Community = {
  id: string;
  name: string;
  description: string;
  visibility: "public" | "private";
  ownerId: string;
  version: number;
  members: Record<string, Membership>;
  posts: CommunityPost[];
  topics: string[];
  events: CommunityEvent[];
};
export type CommunityCard = Pick<
  Community,
  "id" | "name" | "description" | "visibility" | "version"
> & { membership: Membership };
export type CommunityDetail = CommunityCard & {
  posts: CommunityPost[];
  topics: string[];
  events: CommunityEvent[];
  members: { id: string; role: Membership }[];
  canRead: boolean;
  canManage: boolean;
};
export type BusinessPage = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  version: number;
};
export type SearchHit = {
  id: string;
  kind: "community" | "post" | "event" | "page" | "profile" | "video";
  title: string;
  excerpt: string;
  href: string;
};
export type Outcome = { ok: boolean; message: string };
