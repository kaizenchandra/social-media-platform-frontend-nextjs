import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { CommunityStore } from "@/lib/community/store";
import { TrustStore } from "@/lib/trust/store";
import { trustCommand } from "@/features/trust/validation";
import { communityCommand } from "@/features/community/validation";
describe("community authority", () => {
  it("excludes private content, topics, events, and snippets before search", async () => {
    const s = new CommunityStore();
    expect(await s.search("visitor", "Private studio planning")).toEqual([]);
    const c = await s.detail("visitor", "studio");
    expect(c?.posts).toEqual([]);
    expect(c?.topics).toEqual([]);
    expect(c?.events).toEqual([]);
    expect(c?.members).toEqual([]);
  });
  it("requires approval and immediately revokes content after removal", async () => {
    const s = new CommunityStore();
    expect(
      (
        await s.execute("visitor", {
          operation: "join",
          id: "studio",
          version: 0,
        })
      ).ok,
    ).toBe(true);
    expect((await s.detail("visitor", "studio"))?.canRead).toBe(false);
    expect(
      (
        await s.execute("visitor", {
          operation: "member",
          id: "studio",
          version: 1,
          targetId: "visitor",
          role: "admin",
        })
      ).ok,
    ).toBe(false);
    await s.execute("demo-ava", {
      operation: "member",
      id: "studio",
      version: 1,
      targetId: "visitor",
      role: "member",
    });
    expect((await s.search("visitor", "Private studio planning")).length).toBe(
      1,
    );
    await s.execute("demo-ava", {
      operation: "member",
      id: "studio",
      version: 2,
      targetId: "visitor",
      role: "none",
    });
    expect(await s.search("visitor", "Private studio planning")).toEqual([]);
  });
  it("rejects stale membership writes and nonmember events / admin posts", async () => {
    const s = new CommunityStore();
    await s.execute("a", { operation: "join", id: "makers", version: 0 });
    expect(
      (await s.execute("b", { operation: "join", id: "makers", version: 0 }))
        .ok,
    ).toBe(false);
    expect(
      (
        await s.execute("a", {
          operation: "post",
          id: "makers",
          version: 1,
          text: "announcement",
          topic: "Projects",
          announcement: true,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await s.execute("b", {
          operation: "rsvp",
          id: "makers",
          version: 1,
          eventId: "workshop",
          going: true,
        })
      ).ok,
    ).toBe(false);
  });
  it("applies graph permissions to direct reads and every search source", async () => {
    const s = new CommunityStore(async () => false);
    expect(await s.list("blocked")).toEqual([]);
    expect(await s.detail("blocked", "makers")).toBeNull();
    expect(await s.search("blocked", "")).toEqual([]);
    expect(await s.businessPages("blocked")).toEqual([]);
  });
  it("filters blocked event creators independently from community owners", async () => {
    let blocked = false;
    const s = new CommunityStore(
      async (actor, owner) => !(blocked && owner === "a" && actor === "b"),
    );
    await s.execute("a", { operation: "join", id: "makers", version: 0 });
    await s.execute("demo-noah", {
      operation: "member",
      id: "makers",
      version: 1,
      targetId: "a",
      role: "admin",
    });
    await s.execute("a", {
      operation: "event",
      id: "makers",
      version: 2,
      text: "Creator-only event",
      date: new Date(Date.now() + 86400000).toISOString(),
    });
    expect((await s.search("b", "Creator-only event")).length).toBe(1);
    blocked = true;
    expect(await s.search("b", "Creator-only event")).toEqual([]);
  });
  it("protects page owners and preserves empty search", async () => {
    const s = new CommunityStore();
    expect(
      (
        await s.execute("visitor", {
          operation: "page",
          id: "common-studio",
          version: 0,
          name: "changed",
          description: "changed",
        })
      ).ok,
    ).toBe(false);
    expect(await s.search("visitor", "no-matching-result-987")).toEqual([]);
  });
  it("supports member posts, RSVP toggles, topics and discussions", async () => {
    const s = new CommunityStore();
    await s.execute("a", { operation: "join", id: "makers", version: 0 });
    await s.execute("a", {
      operation: "rsvp",
      id: "makers",
      version: 1,
      eventId: "workshop",
      going: true,
    });
    await s.execute("a", {
      operation: "discussion",
      id: "makers",
      version: 2,
      eventId: "workshop",
      text: "Synthetic question",
    });
    expect((await s.detail("a", "makers"))?.events[0].going).toEqual(["a"]);
    expect((await s.detail("b", "makers"))?.events[0].going).toEqual([]);
  });
});
describe("trust authority", () => {
  const report = {
    operation: "report",
    targetKind: "message",
    targetId: "synthetic-message",
    category: "deepfake",
  } as const;
  it("deduplicates reports and rejects request identity collisions", () => {
    const s = new TrustStore();
    s.execute("a", report, "request-1");
    s.execute("a", report, "request-1");
    expect(s.reports("a")).toHaveLength(1);
    expect(
      s.execute("a", { ...report, category: "spam" }, "request-1").ok,
    ).toBe(false);
    expect(s.reports("b")).toEqual([]);
  });
  it("denies unauthorized moderation, evidence and audit views", () => {
    const s = new TrustStore();
    s.execute("a", report, "request-1");
    const c = s.reports("a")[0];
    expect(s.queue("a")).toBeNull();
    expect(s.audits("a")).toBeNull();
    expect(s.evidence()).toBeNull();
    expect(
      s.execute(
        "a",
        {
          operation: "decision",
          id: c.id,
          version: 0,
          decision: "restrict",
          reason: "policy-violation",
        },
        "request-2",
      ).ok,
    ).toBe(false);
    expect(JSON.stringify(c)).not.toContain("reporterId");
    expect(c.classifier.proof).toBe(false);
  });
  it("expires reviews without releasing content; appeals require ownership and versions", () => {
    let now = Date.now();
    const s = new TrustStore(
      (id) => (id === "mod" ? "moderator" : "member"),
      () => now,
    );
    s.execute("a", report, "report-1");
    const id = s.reports("a")[0].id;
    now += 100 * 3600000;
    expect(s.reports("a")[0].overdue).toBe(true);
    expect(s.reports("a")[0].status).toBe("pending");
    s.execute(
      "mod",
      {
        operation: "decision",
        id,
        version: 0,
        decision: "restrict",
        reason: "policy-violation",
      },
      "decision-1",
    );
    expect(
      s.execute(
        "b",
        {
          operation: "appeal",
          id,
          version: 1,
          text: "Synthetic appeal explanation",
        },
        "appeal-1",
      ).ok,
    ).toBe(false);
    expect(
      s.execute(
        "a",
        {
          operation: "appeal",
          id,
          version: 0,
          text: "Synthetic appeal explanation",
        },
        "appeal-2",
      ).ok,
    ).toBe(false);
    s.execute(
      "a",
      {
        operation: "appeal",
        id,
        version: 1,
        text: "Synthetic appeal explanation",
      },
      "appeal-3",
    );
    s.execute(
      "mod",
      {
        operation: "decision",
        id,
        version: 2,
        decision: "reverse",
        reason: "successful-appeal",
      },
      "decision-2",
    );
    expect(s.reports("a")[0].status).toBe("reversed");
    expect(s.reports("a")[0].appeal?.status).toBe("accepted");
  });
  it("rechecks roles after permission changes and excludes appeal content from audits", () => {
    let enabled = true;
    const s = new TrustStore((id) =>
      id === "mod" && enabled ? "admin" : "member",
    );
    s.execute("a", report, "report-1");
    expect(s.audits("mod")).toHaveLength(1);
    expect(JSON.stringify(s.audits("mod"))).not.toContain("deepfake");
    enabled = false;
    expect(s.queue("mod")).toBeNull();
    expect(s.audits("mod")).toBeNull();
  });
  it("version checks privacy updates and discoverability", () => {
    const s = new TrustStore();
    const p = {
      operation: "privacy",
      version: 0,
      discoverable: false,
      audience: "private",
      loginAlerts: false,
      sessionReviewReminder: true,
    } as const;
    expect(s.execute("a", p, "privacy-1").ok).toBe(true);
    expect(s.discoverable("a")).toBe(false);
    expect(s.execute("a", p, "privacy-2").ok).toBe(false);
  });
  it("rejects role injection and invalid report/appeal inputs", () => {
    expect(trustCommand.safeParse({ ...report, role: "admin" }).success).toBe(
      false,
    );
    expect(
      trustCommand.safeParse({
        operation: "appeal",
        id: "a",
        version: 0,
        text: "short",
      }).success,
    ).toBe(false);
    expect(
      communityCommand.safeParse({
        operation: "create",
        name: "",
        description: "x",
        visibility: "public",
      }).success,
    ).toBe(false);
  });
});
