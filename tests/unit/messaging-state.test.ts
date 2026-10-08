import { describe, expect, it } from "vitest";
import {
  canSend,
  createPreviewState,
  messagingReducer as reduce,
} from "@/features/messaging/state";
import type { Message, MessagingState } from "@/features/messaging/contracts";
const message = (): Message => ({
  id: "new",
  conversationId: "maya",
  sender: "self",
  sequence: 6,
  createdAt: "2026-10-09T10:00:00Z",
  text: "Hello",
  delivery: "queued",
  attempts: 0,
  retried: false,
  revision: 1,
  edited: false,
  lifecycle: "active",
  attachments: [],
  reactions: [],
  saved: false,
  pinned: false,
});
const queued = () =>
  reduce(createPreviewState(), { type: "enqueue", message: message() });
const current = (s: MessagingState) => s.messages.find((m) => m.id === "new")!;
describe("Phase 07 message lifecycle", () => {
  it("preserves identity/order across queued, sending, sent, delivered and read", () => {
    let s = queued();
    s = reduce(s, { type: "attempt", id: "new" });
    expect(current(s).delivery).toBe("sending");
    for (const delivery of ["sent", "delivered", "read"] as const) {
      s = reduce(s, {
        type: "ack",
        id: "new",
        attempt: 1,
        delivery,
        serverId: "server-new",
      });
      expect(current(s).delivery).toBe(delivery);
    }
    expect(current(s)).toMatchObject({
      id: "new",
      sequence: 6,
      serverId: "server-new",
    });
    expect(s.messages.map((m) => m.id)).toEqual([
      "m1",
      "m2",
      "m3",
      "l1",
      "s1",
      "new",
    ]);
  });
  it("deduplicates enqueue, repeated acknowledgments and server-ID collisions", () => {
    let s = reduce(queued(), { type: "attempt", id: "new" });
    const ack = {
      type: "ack",
      id: "new",
      attempt: 1,
      delivery: "read",
      serverId: "server-new",
    } as const;
    s = reduce(s, ack);
    const before = current(s);
    s = reduce(reduce(s, ack), {
      type: "ack",
      id: "new",
      attempt: 1,
      delivery: "sent",
    });
    s = reduce(s, { type: "enqueue", message: message() });
    s = reduce(s, {
      type: "enqueue",
      message: { ...message(), id: "duplicate", serverId: "server-new" },
    });
    expect(current(s)).toBe(before);
    expect(s.messages.filter((m) => m.id === "new")).toHaveLength(1);
    expect(s.messages.some((m) => m.id === "duplicate")).toBe(false);
  });
  it("requires manual retry, preserves ID and rejects stale failures with a finite budget", () => {
    let s = queued();
    for (let attempt = 1; attempt <= 3; attempt++) {
      s = reduce(s, { type: "attempt", id: "new" });
      if (attempt > 1) {
        s = reduce(s, {
          type: "ack",
          id: "new",
          attempt: attempt - 1,
          delivery: "failed",
        });
        expect(current(s).delivery).toBe("sending");
      }
      s = reduce(s, { type: "ack", id: "new", attempt, delivery: "failed" });
      expect(current(s).delivery).toBe("failed");
    }
    s = reduce(s, { type: "attempt", id: "new" });
    expect(current(s)).toMatchObject({
      id: "new",
      delivery: "failed",
      attempts: 3,
      retried: true,
    });
  });
  it("keeps offline queued messages and resumes only on reconnection", () => {
    let s = reduce(queued(), { type: "connection", connection: "offline" });
    s = reduce(s, { type: "attempt", id: "new" });
    expect(current(s).delivery).toBe("queued");
    s = reduce(s, { type: "connection", connection: "connected" });
    s = reduce(s, { type: "attempt", id: "new" });
    s = reduce(s, { type: "connection", connection: "disconnected" });
    s = reduce(s, { type: "connection", connection: "connected" });
    s = reduce(s, { type: "attempt", id: "new" });
    expect(current(s).attempts).toBe(1);
    s = reduce(s, { type: "ack", id: "new", attempt: 1, delivery: "sent" });
    expect(current(s).delivery).toBe("sent");
  });
  it("rejects sends, receipts, edits and reactions after permission revocation or block", () => {
    for (const kind of ["permission", "block"] as const) {
      let s = reduce(queued(), { type: "attempt", id: "new" });
      s =
        kind === "permission"
          ? reduce(s, {
              type: "permission",
              conversationId: "maya",
              permitted: false,
            })
          : reduce(s, {
              type: "conversation",
              conversationId: "maya",
              change: { blocked: true },
            });
      const before = current(s);
      s = reduce(s, { type: "ack", id: "new", attempt: 1, delivery: "read" });
      s = reduce(s, { type: "edit", id: "new", text: "Changed" });
      s = reduce(s, { type: "reaction", id: "new", emoji: "❤️" });
      s = reduce(s, {
        type: "enqueue",
        message: { ...message(), id: "forbidden" },
      });
      expect(current(s)).toBe(before);
      expect(s.messages.some((m) => m.id === "forbidden")).toBe(false);
      expect(canSend(s, "maya")).toBe(false);
    }
  });
  it("prevents deleted/expired messages from resurrection by late receipts", () => {
    for (const lifecycle of ["deleted", "expired"] as const) {
      let s = reduce(queued(), { type: "attempt", id: "new" });
      s = reduce(s, { type: "lifecycle", id: "new", lifecycle });
      s = reduce(s, { type: "ack", id: "new", attempt: 1, delivery: "read" });
      s = reduce(s, { type: "edit", id: "new", text: "Resurrect" });
      expect(current(s)).toMatchObject({
        id: "new",
        sequence: 6,
        text: "",
        lifecycle,
        attachments: [],
      });
    }
  });
  it("edits only own acknowledged messages and saves, pins, reacts without reordering", () => {
    let s = queued();
    s = reduce(s, { type: "edit", id: "new", text: "Too soon" });
    expect(current(s).text).toBe("Hello");
    s = reduce(s, { type: "attempt", id: "new" });
    s = reduce(s, { type: "ack", id: "new", attempt: 1, delivery: "sent" });
    s = reduce(s, { type: "edit", id: "new", text: "Updated" });
    s = reduce(s, { type: "toggle", id: "new", field: "saved" });
    s = reduce(s, { type: "toggle", id: "new", field: "pinned" });
    s = reduce(s, { type: "reaction", id: "new", emoji: "❤️" });
    expect(current(s)).toMatchObject({
      text: "Updated",
      edited: true,
      revision: 2,
      saved: true,
      pinned: true,
      reactions: ["❤️"],
      sequence: 6,
    });
    s = reduce(s, { type: "reaction", id: "new", emoji: "❤️" });
    expect(current(s).reactions).toEqual([]);
    s = reduce(s, { type: "edit", id: "m1", text: "Forbidden" });
    expect(s.messages[0].text).not.toBe("Forbidden");
  });
  it("requires acceptance of requests before sending", () => {
    let s = createPreviewState();
    expect(canSend(s, "sam")).toBe(false);
    s = reduce(s, {
      type: "conversation",
      conversationId: "sam",
      change: { request: false },
    });
    expect(canSend(s, "sam")).toBe(true);
  });
});
