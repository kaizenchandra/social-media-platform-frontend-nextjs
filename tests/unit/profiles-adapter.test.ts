import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { createDevelopmentProfilesAdapter } from "@/lib/profiles/mock-adapter";
import type {
  ProfileIdentity,
  ProfileView,
  GraphOperation,
  ProfileRead,
} from "@/features/profiles/contracts";
import { profileCommand } from "@/features/profiles/validation";
import { safeReturnTo } from "@/features/auth/validation";
const actor: ProfileIdentity = {
  id: "account-first",
  username: "first",
  displayName: "Synthetic first",
  bio: "Synthetic bio",
  version: 1,
};
const second: ProfileIdentity = {
  id: "account-second",
  username: "second",
  displayName: "Synthetic second",
  bio: "",
  version: 1,
};
function setup() {
  const identities = new Map([
    [actor.id, { ...actor }],
    [second.id, { ...second }],
  ]);
  const adapter = createDevelopmentProfilesAdapter(
    { nodeEnv: "development", mode: "mock" },
    async (id) =>
      identities.get(id) ??
      [...identities.values()].find((person) => person.username === id) ??
      null,
  );
  const save = vi.fn(async (name: string, bio: string, version: number) => {
    const identity = identities.get(actor.id)!;
    if (version !== identity.version)
      return {
        ok: false as const,
        error: {
          code: "conflict" as const,
          message: "Identity changed",
          retryable: false,
        },
      };
    identity.displayName = name;
    identity.bio = bio;
    identity.version++;
    return { ok: true as const, message: "Saved" };
  });
  return { adapter, save, identities };
}
function visible(value: ProfileRead): ProfileView {
  expect(value.kind).toBe("visible");
  if (value.kind !== "visible") throw new Error("Expected visible profile");
  return value;
}
const edit = (profile: ProfileView) => ({
  operation: "edit" as const,
  version: profile.version,
  displayName: profile.person.displayName,
  bio: profile.bio,
  location: "Private location",
  work: "Private work",
  website: "https://example.test",
  avatar: "studio" as const,
  cover: "coast" as const,
  visibility: "public" as const,
  detailsAudience: "friends" as const,
  connectionsAudience: "friends" as const,
});
async function graph(
  ctx: ReturnType<typeof setup>,
  action: GraphOperation,
  target: string,
  who = actor,
  version?: number,
  id = randomUUID(),
) {
  const profile = visible(await ctx.adapter.profile(who, target));
  return ctx.adapter.execute(
    who,
    {
      operation: action,
      targetId: profile.person.id,
      version: version ?? profile.relationship.version,
    },
    id,
    ctx.save,
  );
}
describe("Profile data minimization and graph authority", () => {
  it("fails closed outside explicit development mode and validates assets, URLs and redirects", () => {
    expect(() =>
      createDevelopmentProfilesAdapter(
        { nodeEnv: "production", mode: "mock" },
        async () => null,
      ),
    ).toThrow();
    expect(() =>
      createDevelopmentProfilesAdapter(
        { nodeEnv: "development", mode: "unavailable" },
        async () => null,
      ),
    ).toThrow();
    expect(safeReturnTo("/profile")).toBe("/profile");
    expect(safeReturnTo("/connections")).toBe("/connections");
    expect(safeReturnTo("//evil.test")).toBe("/account");
    expect(
      profileCommand.safeParse({
        ...edit({
          person: actor,
          bio: "",
          version: "1:1",
        } as unknown as ProfileView),
        avatar: "https://evil.test/a.png",
      }).success,
    ).toBe(false);
    expect(
      profileCommand.safeParse({
        ...edit({
          person: actor,
          bio: "",
          version: "1:1",
        } as unknown as ProfileView),
        website: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
  it("returns only public posts to guests/followers, friend posts to friends, all published posts to owners, and never pending payloads", async () => {
    const { adapter } = setup();
    const own = visible(await adapter.profile(actor));
    expect(own.posts.map((p) => p.audience)).toEqual([
      "public",
      "friends",
      "private",
    ]);
    expect(
      visible(await adapter.profile(actor, "noah")).relationship.kind,
    ).toBe("friend");
    expect(visible(await adapter.profile(actor, "noah")).posts).toHaveLength(2);
    const follower = visible(await adapter.profile(actor, "ava"));
    expect(follower.relationship.kind).toBe("follower");
    expect(follower.posts).toHaveLength(1);
    expect(follower.details).toBeNull();
    expect(follower.connections).toBeNull();
    const newlyOnboarded = visible(await adapter.profile(null, "second"));
    expect(newlyOnboarded.posts).toHaveLength(1);
    const guest = visible(await adapter.profile(null, "first"));
    expect(guest.canAct).toBe(false);
    expect(guest.posts).toHaveLength(1);
    expect(guest.settings).toBeNull();
    expect(JSON.stringify(own)).not.toContain("Awaiting screening");
    expect(JSON.stringify(guest)).not.toContain("Notes for myself");
  });
  it("enforces private/friends profiles and audience settings at read boundaries", async () => {
    const ctx = setup();
    const own = visible(await ctx.adapter.profile(actor));
    expect(
      (
        await ctx.adapter.execute(
          actor,
          { ...edit(own), visibility: "private" },
          randomUUID(),
          ctx.save,
        )
      ).ok,
    ).toBe(true);
    expect(await ctx.adapter.profile(null, "first")).toEqual({
      kind: "unavailable",
    });
    expect(await ctx.adapter.profile(second, "first")).toEqual({
      kind: "unavailable",
    });
    expect(
      visible(await ctx.adapter.profile(ctx.identities.get(actor.id)!)).details
        ?.location,
    ).toBe("Private location");
  });
  it("allows only recipients to accept/reject and senders to cancel, then transitions into and out of friendship", async () => {
    const ctx = setup();
    await ctx.adapter.profile(actor);
    await ctx.adapter.profile(second);
    expect((await graph(ctx, "request", "second")).ok).toBe(true);
    expect(await graph(ctx, "accept", "second")).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect((await graph(ctx, "accept", "first", second)).ok).toBe(true);
    expect(
      visible(await ctx.adapter.profile(actor, "second")).relationship.kind,
    ).toBe("friend");
    expect((await graph(ctx, "unfriend", "second")).ok).toBe(true);
    expect((await graph(ctx, "request", "second")).ok).toBe(true);
    expect((await graph(ctx, "reject", "first", second)).ok).toBe(true);
    expect((await graph(ctx, "request", "second")).ok).toBe(true);
    expect((await graph(ctx, "cancel", "second")).ok).toBe(true);
    expect(
      visible(await ctx.adapter.profile(actor, "second")).relationship.request,
    ).toBe("none");
  });
  it("keeps follow/friend distinct, limits favorites and removes favorites after the final qualifying relationship ends", async () => {
    const ctx = setup();
    expect(await graph(ctx, "favorite", "leila")).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect((await graph(ctx, "follow", "leila")).ok).toBe(true);
    expect((await graph(ctx, "favorite", "leila")).ok).toBe(true);
    const follow = visible(await ctx.adapter.profile(actor, "leila"));
    expect(follow.relationship.kind).toBe("follower");
    expect(follow.posts).toHaveLength(1);
    expect(
      (await ctx.adapter.connections(actor)).favorites.map((p) => p.username),
    ).toContain("leila");
    expect((await graph(ctx, "unfollow", "leila")).ok).toBe(true);
    expect((await ctx.adapter.connections(actor)).favorites).toHaveLength(0);
  });
  it("restriction reduces a friend's access to public content without severing friendship", async () => {
    const ctx = setup();
    await ctx.adapter.profile(actor);
    await ctx.adapter.profile(second);
    await graph(ctx, "request", "second");
    await graph(ctx, "accept", "first", second);
    const own = visible(await ctx.adapter.profile(actor));
    await ctx.adapter.execute(actor, edit(own), randomUUID(), ctx.save);
    const fresh = ctx.identities.get(actor.id)!;
    expect(
      visible(await ctx.adapter.profile(second, "first")).posts,
    ).toHaveLength(2);
    await graph(ctx, "restrict", "second", fresh);
    const restricted = visible(await ctx.adapter.profile(second, "first"));
    expect(restricted.relationship.kind).toBe("friend");
    expect(restricted.posts).toHaveLength(1);
    expect(restricted.details).toBeNull();
    expect(restricted.connections).toBeNull();
    await graph(ctx, "unrestrict", "second", fresh);
    expect(
      visible(await ctx.adapter.profile(second, "first")).posts,
    ).toHaveLength(2);
  });
  it("blocks bidirectionally, removes connections/favorites/suggestions and unblocks without restoring relationships", async () => {
    const ctx = setup();
    await ctx.adapter.profile(actor);
    await ctx.adapter.profile(second);
    await graph(ctx, "follow", "second");
    await graph(ctx, "follow", "first", second);
    await graph(ctx, "request", "second");
    await graph(ctx, "accept", "first", second);
    await graph(ctx, "favorite", "second");
    const before = visible(await ctx.adapter.profile(actor, "second"));
    const command = {
      operation: "block" as const,
      targetId: second.id,
      version: before.relationship.version,
    };
    expect(
      (await ctx.adapter.execute(actor, command, randomUUID(), ctx.save)).ok,
    ).toBe(true);
    expect(await ctx.adapter.profile(actor, "second")).toEqual({
      kind: "unavailable",
    });
    expect(await ctx.adapter.profile(second, "first")).toEqual({
      kind: "unavailable",
    });
    const list = await ctx.adapter.connections(actor);
    expect(list.blocked).toHaveLength(1);
    expect(list.favorites).toHaveLength(0);
    expect(list.suggestions.some((p) => p.id === second.id)).toBe(false);
    expect(
      await ctx.adapter.execute(
        second,
        {
          operation: "unblock",
          targetId: actor.id,
          version: list.blocked[0].relationship.version,
        },
        randomUUID(),
        ctx.save,
      ),
    ).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(await ctx.adapter.profile(second, "first")).toEqual({
      kind: "unavailable",
    });
    await ctx.adapter.execute(
      actor,
      {
        operation: "unblock",
        targetId: second.id,
        version: (await ctx.adapter.connections(actor)).blocked[0].relationship
          .version,
      },
      randomUUID(),
      ctx.save,
    );
    const restored = visible(await ctx.adapter.profile(actor, "second"));
    expect(restored.relationship.kind).toBe("visitor");
    expect(restored.relationship.following).toBe(false);
    expect(restored.relationship.request).toBe("none");
  });
  it("rejects stale edits/graph actions and invalid or pending featured content; identity failures preserve profile", async () => {
    const ctx = setup();
    const own = visible(await ctx.adapter.profile(actor));
    const failed = vi.fn(async () => ({
      ok: false as const,
      error: {
        code: "network" as const,
        message: "Synthetic failure",
        retryable: true,
      },
    }));
    expect(
      await ctx.adapter.execute(actor, edit(own), randomUUID(), failed),
    ).toMatchObject({ ok: false, error: { code: "network" } });
    expect(visible(await ctx.adapter.profile(actor)).details?.location).toBe(
      "",
    );
    expect(
      await ctx.adapter.execute(
        actor,
        {
          operation: "feature",
          postId: `${actor.id}-pending`,
          enabled: true,
          version: own.version,
        },
        randomUUID(),
        ctx.save,
      ),
    ).toMatchObject({ ok: false, error: { code: "forbidden" } });
    await ctx.adapter.execute(
      actor,
      {
        operation: "feature",
        postId: own.posts[1].id,
        enabled: true,
        version: own.version,
      },
      randomUUID(),
      ctx.save,
    );
    expect(
      await ctx.adapter.execute(actor, edit(own), randomUUID(), ctx.save),
    ).toMatchObject({ ok: false, error: { code: "conflict" } });
    const before = visible(await ctx.adapter.profile(actor, "leila"));
    await graph(ctx, "follow", "leila");
    expect(
      await graph(ctx, "request", "leila", actor, before.relationship.version),
    ).toMatchObject({ ok: false, error: { code: "conflict" } });
  });
  it("minimizes featured/media and mutual connections; deleted identities cannot read, mutate or replay success", async () => {
    const ctx = setup();
    const own = visible(await ctx.adapter.profile(actor));
    await ctx.adapter.execute(
      actor,
      {
        operation: "feature",
        postId: own.posts[2].id,
        enabled: true,
        version: own.version,
      },
      randomUUID(),
      ctx.save,
    );
    const guest = visible(await ctx.adapter.profile(null, "first"));
    expect(guest.featured.map((p) => p.audience)).toEqual(["public"]);
    expect(guest.media).toHaveLength(1);
    expect(
      visible(await ctx.adapter.profile(actor, "noah")).connections?.mutual,
    ).toEqual([]);
    const p = visible(await ctx.adapter.profile(actor, "leila"));
    const id = randomUUID();
    const command = {
      operation: "follow" as const,
      targetId: p.person.id,
      version: p.relationship.version,
    };
    expect((await ctx.adapter.execute(actor, command, id, ctx.save)).ok).toBe(
      true,
    );
    expect((await ctx.adapter.execute(actor, command, id, ctx.save)).ok).toBe(
      true,
    );
    expect(
      await ctx.adapter.execute(
        actor,
        { ...command, operation: "request" },
        id,
        ctx.save,
      ),
    ).toMatchObject({ ok: false, error: { code: "conflict" } });
    ctx.identities.delete(actor.id);
    expect(await ctx.adapter.profile(null, "first")).toEqual({
      kind: "unavailable",
    });
    expect(
      await ctx.adapter.execute(actor, command, id, ctx.save),
    ).toMatchObject({ ok: false, error: { code: "unauthorized" } });
  });
});
