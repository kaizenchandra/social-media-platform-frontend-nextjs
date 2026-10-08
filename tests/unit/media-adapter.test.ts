import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { createDevelopmentMediaAdapter } from "@/lib/media/mock-adapter";
import { getLiveProvider } from "@/lib/media/live-provider";
import {
  canViewMedia,
  liveReady,
  mayPublishRecording,
  seekTime,
  unavailableLive,
} from "@/features/media/policy";
import { mediaFixtures } from "@/features/media/fixtures";
import { draftInput } from "@/features/publication/validation";
import { transition } from "@/features/publication/state-machine";
import type { MediaCommand } from "@/features/media/validation";
import type { ProfileIdentity } from "@/features/profiles/contracts";
const actor: ProfileIdentity = {
  id: "actor",
  displayName: "Preview viewer",
  username: "viewer",
  bio: "Synthetic",
  version: 1,
};
function setup() {
  let now = Date.parse("2026-10-09T00:00:00Z");
  let active = true;
  const owners = new Set([actor.id, "demo-ava", "demo-noah", "demo-milo"]);
  const adapter = createDevelopmentMediaAdapter(
    { nodeEnv: "development", mode: "mock" },
    async (id) => (active ? { ...actor, id } : null),
    async (identity) => ({
      actorId: identity.id,
      allowedCreators: owners,
      friendCreators: new Set(["demo-noah"]),
    }),
    () => now,
  );
  return {
    adapter,
    owners,
    advance: (ms: number) => {
      now += ms;
    },
    revoke: () => {
      active = false;
    },
    execute: (command: MediaCommand, id = randomUUID()) =>
      adapter.execute(actor, command, id),
  };
}
describe("Rich media safety and publication boundaries", () => {
  it("never projects held/restricted media or serializes their sources in direct reads", async () => {
    const { adapter } = setup();
    const catalog = await adapter.catalog(actor);
    expect(catalog.ok).toBe(true);
    if (!catalog.ok) return;
    expect(catalog.catalog.items.map((i) => i.id)).not.toContain("held-reel");
    expect(catalog.catalog.items.map((i) => i.id)).not.toContain(
      "restricted-video",
    );
    for (const id of ["held-reel", "restricted-video", "unknown"])
      expect(await adapter.read(actor, id)).toMatchObject({
        ok: false,
        error: { code: "forbidden" },
      });
  });
  it("checks current creator permission for saves, shares, comments, replay and detail reads", async () => {
    const { adapter, owners, execute } = setup();
    const id = randomUUID();
    const command = {
      operation: "comment",
      id: "video-coast",
      text: "Synthetic comment",
    } as const;
    expect((await execute(command, id)).ok).toBe(true);
    owners.delete("demo-ava");
    expect(await execute(command, id)).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    for (const operation of ["save", "share"] as const)
      expect(
        await execute(
          operation === "save"
            ? { operation, id: "video-coast", value: true }
            : { operation, id: "video-coast" },
        ),
      ).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(await adapter.read(actor, "video-coast")).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    const result = await adapter.catalog(actor);
    if (result.ok)
      expect(
        result.catalog.items.some((i) => i.creator.id === "demo-ava"),
      ).toBe(false);
  });
  it("expires ordinary stories but preserves eligible creator highlights without changing moderation", async () => {
    const { adapter, execute, advance } = setup();
    const own = `story-${actor.id}`;
    expect(
      (await execute({ operation: "highlight", id: own, value: true })).ok,
    ).toBe(true);
    advance(25 * 60 * 60 * 1000);
    expect(await adapter.read(actor, "story-coast")).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect((await adapter.read(actor, own)).ok).toBe(true);
    expect((await adapter.read(actor, "story-highlight")).ok).toBe(true);
    expect(
      (await execute({ operation: "highlight", id: own, value: false })).ok,
    ).toBe(false);
    expect((await adapter.read(actor, own)).ok).toBe(false);
    expect(
      await execute({
        operation: "highlight",
        id: "story-highlight",
        value: false,
      }),
    ).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
  it("deduplicates unconfirmed comment retry and rejects ID reuse with changed content", async () => {
    const { execute, adapter } = setup();
    const requestId = randomUUID();
    const command = {
      operation: "comment",
      id: "reel-quiet",
      text: "Synthetic comment",
    } as const;
    await execute(command, requestId);
    await execute(command, requestId);
    const item = await adapter.read(actor, command.id);
    if (item.ok) expect(item.comments).toHaveLength(1);
    expect(
      await execute({ ...command, text: "Different" }, requestId),
    ).toMatchObject({ ok: false, error: { code: "conflict" } });
  });
  it("scopes saves/reactions to the actor and emits links without attachment URLs", async () => {
    const { execute, adapter } = setup();
    await execute({ operation: "save", id: "video-studio", value: true });
    await execute({ operation: "reaction", id: "video-studio", value: "love" });
    const own = await adapter.read(actor, "video-studio");
    if (own.ok)
      expect(own.item).toMatchObject({ saved: true, reaction: "love" });
    const other = await adapter.read({ ...actor, id: "other" }, "video-studio");
    if (other.ok)
      expect(other.item).toMatchObject({ saved: false, reaction: null });
    const share = await execute({ operation: "share", id: "video-studio" });
    expect(share).toMatchObject({
      ok: true,
      sharePath: "/videos/video-studio",
    });
  });
  it("revoked identities cannot read or mutate and production cannot construct the preview", async () => {
    const { adapter, revoke, execute } = setup();
    revoke();
    expect(await adapter.catalog(actor)).toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    expect(
      await execute({ operation: "save", id: "video-studio", value: true }),
    ).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    expect(() =>
      createDevelopmentMediaAdapter(
        { nodeEnv: "production", mode: "mock" },
        async () => actor,
        async () => ({
          actorId: actor.id,
          allowedCreators: new Set(),
          friendCreators: new Set(),
        }),
      ),
    ).toThrow();
  });
  it("applies audience, source, publication and distribution constraints across all recorded formats", () => {
    const context = {
      actorId: actor.id,
      allowedCreators: new Set(["demo-ava"]),
      friendCreators: new Set<string>(),
    };
    const fixture = mediaFixtures(0)[0];
    for (const kind of ["story", "reel", "video"] as const) {
      const item = { ...fixture, kind, expiresAt: null };
      expect(canViewMedia(item, context, 0)).toBe(true);
      for (const publication of [
        "DRAFT",
        "UPLOADING",
        "PROCESSING",
        "SCREENING",
        "REVIEW_REQUIRED",
        "APPROVED",
        "RESTRICTED",
        "REJECTED",
        "FAILED",
        "CANCELLED",
      ] as const)
        expect(canViewMedia({ ...item, publication }, context, 0)).toBe(false);
      expect(
        canViewMedia(
          { ...item, source: "author-draft", publication: "APPROVED" },
          context,
          0,
        ),
      ).toBe(false);
      expect(
        canViewMedia(
          {
            ...item,
            source: "service",
            publication: "PUBLISHED",
            distributionEnabled: true,
            decision: {
              id: "simulation",
              source: "simulation",
              reason: "",
              appealEligible: false,
            },
          },
          context,
          0,
        ),
      ).toBe(false);
      expect(canViewMedia({ ...item, audience: "private" }, context, 0)).toBe(
        false,
      );
      expect(canViewMedia({ ...item, audience: "friends" }, context, 0)).toBe(
        false,
      );
      expect(
        canViewMedia(
          { ...item, src: "https://example.test/unreviewed.webm" },
          context,
          0,
        ),
      ).toBe(false);
    }
  });
  it("keeps Phase 06 simulation nonpublic and validates recorded draft formats", () => {
    expect(() =>
      transition(
        "APPROVED",
        "PUBLISHED",
        { source: "simulation", id: "mock", reason: "", appealEligible: false },
        true,
      ),
    ).toThrow();
    const draft = {
      text: "Synthetic",
      audience: "private",
      disclosure: "not-declared",
      scenario: "low-risk",
      syntheticOnly: true,
      media: [],
    };
    expect(draftInput.safeParse({ ...draft, format: "story" }).success).toBe(
      true,
    );
    expect(draftInput.safeParse({ ...draft, format: "reel" }).success).toBe(
      false,
    );
    expect(
      draftInput.safeParse({
        ...draft,
        format: "video",
        media: [
          {
            name: "preview.webm",
            type: "video/webm",
            size: 100,
            alt: "Synthetic animation",
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      mayPublishRecording({
        state: "APPROVED",
        mode: "simulated",
        distributionEnabled: false,
        decision: null,
      }),
    ).toBe(false);
  });
  it("does not treat recorded approval as live eligibility or prescreen future frames", async () => {
    expect(liveReady(unavailableLive)).toBe(false);
    const full = {
      ...unavailableLive,
      provider: "integrated" as const,
      ingest: true,
      authorizedPlayback: true,
      eligibility: true,
      continuousMonitoring: true,
      emergencyInterruption: true,
      reporting: true,
    };
    expect(liveReady(full)).toBe(true);
    expect(liveReady({ ...full, continuousMonitoring: false })).toBe(false);
    expect(liveReady({ ...full, emergencyInterruption: false })).toBe(false);
    expect(
      await getLiveProvider().start({
        title: "Synthetic",
        audience: "public",
        eligibilityToken: "APPROVED",
        requestId: randomUUID(),
      }),
    ).toMatchObject({ ok: false, code: "unavailable" });
    expect(await getLiveProvider().stop("unknown")).toMatchObject({
      ok: false,
      code: "unavailable",
    });
  });
  it("clamps keyboard seeking and handles unloaded or nonfinite media duration", () => {
    expect(seekTime(2, -5, 6)).toBe(0);
    expect(seekTime(4, 5, 6)).toBe(6);
    expect(seekTime(0, 5, Infinity)).toBe(0);
    expect(seekTime(NaN, 5, 6)).toBe(0);
  });
});
