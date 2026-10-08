import "server-only";
import { randomUUID, createHash } from "node:crypto";
import type { FeedAdapter } from "./adapter";
import type { ProfilesAdapter } from "@/lib/profiles/adapter";
import type { ProfileIdentity } from "@/features/profiles/contracts";
import type {
  FeedPreferences,
  FeedPost,
  FeedComment,
  FeedOutcome,
  Reaction,
  ContentSource,
  FeedMode,
  Engagement,
  FeedRead,
  PostRead,
} from "@/features/feed/contracts";
import {
  feedCommand,
  feedQuery,
  type FeedCommand,
  type FeedQuery,
} from "@/features/feed/validation";
export const feedFailure = (
  code: import("@/features/auth/contracts").AuthErrorCode,
  message: string,
  retryable = false,
): { ok: false; error: import("@/features/auth/contracts").AuthError } => ({
  ok: false,
  error: { code, message, retryable },
});
type UserState = {
  preferences: Omit<FeedPreferences, "hiddenCount" | "muted">;
  hidden: Set<string>;
  muted: Map<string, string>;
  saved: Set<string>;
  reposted: Set<string>;
  versions: Map<string, number>;
  rankingVersion: number;
};
type StoredComment = {
  id: string;
  authorId: string;
  parentId: string | null;
  text: string;
  version: number;
  createdAt: string;
  edited: boolean;
  deleted: boolean;
};
export function createDevelopmentFeedAdapter(
  environment: { nodeEnv: string; mode: string },
  profiles: ProfilesAdapter,
  resolveIdentity: (id: string) => Promise<ProfileIdentity | null>,
  now = () => Date.now(),
): FeedAdapter {
  if (
    process.env.NODE_ENV === "production" ||
    environment.nodeEnv !== "development" ||
    environment.mode !== "mock"
  )
    throw new Error("Feed preview is disabled.");
  const users = new Map<string, UserState>();
  const reactions = new Map<string, Map<string, Reaction>>();
  const comments = new Map<string, StoredComment[]>();
  const cursors = new Map<
    string,
    {
      actorId: string;
      mode: FeedMode;
      ids: string[];
      offset: number;
      rankingVersion: number;
      expires: number;
    }
  >();
  const replays = new Map<
    string,
    { fingerprint: string; result: FeedOutcome; expires: number }
  >();
  const pageSize = 4;
  function state(actor: ProfileIdentity) {
    let value = users.get(actor.id);
    if (!value) {
      if (users.size >= 100) return null;
      value = {
        preferences: {
          defaultMode: "home",
          includeRecommendations: true,
          prioritizeFavorites: true,
          mediaOnly: false,
          version: 1,
        },
        hidden: new Set(),
        muted: new Map(),
        saved: new Set(),
        reposted: new Set(),
        versions: new Map(),
        rankingVersion: 1,
      };
      users.set(actor.id, value);
    }
    return value;
  }
  const authorized = async (actor: ProfileIdentity | null) =>
    !!actor && (await resolveIdentity(actor.id))?.id === actor.id;
  const preferences = (s: UserState): FeedPreferences => ({
    ...s.preferences,
    hiddenCount: s.hidden.size,
    muted: [...s.muted].map(([id, displayName]) => ({ id, displayName })),
  });
  async function commentView(
    actor: ProfileIdentity,
    postId: string,
  ): Promise<FeedComment[]> {
    const result: FeedComment[] = [];
    const rows = comments.get(postId) ?? [];
    for (const comment of rows) {
      if (comment.parentId && !result.some((p) => p.id === comment.parentId))
        continue;
      const person = await profiles.person(actor, comment.authorId);
      if (!person && !comment.deleted) continue;
      // A blocked or undiscoverable root hides its thread; tombstones carry no author/text.
      if (comment.deleted && !person) continue;
      result.push({
        id: comment.id,
        parentId: comment.parentId,
        author: comment.deleted ? null : person,
        text: comment.deleted ? "" : comment.text,
        version: comment.version,
        createdAt: comment.createdAt,
        edited: comment.edited,
        deleted: comment.deleted,
        canEdit: !comment.deleted && comment.authorId === actor.id,
      });
    }
    return result;
  }
  async function shape(
    actor: ProfileIdentity,
    source: ContentSource,
    s: UserState,
  ): Promise<FeedPost> {
    const id = source.post.id;
    const activeReactions = reactions.get(id) ?? new Map();
    let count = 0;
    for (const authorId of activeReactions.keys())
      if (await profiles.person(actor, authorId)) count++;
    const repostedBy = [];
    for (const [authorId, user] of users)
      if (user.reposted.has(id)) {
        const person = await profiles.person(actor, authorId);
        if (person) repostedBy.push(person);
      }
    const engagement: Engagement = {
      version: s.versions.get(id) ?? 0,
      reaction: activeReactions.get(actor.id) ?? null,
      reactions: count,
      saved: s.saved.has(id),
      reposted: s.reposted.has(id),
      comments: (await commentView(actor, id)).filter((c) => !c.deleted).length,
    };
    return {
      ...source.post,
      author: source.author,
      relationship: source.relationship,
      engagement,
      repostedBy,
      explanation:
        source.relationship.kind === "owner"
          ? "Your published preview post"
          : source.relationship.kind === "friend"
            ? "From a friend; audience permission checked"
            : source.relationship.following
              ? "From an account you follow"
              : "Public preview discovery; no ranking or AI service",
    };
  }
  async function sources(actor: ProfileIdentity) {
    return profiles.content(actor);
  }
  function eligible(
    source: ContentSource,
    mode: FeedMode,
    s: UserState,
    actor: ProfileIdentity,
    repostAuthorIds: string[] = [],
    friends = new Set<string>(),
    following = new Set<string>(),
  ) {
    if (mode === "saved") return s.saved.has(source.post.id);
    if (
      s.hidden.has(source.post.id) ||
      s.muted.has(source.author.id) ||
      (s.preferences.mediaOnly && !source.post.media)
    )
      return false;
    const r = source.relationship;
    if (mode === "friends")
      return (
        r.kind === "friend" || repostAuthorIds.some((id) => friends.has(id))
      );
    if (mode === "following")
      return r.following || repostAuthorIds.some((id) => following.has(id));
    if (mode === "recommended")
      return (
        source.author.id !== actor.id &&
        r.kind !== "friend" &&
        !r.following &&
        source.post.audience === "public"
      );
    if (mode === "home")
      return (
        repostAuthorIds.some(
          (id) => id === actor.id || friends.has(id) || following.has(id),
        ) ||
        r.kind === "owner" ||
        r.kind === "friend" ||
        r.following ||
        (s.preferences.includeRecommendations &&
          source.post.audience === "public")
      );
    return true;
  }
  function clean() {
    for (const [id, c] of cursors) if (c.expires <= now()) cursors.delete(id);
    for (const [id, r] of replays) if (r.expires <= now()) replays.delete(id);
  }
  async function read(
    actor: ProfileIdentity | null,
    input: FeedQuery,
  ): Promise<FeedRead> {
    if (!(await authorized(actor)))
      return feedFailure(
        "unauthorized",
        "Your session expired. Sign in again.",
      );
    const parsed = feedQuery.safeParse(input);
    if (!parsed.success)
      return feedFailure(
        "validation",
        "This feed link is invalid. Start from the first page.",
      );
    const s = state(actor!);
    if (!s)
      return feedFailure("unavailable", "Preview account capacity reached.");
    clean();
    const mode = parsed.data.mode ?? s.preferences.defaultMode;
    const connections = await profiles.connections(actor!);
    const friendIds = new Set(connections.friends.map((p) => p.id));
    const followingIds = new Set(connections.following.map((p) => p.id));
    const reposts = new Map<string, string[]>();
    for (const [authorId, user] of users)
      if (user.reposted.size && (await profiles.person(actor!, authorId)))
        for (const postId of user.reposted)
          reposts.set(postId, [...(reposts.get(postId) ?? []), authorId]);
    const all = (await sources(actor!)).filter((p) =>
      eligible(
        p,
        mode,
        s,
        actor!,
        reposts.get(p.post.id),
        friendIds,
        followingIds,
      ),
    );
    const byId = new Map(all.map((p) => [p.post.id, p]));
    const existing = parsed.data.cursor
      ? cursors.get(parsed.data.cursor)
      : undefined;
    if (
      parsed.data.cursor &&
      (!existing ||
        existing.actorId !== actor!.id ||
        existing.mode !== mode ||
        existing.rankingVersion !== s.rankingVersion)
    )
      return feedFailure(
        "conflict",
        "This feed page expired or preferences changed. Start from the first page.",
      );
    const sorted = [...all].sort((a, b) => {
      if (
        mode === "home" &&
        s.preferences.prioritizeFavorites &&
        a.relationship.favorite !== b.relationship.favorite
      )
        return a.relationship.favorite ? -1 : 1;
      return (
        b.post.date.localeCompare(a.post.date) ||
        a.post.id.localeCompare(b.post.id)
      );
    });
    const ids = existing?.ids ?? sorted.map((p) => p.post.id);
    let offset = existing?.offset ?? 0;
    const items: FeedPost[] = [];
    while (offset < ids.length && items.length < pageSize) {
      const source = byId.get(ids[offset++]);
      if (source) items.push(await shape(actor!, source, s));
    }
    let nextCursor: string | null = null;
    if (ids.slice(offset).some((id) => byId.has(id))) {
      if (cursors.size >= 1000) cursors.delete(cursors.keys().next().value!);
      nextCursor = randomUUID();
      cursors.set(nextCursor, {
        actorId: actor!.id,
        mode,
        ids,
        offset,
        rankingVersion: s.rankingVersion,
        expires: now() + 10 * 60_000,
      });
    }
    return {
      ok: true,
      page: { mode, items, nextCursor, preferences: preferences(s) },
    };
  }
  async function post(
    actor: ProfileIdentity | null,
    postId: string,
  ): Promise<PostRead> {
    if (!(await authorized(actor)))
      return feedFailure(
        "unauthorized",
        "Your session expired. Sign in again.",
      );
    const s = state(actor!);
    if (!s)
      return feedFailure("unavailable", "Preview account capacity reached.");
    const source = (await sources(actor!)).find((p) => p.post.id === postId);
    if (!source)
      return feedFailure(
        "forbidden",
        "This post is unavailable to this audience.",
      );
    return {
      ok: true,
      post: await shape(actor!, source, s),
      comments: await commentView(actor!, postId),
    };
  }
  async function execute(
    actor: ProfileIdentity | null,
    input: FeedCommand,
    requestId: string,
  ): Promise<FeedOutcome> {
    if (!(await authorized(actor)))
      return feedFailure(
        "unauthorized",
        "Your session expired. Sign in again.",
      );
    const parsed = feedCommand.safeParse(input);
    if (!parsed.success || !/^[a-zA-Z0-9-]{8,80}$/.test(requestId))
      return feedFailure("validation", "Check the supplied values.");
    const command = parsed.data;
    const s = state(actor!);
    if (!s)
      return feedFailure("unavailable", "Preview account capacity reached.");
    let source: ContentSource | undefined;
    if ("postId" in command) {
      source = (await sources(actor!)).find(
        (p) => p.post.id === command.postId,
      );
      if (!source)
        return feedFailure(
          "forbidden",
          "This post is unavailable to this audience.",
        );
    }
    clean();
    const replayKey = `${actor!.id}:${requestId}`;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(command))
      .digest("hex");
    const replay = replays.get(replayKey);
    if (replay)
      return replay.fingerprint === fingerprint
        ? replay.result
        : feedFailure(
            "conflict",
            "This request changed. Reload before trying again.",
          );
    let message = "";
    let sharePath: string | undefined;
    if (command.operation === "preferences") {
      if (s.preferences.version !== command.version)
        return feedFailure(
          "conflict",
          "Your preferences changed. Reload before saving.",
        );
      s.preferences = {
        defaultMode: command.defaultMode,
        includeRecommendations: command.includeRecommendations,
        prioritizeFavorites: command.prioritizeFavorites,
        mediaOnly: command.mediaOnly,
        version: s.preferences.version + 1,
      };
      s.rankingVersion++;
      message = "Feed preferences saved.";
    } else if (command.operation === "unmute") {
      s.muted.delete(command.authorId);
      message = "Account unmuted.";
    } else if (command.operation === "reset-hidden") {
      s.hidden.clear();
      message = "Hidden posts reset. Audience permissions still apply.";
    } else {
      const id = source!.post.id;
      if (
        (command.operation === "reaction" ||
          command.operation === "save" ||
          command.operation === "repost") &&
        command.version !== (s.versions.get(id) ?? 0)
      )
        return feedFailure(
          "conflict",
          "This interaction changed. Reload to reconcile it.",
        );
      switch (command.operation) {
        case "reaction": {
          const values = reactions.get(id) ?? new Map();
          if (command.value) values.set(actor!.id, command.value);
          else values.delete(actor!.id);
          reactions.set(id, values);
          message = command.value ? "Reaction updated." : "Reaction removed.";
          break;
        }
        case "save":
          if (command.enabled) s.saved.add(id);
          else s.saved.delete(id);
          message = command.enabled
            ? "Post saved."
            : "Post removed from saved.";
          break;
        case "repost":
          if (source!.post.audience !== "public")
            return feedFailure(
              "forbidden",
              "Only public posts can be reposted. Original audience restrictions remain authoritative.",
            );
          if (command.enabled) s.reposted.add(id);
          else s.reposted.delete(id);
          message = command.enabled
            ? "Public post reposted by reference."
            : "Repost removed.";
          break;
        case "hide":
          s.hidden.add(id);
          message = "Post hidden from feeds.";
          break;
        case "mute":
          if (source!.author.id === actor!.id)
            return feedFailure("validation", "You cannot mute yourself.");
          s.muted.set(source!.author.id, source!.author.displayName);
          message =
            "Account muted in feeds. Saved posts remain available if permitted.";
          break;
        case "share":
          sharePath = `/posts/${id}`;
          message =
            "Link prepared. It never grants access or changes the audience.";
          break;
        case "report-draft":
          message =
            "Preview report draft prepared. Nothing was sent to reviewers; no moderation service is connected.";
          break;
        case "comment": {
          const rows = comments.get(id) ?? [];
          if (rows.length >= 100)
            return feedFailure(
              "unavailable",
              "This preview thread reached its comment limit.",
            );
          if (
            command.parentId &&
            !(await commentView(actor!, id)).some(
              (c) => c.id === command.parentId && !c.parentId && !c.deleted,
            )
          )
            return feedFailure(
              "forbidden",
              "The reply target is unavailable. Replies support one level in this preview.",
            );
          rows.push({
            id: randomUUID(),
            authorId: actor!.id,
            parentId: command.parentId,
            text: command.text,
            version: 1,
            createdAt: new Date(now()).toISOString(),
            edited: false,
            deleted: false,
          });
          comments.set(id, rows);
          message = command.parentId ? "Reply added." : "Comment added.";
          break;
        }
        case "edit-comment":
        case "delete-comment": {
          const row = (comments.get(id) ?? []).find(
            (c) => c.id === command.commentId,
          );
          if (
            !row ||
            row.authorId !== actor!.id ||
            row.deleted ||
            !(await commentView(actor!, id)).some((c) => c.id === row.id)
          )
            return feedFailure(
              "forbidden",
              "Only the author can edit or delete this permitted comment.",
            );
          if (row.version !== command.version)
            return feedFailure(
              "conflict",
              "This comment changed. Reload before editing.",
            );
          if (command.operation === "edit-comment") {
            row.text = command.text;
            row.edited = true;
            message = "Comment updated.";
          } else {
            row.text = "";
            row.deleted = true;
            message =
              "Comment deleted. Replies retain their permitted context.";
          }
          row.version++;
          break;
        }
      }
      if (
        command.operation === "reaction" ||
        command.operation === "save" ||
        command.operation === "repost"
      )
        s.versions.set(id, (s.versions.get(id) ?? 0) + 1);
    }
    const result: FeedOutcome = {
      ok: true,
      message,
      ...(sharePath ? { sharePath } : {}),
    };
    if (replays.size >= 1000) replays.delete(replays.keys().next().value!);
    replays.set(replayKey, {
      fingerprint,
      result,
      expires: now() + 5 * 60_000,
    });
    return result;
  }
  const locks = new Map<string, Promise<void>>();
  async function serializedExecute(
    actor: ProfileIdentity | null,
    command: FeedCommand,
    requestId: string,
  ) {
    if (!(await authorized(actor)))
      return feedFailure(
        "unauthorized",
        "Your session expired. Sign in again.",
      );
    const previous = locks.get(actor!.id);
    let release!: () => void;
    const current = new Promise<void>((done) => {
      release = done;
    });
    locks.set(actor!.id, current);
    try {
      await previous;
      return await execute(actor, command, requestId);
    } finally {
      release();
      if (locks.get(actor!.id) === current) locks.delete(actor!.id);
    }
  }
  return { read, post, execute: serializedExecute };
}
