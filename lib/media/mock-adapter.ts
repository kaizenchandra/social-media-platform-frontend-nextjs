import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type {
  AccessContext,
  MediaItem,
  MediaOutcome,
  MediaRecord,
  VideoComment,
} from "@/features/media/contracts";
import type { ProfileIdentity } from "@/features/profiles/contracts";
import type { MediaAdapter } from "./adapter";
import { mediaFixtures, ownStoryFixture } from "@/features/media/fixtures";
import { canViewMedia } from "@/features/media/policy";
import { mediaCommand, type MediaCommand } from "@/features/media/validation";
export const mediaFailure = (
  code: import("@/features/media/contracts").MediaError["code"],
  message: string,
  retryable = false,
) => ({ ok: false as const, error: { code, message, retryable } });
type User = {
  saved: Set<string>;
  reactions: Map<string, "love" | "like">;
  highlights: Set<string>;
};
export function createDevelopmentMediaAdapter(
  environment: { nodeEnv: string; mode: string },
  resolveIdentity: (id: string) => Promise<ProfileIdentity | null>,
  access: (actor: ProfileIdentity) => Promise<AccessContext>,
  now = () => Date.now(),
): MediaAdapter {
  if (
    process.env.NODE_ENV === "production" ||
    environment.nodeEnv !== "development" ||
    environment.mode !== "mock"
  )
    throw new Error("Media preview is disabled.");
  const records = new Map(mediaFixtures(now()).map((item) => [item.id, item]));
  const users = new Map<string, User>();
  const comments = new Map<string, VideoComment[]>();
  const replays = new Map<string, { fingerprint: string; expires: number }>();
  async function context(actor: ProfileIdentity) {
    const identity = await resolveIdentity(actor.id);
    if (!identity) return null;
    if (!users.has(actor.id)) {
      if (users.size >= 100) return null;
      users.set(actor.id, {
        saved: new Set(),
        reactions: new Map(),
        highlights: new Set(),
      });
      const own = ownStoryFixture(identity, now());
      records.set(own.id, own);
    }
    return {
      access: await access(identity),
      user: users.get(actor.id)!,
      identity,
    };
  }
  function effective(item: MediaRecord): MediaRecord {
    return {
      ...item,
      creatorHighlight:
        item.creatorHighlight ||
        !!users.get(item.creator.id)?.highlights.has(item.id),
    };
  }
  function project(item: MediaRecord, user: User): MediaItem {
    return {
      ...effective(item),
      saved: user.saved.has(item.id),
      reaction: user.reactions.get(item.id) ?? null,
      highlighted: effective(item).creatorHighlight,
    };
  }
  const denied = () =>
    mediaFailure(
      "forbidden",
      "This media is unavailable, expired, restricted, or outside your audience.",
    );
  async function catalog(actor: ProfileIdentity) {
    const ctx = await context(actor);
    if (!ctx)
      return mediaFailure(
        "unauthorized",
        "Your session is unavailable. Sign in again.",
      );
    return {
      ok: true as const,
      catalog: {
        items: [...records.values()]
          .map(effective)
          .filter((item) => canViewMedia(item, ctx.access, now()))
          .map((item) => project(item, ctx.user)),
        mode: "fixture-preview" as const,
        generatedAt: now(),
      },
    };
  }
  async function read(actor: ProfileIdentity, id: string) {
    const ctx = await context(actor);
    if (!ctx)
      return mediaFailure(
        "unauthorized",
        "Your session is unavailable. Sign in again.",
      );
    const item = records.get(id);
    if (!item || !canViewMedia(effective(item), ctx.access, now()))
      return denied();
    return {
      ok: true as const,
      item: project(item, ctx.user),
      comments: structuredClone(comments.get(id) ?? []),
      generatedAt: now(),
    };
  }
  async function execute(
    actor: ProfileIdentity,
    input: MediaCommand,
    requestId: string,
  ): Promise<MediaOutcome> {
    const parsed = mediaCommand.safeParse(input);
    if (!parsed.success || !/^[a-zA-Z0-9-]{8,80}$/.test(requestId))
      return mediaFailure("validation", "Check the supplied media action.");
    const command = parsed.data;
    const ctx = await context(actor);
    if (!ctx)
      return mediaFailure(
        "unauthorized",
        "Your session is unavailable. Sign in again.",
      );
    const item = records.get(command.id);
    if (!item || !canViewMedia(effective(item), ctx.access, now()))
      return denied();
    const key = `${actor.id}:${requestId}`;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(command))
      .digest("hex");
    for (const [id, entry] of replays)
      if (entry.expires <= now()) replays.delete(id);
    const replay = replays.get(key);
    if (replay && replay.fingerprint !== fingerprint)
      return mediaFailure(
        "conflict",
        "This request ID was already used for a different action.",
      );
    if (!replay) {
      switch (command.operation) {
        case "save":
          if (item.kind === "story")
            return mediaFailure(
              "validation",
              "Use story highlights for your own stories.",
            );
          if (command.value) ctx.user.saved.add(item.id);
          else ctx.user.saved.delete(item.id);
          break;
        case "reaction":
          if (command.value) ctx.user.reactions.set(item.id, command.value);
          else ctx.user.reactions.delete(item.id);
          break;
        case "highlight":
          if (item.kind !== "story" || item.creator.id !== actor.id)
            return mediaFailure(
              "forbidden",
              "Only the story creator can change its highlights.",
            );
          if (command.value) ctx.user.highlights.add(item.id);
          else ctx.user.highlights.delete(item.id);
          break;
        case "comment": {
          if (item.kind === "story")
            return mediaFailure(
              "validation",
              "Story replies are not connected.",
            );
          const list = comments.get(item.id) ?? [];
          if (list.length >= 100)
            return mediaFailure("validation", "Preview comment limit reached.");
          list.push({
            id: randomUUID(),
            authorId: actor.id,
            name: ctx.identity.displayName,
            text: command.text,
            sequence: list.length + 1,
          });
          comments.set(item.id, list);
          break;
        }
        case "share":
          break;
      }
      if (replays.size >= 1000) replays.delete(replays.keys().next().value!);
      replays.set(key, { fingerprint, expires: now() + 5 * 60 * 1000 });
    }
    // Removing an expired highlight may revoke the final visible projection.
    if (!canViewMedia(effective(item), ctx.access, now())) return denied();
    return {
      ok: true,
      item: project(item, ctx.user),
      comments: structuredClone(comments.get(item.id) ?? []),
      ...(command.operation === "share"
        ? {
            sharePath:
              item.kind === "video"
                ? `/videos/${item.id}`
                : `/${item.kind === "story" ? "stories" : "reels"}?item=${item.id}`,
          }
        : {}),
    };
  }
  return { catalog, read, execute };
}
