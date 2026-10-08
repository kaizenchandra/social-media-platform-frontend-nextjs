import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { createDevelopmentAdvancedAdapter } from "@/lib/advanced/development-adapter";
import { createDevelopmentProfilesAdapter } from "@/lib/profiles/mock-adapter";
import { createDevelopmentPublicationAdapter } from "@/lib/publication/mock-adapter";
import { getAssistantProvider } from "@/lib/advanced/ai-provider";
import {
  advancedCommand,
  assistantRequest,
  timeZone,
} from "@/features/advanced/validation";
import {
  defaultWellbeing,
  type AdvancedResult,
} from "@/features/advanced/contracts";
import type { ProfileIdentity } from "@/features/profiles/contracts";
import {
  isQuiet,
  mayNotify,
  activeDelta,
} from "@/features/advanced/wellbeing-policy";
const actor: ProfileIdentity = {
    id: "creator-one",
    username: "creator_one",
    displayName: "Synthetic creator",
    bio: "",
    version: 1,
  },
  other: ProfileIdentity = {
    ...actor,
    id: "creator-two",
    username: "creator_two",
  };
const query = {
  q: "",
  category: "all",
  condition: "all",
  collection: "discover",
} as const;
function data<T>(r: AdvancedResult<T>) {
  if (!r.ok) throw new Error(r.error.message);
  return r.data;
}
function setup(nodeEnv = "development") {
  const identities = new Map([
      [actor.id, { ...actor }],
      [other.id, { ...other }],
    ]),
    profiles = createDevelopmentProfilesAdapter(
      { nodeEnv: "development", mode: "mock" },
      async (id) => identities.get(id) ?? null,
    );
  let now = Date.now();
  const publication = createDevelopmentPublicationAdapter(
    { nodeEnv: "development", mode: "mock" },
    async (id) => identities.has(id),
    () => now,
  );
  const advanced = createDevelopmentAdvancedAdapter(
    { nodeEnv, mode: "mock" },
    profiles,
    publication,
    async (id) => identities.has(id),
    () => now,
  );
  const execute = (
    cmd: Parameters<typeof advanced.execute>[1],
    who = actor,
    id: string = randomUUID(),
  ) => advanced.execute(who, cmd, id);
  const save = async () => {
    const result = await publication.execute(
      actor.id,
      {
        operation: "save",
        draft: {
          text: "Synthetic creator text",
          audience: "private",
          disclosure: "not-declared",
          media: [],
          scenario: "review",
          syntheticOnly: true,
        },
      },
      randomUUID(),
    );
    if (!result.ok) throw new Error(result.error.message);
    return result.item;
  };
  return {
    advanced,
    profiles,
    publication,
    identities,
    execute,
    save,
    later: () => {
      now += 48 * 3600000;
    },
  };
}
describe("Advanced creator and marketplace authorization", () => {
  it("fails closed outside development and after account revocation", async () => {
    const s = setup("production");
    expect((await s.advanced.marketplace(actor, query)).ok).toBe(false);
    expect((await s.advanced.creator(actor)).ok).toBe(false);
    const dev = setup();
    dev.identities.delete(actor.id);
    expect((await dev.advanced.listing(actor, "studio-kit")).ok).toBe(false);
    expect((await dev.advanced.wellbeing(actor)).ok).toBe(false);
  });
  it("reads owned content without inventing analytics or monetization events", async () => {
    const s = setup(),
      item = await s.save(),
      snapshot = data(await s.advanced.creator(actor));
    expect(snapshot.content.map((p) => p.id)).toEqual([item.id]);
    expect(snapshot.analytics.metrics).toBeNull();
    expect(snapshot.monetization.balance).toBeNull();
    expect(snapshot.monetization.eligibility).toBeNull();
    expect(data(await s.advanced.creator(other)).content).toEqual([]);
  });
  it("requires confirmation and ownership for scheduling, never publishes on time", async () => {
    const s = setup(),
      item = await s.save();
    const cmd = {
      operation: "schedule",
      publicationId: item.id,
      publicationVersion: item.version,
      at: new Date(Date.now() + 3600000).toISOString(),
      confirmed: true,
    } as const;
    expect(
      (await s.execute({ ...cmd, confirmed: false } as unknown as typeof cmd))
        .ok,
    ).toBe(false);
    expect((await s.execute(cmd, other)).ok).toBe(false);
    expect((await s.execute(cmd)).ok).toBe(true);
    s.later();
    const snapshot = data(await s.advanced.creator(actor));
    expect(snapshot.plans[0].status).toBe("planned");
    expect(snapshot.content[0].state).toBe("DRAFT");
    expect(snapshot.content[0].distributionEnabled).toBe(false);
    expect(snapshot.plans[0].delivery).toBe("not-connected");
  });
  it("deduplicates plan creation, rejects stale content and concurrent duplicate plans", async () => {
    const s = setup(),
      item = await s.save(),
      cmd = {
        operation: "schedule",
        publicationId: item.id,
        publicationVersion: item.version,
        at: new Date(Date.now() + 3600000).toISOString(),
        confirmed: true,
      } as const;
    const results = await Promise.all([
      s.execute(cmd, actor, "schedule-1"),
      s.execute(cmd, actor, "schedule-1"),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(data(await s.advanced.creator(actor)).plans).toHaveLength(1);
    expect((await s.execute(cmd, actor, "schedule-2")).ok).toBe(false);
    expect(
      (await s.execute({ ...cmd, publicationVersion: 0 }, actor, "schedule-3"))
        .ok,
    ).toBe(false);
  });
  it("rejects scheduling held content and unauthorized cancellation", async () => {
    const s = setup(),
      item = await s.save();
    const begun = await s.publication.execute(
      actor.id,
      { operation: "begin", id: item.id, version: item.version },
      randomUUID(),
    );
    expect(begun.ok).toBe(true);
    const held = begun.ok ? begun.item : item;
    expect(
      (
        await s.execute({
          operation: "schedule",
          publicationId: item.id,
          publicationVersion: held.version,
          at: new Date(Date.now() + 3600000).toISOString(),
          confirmed: true,
        })
      ).ok,
    ).toBe(false);
    const second = await s.save();
    await s.execute({
      operation: "schedule",
      publicationId: second.id,
      publicationVersion: second.version,
      at: new Date(Date.now() + 3600000).toISOString(),
      confirmed: true,
    });
    const plan = data(await s.advanced.creator(actor)).plans[0];
    expect(
      (
        await s.execute(
          {
            operation: "cancel-schedule",
            id: plan.id,
            version: plan.version,
            confirmed: true,
          },
          other,
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await s.execute({
          operation: "cancel-schedule",
          id: plan.id,
          version: plan.version,
          confirmed: true,
        })
      ).ok,
    ).toBe(true);
    expect(data(await s.advanced.creator(actor)).plans[0].status).toBe(
      "cancelled",
    );
  });
  it("filters synthetic products and preserves empty / invalid search states", async () => {
    const s = setup();
    expect(
      data(
        await s.advanced.marketplace(actor, { ...query, category: "creative" }),
      ).map((i) => i.id),
    ).toEqual(["studio-kit"]);
    expect(
      data(
        await s.advanced.marketplace(actor, {
          ...query,
          q: "unmatched-long-query",
        }),
      ),
    ).toEqual([]);
    expect(
      (
        await s.advanced.marketplace(actor, {
          ...query,
          category: "invalid",
        } as unknown as typeof query)
      ).ok,
    ).toBe(false);
    expect(
      data(await s.advanced.listing(actor, "studio-kit")).transaction,
    ).toBe("unavailable");
  });
  it("does not expose owner drafts through discovery, seller pages or other direct URLs", async () => {
    const s = setup(),
      cmd = {
        operation: "listing",
        version: 0,
        title: "Private listing",
        description: "Synthetic details",
        category: "home",
        condition: "used",
        syntheticOnly: true,
        confirmed: true,
      } as const;
    const saved = data(await s.execute(cmd));
    if (!saved || !("sellerId" in saved)) throw new Error("Expected listing");
    expect(saved.status).toBe("draft");
    expect((await s.advanced.listing(other, saved.id)).ok).toBe(false);
    expect(
      data(
        await s.advanced.marketplace(other, { ...query, q: "Private listing" }),
      ),
    ).toEqual([]);
    expect(data(await s.advanced.seller(other, actor.id)).listings).toEqual([]);
    expect(
      data(
        await s.advanced.marketplace(actor, { ...query, collection: "mine" }),
      ),
    ).toHaveLength(1);
    expect(
      (await s.execute({ ...cmd, id: saved.id, version: 0 }, other)).ok,
    ).toBe(false);
    expect(
      (
        await s.execute({
          operation: "withdraw-listing",
          id: saved.id,
          version: 0,
          confirmed: true,
        })
      ).ok,
    ).toBe(true);
    expect(data(await s.advanced.listing(actor, saved.id)).canContact).toBe(
      false,
    );
  });
  it("rechecks profile blocks for listing details, seller and buyer entry permissions", async () => {
    const s = setup();
    await s.profiles.content(actor);
    const c = await s.profiles.connections(actor),
      target = c.friends.find((p) => p.id === "demo-noah")!;
    expect((await s.advanced.listing(actor, "studio-kit")).ok).toBe(true);
    await s.profiles.execute(
      actor,
      {
        operation: "block",
        targetId: "demo-noah",
        version: target.relationship.version,
      },
      randomUUID(),
      async () => ({ ok: true, message: "Unchanged" }),
    );
    expect((await s.advanced.listing(actor, "studio-kit")).ok).toBe(false);
    expect((await s.advanced.seller(actor, "demo-noah")).ok).toBe(false);
    expect(
      data(await s.advanced.marketplace(actor, query)).some(
        (p) => p.id === "studio-kit",
      ),
    ).toBe(false);
  });
  it("uses confirmation and idempotency to save only a private manual draft", async () => {
    const s = setup(),
      cmd = {
        operation: "assistant-draft",
        text: "Human synthetic draft",
        syntheticOnly: true,
        confirmed: true,
      } as const;
    await s.execute(cmd, actor, "manual-1");
    await s.execute(cmd, actor, "manual-1");
    expect(
      (await s.execute({ ...cmd, text: "changed" }, actor, "manual-1")).ok,
    ).toBe(false);
    const snapshot = data(await s.advanced.creator(actor));
    expect(snapshot.content).toHaveLength(1);
    expect(snapshot.content[0].draft.audience).toBe("private");
    expect(snapshot.content[0].draft.disclosure).toBe("not-declared");
    expect(snapshot.content[0].distributionEnabled).toBe(false);
  });
  it("rejects actor injection, publication flags, missing consent and invalid times", () => {
    expect(
      advancedCommand.safeParse({
        operation: "assistant-draft",
        text: "Test",
        syntheticOnly: true,
        confirmed: true,
        actorId: "other",
      }).success,
    ).toBe(false);
    expect(
      advancedCommand.safeParse({
        operation: "schedule",
        publicationId: "a",
        publicationVersion: 0,
        at: "tomorrow",
        confirmed: true,
      }).success,
    ).toBe(false);
    expect(
      assistantRequest.safeParse({
        task: "translation",
        text: "private",
        language: "en",
        consent: true,
        syntheticOnly: true,
      }).success,
    ).toBe(false);
    expect(timeZone.safeParse("Invalid/Zone").success).toBe(false);
  });
});
describe("AI and well-being truthful provider boundaries", () => {
  it("returns no invented AI output from the unavailable provider for every task", async () => {
    for (const task of [
      "writing",
      "caption",
      "translation",
      "accessibility",
      "summary",
    ] as const) {
      const r = await getAssistantProvider().generate({
        task,
        text: "Synthetic request",
        language: "en",
        consent: true,
        syntheticOnly: true,
      });
      expect(r.ok).toBe(false);
      expect(r).not.toHaveProperty("data");
    }
  });
  it("isolates preferences by actor and rejects simultaneous stale writes", async () => {
    const s = setup(),
      cmd = {
        operation: "wellbeing",
        ...defaultWellbeing,
        screenTimeReminder: 30,
        autoplay: true,
      } as const;
    const results = await Promise.all([
      s.execute(cmd),
      s.execute({ ...cmd, screenTimeReminder: 60 }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(data(await s.advanced.wellbeing(actor)).autoplay).toBe(true);
    expect(data(await s.advanced.wellbeing(other)).autoplay).toBe(false);
  });
  it("observes overnight boundaries and channel opt-outs without inventing delivery", () => {
    const p = {
      ...defaultWellbeing,
      quietEnabled: true,
      timeZone: "Asia/Kolkata",
      inAppNotifications: true,
      pushNotifications: false,
    };
    expect(isQuiet(p, new Date("2026-10-09T17:00:00Z"))).toBe(true);
    expect(isQuiet(p, new Date("2026-10-09T02:30:00Z"))).toBe(false);
    expect(mayNotify(p, "inApp", new Date("2026-10-09T17:00:00Z"))).toBe(false);
    expect(mayNotify(p, "push", new Date("2026-10-09T10:00:00Z"))).toBe(false);
  });
  it("uses daylight-saving-aware zones and does not count inactive time", () => {
    const p = {
      ...defaultWellbeing,
      quietEnabled: true,
      timeZone: "America/New_York",
      quietStart: "08:00",
      quietEnd: "10:00",
    };
    expect(isQuiet(p, new Date("2026-01-10T13:00:00Z"))).toBe(true);
    expect(isQuiet(p, new Date("2026-07-10T12:00:00Z"))).toBe(true);
    expect(activeDelta(0, 60000, false)).toBe(0);
    expect(activeDelta(0, 60000, true)).toBe(5000);
    expect(activeDelta(5000, 0, true)).toBe(0);
  });
});
