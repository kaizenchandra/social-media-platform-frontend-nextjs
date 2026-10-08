import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { createDevelopmentFeedAdapter } from "@/lib/feed/mock-adapter";
import { createDevelopmentProfilesAdapter } from "@/lib/profiles/mock-adapter";
import type {
  ProfileIdentity,
  GraphOperation,
} from "@/features/profiles/contracts";
import type { FeedRead, PostRead, FeedMode } from "@/features/feed/contracts";
import type { FeedCommand } from "@/features/feed/validation";
const first: ProfileIdentity = {
  id: "account-first",
  username: "first",
  displayName: "First preview",
  bio: "",
  version: 1,
};
const second: ProfileIdentity = {
  ...first,
  id: "account-second",
  username: "second",
  displayName: "Second preview",
};
function setup() {
  const identities = new Map([
    [first.id, first],
    [second.id, second],
  ]);
  const resolve = async (id: string) =>
    identities.get(id) ??
    [...identities.values()].find((p) => p.username === id) ??
    null;
  const profiles = createDevelopmentProfilesAdapter(
    { nodeEnv: "development", mode: "mock" },
    resolve,
  );
  let time = Date.now();
  const feed = createDevelopmentFeedAdapter(
    { nodeEnv: "development", mode: "mock" },
    profiles,
    resolve,
    () => time,
  );
  const execute = (command: FeedCommand, actor = first, id = randomUUID()) =>
    feed.execute(actor, command, id);
  const graph = async (
    operation: GraphOperation,
    target: string,
    actor = first,
  ) => {
    const p = await profiles.profile(actor, target);
    if (p.kind !== "visible") throw new Error("Missing profile");
    return profiles.execute(
      actor,
      { operation, targetId: p.person.id, version: p.relationship.version },
      randomUUID(),
      async () => ({ ok: true, message: "Saved" }),
    );
  };
  return {
    feed,
    profiles,
    identities,
    execute,
    graph,
    advance: () => {
      time += 11 * 60_000;
    },
  };
}
function page(read: FeedRead) {
  if (!read.ok) throw new Error(read.error.message);
  return read.page;
}
function post(read: PostRead) {
  if (!read.ok) throw new Error(read.error.message);
  return read;
}
async function all(
  ctx: ReturnType<typeof setup>,
  mode: FeedMode,
  actor = first,
) {
  let result = page(await ctx.feed.read(actor, { mode }));
  const items = [...result.items];
  while (result.nextCursor) {
    result = page(
      await ctx.feed.read(actor, { mode, cursor: result.nextCursor }),
    );
    items.push(...result.items);
  }
  return items;
}
describe("Feed authority, pagination and engagement", () => {
  it("fails closed and excludes pending/restricted media and other people's private posts", async () => {
    const ctx = setup();
    expect(() =>
      createDevelopmentFeedAdapter(
        { nodeEnv: "production", mode: "mock" },
        ctx.profiles,
        async () => first,
      ),
    ).toThrow();
    expect(await ctx.feed.read(null, {})).toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    const items = await all(ctx, "chronological");
    expect(
      items.some((p) => p.audience === "private" && p.author.id !== first.id),
    ).toBe(false);
    expect(JSON.stringify(items)).not.toMatch(
      /Awaiting screening|Restricted media fixture|This pending fixture|email|sessionToken/,
    );
    for (const id of [
      "demo-noah-pending",
      "demo-noah-restricted",
      "demo-noah-private",
    ]) {
      expect(await ctx.feed.post(first, id)).toMatchObject({
        ok: false,
        error: { code: "forbidden" },
      });
      expect(
        await ctx.execute({ operation: "share", postId: id }),
      ).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
  });
  it("paginates a stable chronological snapshot without duplicates and scopes expiring cursors", async () => {
    const ctx = setup();
    const initial = page(await ctx.feed.read(first, { mode: "chronological" }));
    expect(initial.items).toHaveLength(4);
    expect(initial.nextCursor).toBeTruthy();
    const items = await all(ctx, "chronological");
    expect(new Set(items.map((p) => p.id)).size).toBe(items.length);
    expect(items.map((p) => p.date)).toEqual(
      items
        .map((p) => p.date)
        .sort()
        .reverse(),
    );
    for (const [actor, mode] of [
      [second, "chronological"],
      [first, "following"],
    ] as const) {
      expect(
        await ctx.feed.read(actor, { mode, cursor: initial.nextCursor! }),
      ).toMatchObject({ ok: false, error: { code: "conflict" } });
    }
    ctx.advance();
    expect(
      await ctx.feed.read(first, {
        mode: "chronological",
        cursor: initial.nextCursor!,
      }),
    ).toMatchObject({ ok: false, error: { code: "conflict" } });
  });
  it("separates friendship/following/discovery and handles empty feeds and media preferences", async () => {
    const ctx = setup();
    expect(
      (await all(ctx, "friends")).every((p) => p.author.username === "noah"),
    ).toBe(true);
    expect((await all(ctx, "following")).map((p) => p.author.username)).toEqual(
      ["ava"],
    );
    expect(
      (await all(ctx, "recommended")).every(
        (p) =>
          p.audience === "public" &&
          p.relationship.kind !== "friend" &&
          !p.relationship.following,
      ),
    ).toBe(true);
    expect(await all(ctx, "saved")).toEqual([]);
    await ctx.graph("unfollow", "ava");
    expect(await all(ctx, "following")).toEqual([]);
    const initial = page(await ctx.feed.read(first, {}));
    expect(
      (
        await ctx.execute({
          operation: "preferences",
          version: initial.preferences.version,
          defaultMode: "chronological",
          includeRecommendations: false,
          prioritizeFavorites: false,
          mediaOnly: true,
        })
      ).ok,
    ).toBe(true);
    expect(page(await ctx.feed.read(first, {})).mode).toBe("chronological");
    expect((await all(ctx, "chronological")).every((p) => !!p.media)).toBe(
      true,
    );
    expect(
      await ctx.feed.read(first, { mode: "home", cursor: initial.nextCursor! }),
    ).toMatchObject({ ok: false, error: { code: "conflict" } });
  });
  it("reconciles versioned reactions/saves, deduplicates retries and rejects reused request IDs", async () => {
    const ctx = setup();
    const id = "demo-ava-public",
      request = randomUUID();
    const command: FeedCommand = {
      operation: "reaction",
      postId: id,
      version: 0,
      value: "like",
    };
    expect((await ctx.execute(command, first, request)).ok).toBe(true);
    expect((await ctx.execute(command, first, request)).ok).toBe(true);
    expect(post(await ctx.feed.post(first, id)).post.engagement).toMatchObject({
      reaction: "like",
      reactions: 1,
      version: 1,
    });
    expect(await ctx.execute({ ...command, value: "love" })).toMatchObject({
      ok: false,
      error: { code: "conflict" },
    });
    expect(
      await ctx.execute(
        { ...command, value: "love", version: 1 },
        first,
        request,
      ),
    ).toMatchObject({ ok: false, error: { code: "conflict" } });
    await ctx.execute({
      operation: "save",
      postId: id,
      version: 1,
      enabled: true,
    });
    expect((await all(ctx, "saved")).map((p) => p.id)).toEqual([id]);
    await ctx.execute({
      operation: "reaction",
      postId: id,
      version: 2,
      value: null,
    });
    expect(post(await ctx.feed.post(first, id)).post.engagement.reactions).toBe(
      0,
    );
  });
  it("rechecks revoked permissions before pagination, saved reads, sharing and successful replay", async () => {
    const ctx = setup();
    const initial = page(await ctx.feed.read(first, { mode: "chronological" }));
    const id = "demo-noah-friends",
      request = randomUUID();
    const command: FeedCommand = {
      operation: "save",
      postId: id,
      version: 0,
      enabled: true,
    };
    await ctx.execute(command, first, request);
    await ctx.graph("unfriend", "noah");
    expect(await ctx.execute(command, first, request)).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(await all(ctx, "saved")).toEqual([]);
    expect(await ctx.feed.post(first, id)).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(
      page(
        await ctx.feed.read(first, {
          mode: "chronological",
          cursor: initial.nextCursor!,
        }),
      ).items.some((p) => p.id === id),
    ).toBe(false);
    ctx.identities.delete(first.id);
    expect(await ctx.execute(command, first, request)).toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
  });
  it("reposts public originals by reference and never bypasses original or repost-author permissions", async () => {
    const ctx = setup();
    await ctx.graph("follow", "first", second);
    await ctx.execute({
      operation: "repost",
      postId: "demo-leila-public",
      enabled: true,
      version: 0,
    });
    expect(
      (await all(ctx, "following", second)).filter(
        (p) => p.id === "demo-leila-public",
      ),
    ).toHaveLength(1);
    expect(
      await ctx.execute({
        operation: "repost",
        postId: "account-first-private",
        enabled: true,
        version: 0,
      }),
    ).toMatchObject({ ok: false, error: { code: "forbidden" } });
    await ctx.graph("block", "leila", second);
    expect(
      (await all(ctx, "following", second)).some(
        (p) => p.id === "demo-leila-public",
      ),
    ).toBe(false);
  });
  it("hides/mutes reversibly without changing saved access and provides only permission-bound sharing/report drafts", async () => {
    const ctx = setup();
    const id = "demo-ava-public";
    await ctx.execute({
      operation: "save",
      postId: id,
      version: 0,
      enabled: true,
    });
    await ctx.execute({ operation: "hide", postId: id });
    expect(await all(ctx, "following")).toEqual([]);
    expect(await all(ctx, "saved")).toHaveLength(1);
    await ctx.execute({ operation: "reset-hidden" });
    await ctx.execute({ operation: "mute", postId: id });
    expect(await all(ctx, "following")).toEqual([]);
    await ctx.execute({ operation: "unmute", authorId: "demo-ava" });
    expect(await all(ctx, "following")).toHaveLength(1);
    expect(await ctx.execute({ operation: "share", postId: id })).toMatchObject(
      { ok: true, sharePath: `/posts/${id}` },
    );
    expect(
      await ctx.execute({
        operation: "report-draft",
        postId: id,
        reason: "privacy",
        details: "Synthetic concern",
      }),
    ).toMatchObject({
      ok: true,
      message: expect.stringContaining("Nothing was sent"),
    });
  });
  it("deduplicates simultaneous comments, enforces reply/author/version rules and erases deleted text", async () => {
    const ctx = setup(),
      id = "demo-ava-public",
      request = randomUUID();
    const command: FeedCommand = {
      operation: "comment",
      postId: id,
      parentId: null,
      text: "Synthetic root",
    };
    await Promise.all([
      ctx.execute(command, first, request),
      ctx.execute(command, first, request),
    ]);
    const root = post(await ctx.feed.post(first, id)).comments[0];
    expect(post(await ctx.feed.post(first, id)).comments).toHaveLength(1);
    await ctx.execute(
      { ...command, parentId: root.id, text: "Synthetic reply" },
      second,
    );
    const reply = post(await ctx.feed.post(first, id)).comments[1];
    expect(await ctx.execute({ ...command, parentId: reply.id })).toMatchObject(
      { ok: false, error: { code: "forbidden" } },
    );
    expect(
      await ctx.execute(
        {
          operation: "delete-comment",
          postId: id,
          commentId: root.id,
          version: 1,
        },
        second,
      ),
    ).toMatchObject({ ok: false, error: { code: "forbidden" } });
    await ctx.execute({
      operation: "edit-comment",
      postId: id,
      commentId: root.id,
      version: 1,
      text: "Edited synthetic root",
    });
    expect(
      await ctx.execute({
        operation: "delete-comment",
        postId: id,
        commentId: root.id,
        version: 1,
      }),
    ).toMatchObject({ ok: false, error: { code: "conflict" } });
    await ctx.execute({
      operation: "delete-comment",
      postId: id,
      commentId: root.id,
      version: 2,
    });
    const read = post(await ctx.feed.post(first, id));
    expect(read.comments[0]).toMatchObject({
      deleted: true,
      text: "",
      author: null,
      canEdit: false,
    });
    expect(read.comments[1].text).toBe("Synthetic reply");
    expect(JSON.stringify(read)).not.toContain("Edited synthetic root");
    expect(read.post.engagement.comments).toBe(1);
  });
  it("filters blocked comment authors and their threads before serialization", async () => {
    const ctx = setup(),
      id = "demo-ava-public";
    await ctx.execute(
      {
        operation: "comment",
        postId: id,
        parentId: null,
        text: "Second actor root",
      },
      second,
    );
    const root = post(await ctx.feed.post(first, id)).comments[0];
    await ctx.execute({
      operation: "comment",
      postId: id,
      parentId: root.id,
      text: "First reply",
    });
    await ctx.graph("block", "second");
    expect(post(await ctx.feed.post(first, id)).comments).toEqual([]);
    expect(JSON.stringify(post(await ctx.feed.post(first, id)))).not.toContain(
      "Second actor root",
    );
  });
});
