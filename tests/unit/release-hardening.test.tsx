import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
vi.mock("server-only", () => ({}));
const actions = vi.hoisted(() => ({ community: vi.fn(), trust: vi.fn() }));
vi.mock("@/features/community/actions", () => ({
  communityAction: actions.community,
}));
vi.mock("@/features/trust/actions", () => ({ trustAction: actions.trust }));
import { ActionForm } from "@/features/community/action-form";
import { CommunityStore } from "@/lib/community/store";
import { safeReturnTo } from "@/features/auth/validation";

describe("release regression boundaries", () => {
  it("keeps supported destinations and rejects unsafe redirects", () => {
    for (const path of [
      "/creator",
      "/wellbeing",
      "/communities/studio",
      "/marketplace/sellers/demo-ava",
      "/content/abc/appeal",
    ])
      expect(safeReturnTo(path)).toBe(path);
    for (const path of [
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "/%2f%2fevil.test",
      "/account?next=https://evil.test",
      "/communities/../privacy",
      "javascript:alert(1)",
      null,
    ])
      expect(safeReturnTo(path)).toBe("/account");
  });
  it("deduplicates concurrent community creation and rejects identity reuse", async () => {
    const store = new CommunityStore();
    const command = {
      operation: "create",
      name: "Release regression",
      description: "Synthetic private fixture",
      visibility: "private",
    } as const;
    const results = await Promise.all([
      store.execute("actor", command, "same-request"),
      store.execute("actor", command, "same-request"),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(
      (await store.list("actor")).filter((item) => item.name === command.name),
    ).toHaveLength(1);
    expect(
      (
        await store.execute(
          "actor",
          { ...command, name: "Changed input" },
          "same-request",
        )
      ).ok,
    ).toBe(false);
  });
  it("rejects concurrent request-identity collisions across communities", async () => {
    const store = new CommunityStore();
    const results = await Promise.all([
      store.execute(
        "member",
        { operation: "join", id: "makers", version: 0 },
        "shared-request",
      ),
      store.execute(
        "member",
        { operation: "join", id: "studio", version: 0 },
        "shared-request",
      ),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect((await store.detail("member", "studio"))?.version).toBe(0);
  });
  it("serializes event participation against concurrent member removal", async () => {
    const store = new CommunityStore();
    await store.execute("member", {
      operation: "join",
      id: "makers",
      version: 0,
    });
    const results = await Promise.all([
      store.execute("demo-noah", {
        operation: "member",
        id: "makers",
        version: 1,
        targetId: "member",
        role: "none",
      }),
      store.execute("member", {
        operation: "rsvp",
        id: "makers",
        version: 1,
        eventId: "workshop",
        going: true,
      }),
    ]);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
    expect((await store.detail("member", "makers"))?.events[0].going).toEqual(
      [],
    );
  });
  it("withholds a private projection if membership changes during author checks", async () => {
    let started!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let checks = 0;
    const privateStore = new CommunityStore(async () => {
      if (++checks === 4) {
        started();
        await gate;
      }
      return true;
    });
    await privateStore.execute("member", {
      operation: "join",
      id: "studio",
      version: 0,
    });
    await privateStore.execute("demo-ava", {
      operation: "member",
      id: "studio",
      version: 1,
      targetId: "member",
      role: "member",
    });
    const reading = privateStore.detail("member", "studio");
    await entered;
    await privateStore.execute("demo-ava", {
      operation: "member",
      id: "studio",
      version: 2,
      targetId: "member",
      role: "none",
    });
    release();
    expect(await reading).toBeNull();
  });
  it("suppresses duplicate submits and preserves report identity after lost responses", async () => {
    let reject!: (error: Error) => void;
    actions.trust.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    actions.trust.mockResolvedValueOnce({ ok: true, message: "Report saved" });
    const { container } = render(
      <ActionForm
        trust
        base={{
          operation: "report",
          targetKind: "message",
          targetId: "fixture",
          category: "spam",
        }}
        label="Report"
      />,
    );
    const form = container.querySelector("form")!;
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Report" })).toBeEnabled(),
    );
    expect(form).toHaveAttribute("method", "post");
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(actions.trust).toHaveBeenCalledTimes(1);
    const id = actions.trust.mock.calls[0][1];
    reject(new Error("Connection lost"));
    await screen.findByText(/Connection interrupted/);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Report" })).toBeEnabled(),
    );
    fireEvent.submit(form);
    await screen.findByText("Report saved");
    expect(actions.trust.mock.calls[1][1]).toBe(id);
  });
});
