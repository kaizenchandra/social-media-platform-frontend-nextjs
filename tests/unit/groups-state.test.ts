import { describe, expect, it } from "vitest";
import {
  createGroupPreview,
  executeGroup,
  isActive,
  member,
  projectGroup,
} from "@/features/groups/state";
import type {
  GroupCommand,
  GroupOperation,
  GroupState,
} from "@/features/groups/contracts";
function command(
  state: GroupState,
  operation: GroupOperation,
  actor = "self",
  id = crypto.randomUUID(),
): GroupCommand {
  return {
    id,
    actor,
    groupId: "garden",
    revision: state.groups[0].revision,
    operation,
  };
}
function apply(state: GroupState, op: GroupOperation, actor = "self") {
  const result = executeGroup(state, command(state, op, actor));
  expect(result.ok).toBe(true);
  return result.state;
}
const send: GroupOperation = {
  type: "send",
  channelId: "general",
  text: "New permitted message",
  mentions: [],
  attachments: [],
};
describe("Group authorization and membership", () => {
  it("rejects unauthorized administration at the state boundary", () => {
    const state = createGroupPreview();
    const operations: GroupOperation[] = [
      { type: "remove", userId: "maya" },
      { type: "approve", userId: "sam" },
      { type: "role", userId: "leo", role: "admin" },
      { type: "details", name: "Changed", description: "" },
      {
        type: "permissions",
        permissions: {
          invite: "everyone",
          post: "admin",
          collaborate: "admin",
          attachments: false,
        },
      },
      { type: "channel", name: "Private", kind: "announcements" },
      { type: "pin", messageId: "welcome" },
      { type: "invite", userId: "noah", fail: false },
    ];
    for (const operation of operations) {
      const result = executeGroup(state, command(state, operation, "leo"));
      expect(result).toMatchObject({ ok: false, error: "forbidden" });
      expect(result.state).toBe(state);
    }
  });
  it("removes access to history, files, polls and notes and rejects removed writes/replays", () => {
    let state = apply(createGroupPreview(), {
      type: "collaboration",
      kind: "note",
      title: "Private plan",
      body: "Synthetic",
    });
    const pending = command(state, send, "leo");
    state = executeGroup(state, pending).state;
    state = apply(state, { type: "remove", userId: "leo" });
    expect(projectGroup(state.groups[0], "leo")).toBeNull();
    expect(executeGroup(state, pending)).toMatchObject({
      ok: false,
      error: "forbidden",
    });
    expect(executeGroup(state, command(state, send, "leo"))).toMatchObject({
      ok: false,
      error: "forbidden",
    });
    state = apply(state, send);
    expect(projectGroup(state.groups[0], "leo")).toBeNull();
  });
  it("checks current role before stale concurrent membership and invitation actions", () => {
    const state = createGroupPreview();
    const invite = command(
      state,
      { type: "invite", userId: "noah", fail: false },
      "maya",
    );
    const promote = command(state, {
      type: "role",
      userId: "leo",
      role: "admin",
    });
    const changed = apply(state, { type: "remove", userId: "maya" });
    expect(executeGroup(changed, invite)).toMatchObject({
      ok: false,
      error: "forbidden",
    });
    expect(executeGroup(changed, promote)).toMatchObject({
      ok: false,
      error: "conflict",
    });
    expect(member(changed.groups[0], "noah")).toBeUndefined();
    expect(member(changed.groups[0], "leo")?.role).toBe("member");
  });
  it("does not grant access on failed invitations; explicit retry still requires acceptance", () => {
    let state = apply(createGroupPreview(), {
      type: "invite",
      userId: "noah",
      fail: true,
    });
    expect(member(state.groups[0], "noah")?.status).toBe("failed");
    expect(projectGroup(state.groups[0], "noah")).toBeNull();
    state = apply(state, { type: "invite", userId: "noah", fail: false });
    expect(member(state.groups[0], "noah")?.status).toBe("invited");
    expect(isActive(state.groups[0], "noah")).toBe(false);
    state = apply(state, { type: "accept" }, "noah");
    expect(projectGroup(state.groups[0], "noah")?.messages).toEqual([]);
    state = apply(state, send);
    expect(
      projectGroup(state.groups[0], "noah")?.messages.map((m) => m.text),
    ).toEqual(["New permitted message"]);
  });
  it("requires request approval and hides prior content for newly admitted members", () => {
    let state = createGroupPreview();
    expect(projectGroup(state.groups[0], "sam")).toBeNull();
    expect(executeGroup(state, command(state, send, "sam"))).toMatchObject({
      ok: false,
      error: "forbidden",
    });
    state = apply(state, { type: "approve", userId: "sam" });
    expect(projectGroup(state.groups[0], "sam")?.polls).toEqual([]);
    state = apply(state, {
      type: "collaboration",
      kind: "task",
      title: "Bring snacks",
      body: "",
      assignee: "sam",
    });
    expect(projectGroup(state.groups[0], "sam")?.collaboration[0].title).toBe(
      "Bring snacks",
    );
    expect(
      executeGroup(
        state,
        command(
          state,
          {
            type: "send",
            channelId: "general",
            parentId: "welcome",
            text: "Old quote",
            mentions: [],
            attachments: [],
          },
          "sam",
        ),
      ),
    ).toMatchObject({ ok: false, error: "invalid" });
  });
  it("protects the last admin and resets history on rejoin", () => {
    let state = apply(createGroupPreview(), {
      type: "role",
      userId: "maya",
      role: "member",
    });
    expect(
      executeGroup(state, command(state, { type: "leave" })),
    ).toMatchObject({ ok: false, error: "forbidden" });
    state = apply(state, { type: "leave" }, "leo");
    expect(projectGroup(state.groups[0], "leo")).toBeNull();
    state = apply(state, send);
    state = apply(state, { type: "invite", userId: "leo", fail: false });
    state = apply(state, { type: "accept" }, "leo");
    expect(projectGroup(state.groups[0], "leo")?.messages).toEqual([]);
  });
  it("enforces announcement-only and permission changes including media", () => {
    let state = createGroupPreview();
    expect(
      executeGroup(
        state,
        command(state, { ...send, channelId: "announcements" }, "leo"),
      ),
    ).toMatchObject({ ok: false, error: "forbidden" });
    const queued = command(state, send, "leo");
    state = apply(state, {
      type: "permissions",
      permissions: {
        invite: "admin",
        post: "admin",
        collaborate: "admin",
        attachments: false,
      },
    });
    expect(executeGroup(state, queued)).toMatchObject({
      ok: false,
      error: "conflict",
    });
    expect(executeGroup(state, command(state, send, "leo"))).toMatchObject({
      ok: false,
      error: "forbidden",
    });
    expect(
      executeGroup(
        state,
        command(state, {
          ...send,
          attachments: [
            {
              id: "a",
              kind: "file",
              name: "a.txt",
              url: "blob:test",
              size: 10,
            },
          ],
        }),
      ),
    ).toMatchObject({ ok: false, error: "invalid" });
  });
  it("preserves message identity on retries and repeated acknowledgments", () => {
    let state = createGroupPreview();
    const failed = command(state, { ...send, fail: true }, "self", "send-id");
    expect(executeGroup(state, failed)).toMatchObject({
      ok: false,
      error: "network",
    });
    expect(state.groups[0].messages).toHaveLength(2);
    const retry = { ...failed, operation: send };
    state = executeGroup(state, retry).state;
    const replay = executeGroup(state, retry);
    expect(replay).toMatchObject({ ok: true, replay: true });
    expect(
      replay.state.groups[0].messages.filter((m) => m.id === "send-id"),
    ).toHaveLength(1);
    expect(executeGroup(state, { ...retry, actor: "leo" })).toMatchObject({
      ok: false,
      error: "conflict",
    });
  });
  it("supports threads, validated mentions and pinned messages", () => {
    let state = apply(
      createGroupPreview(),
      { ...send, parentId: "welcome", mentions: ["maya"] },
      "leo",
    );
    expect(state.groups[0].messages.at(-1)).toMatchObject({
      parentId: "welcome",
      mentions: ["maya"],
    });
    state = apply(state, {
      type: "pin",
      messageId: state.groups[0].messages.at(-1)!.id,
    });
    expect(state.groups[0].messages.at(-1)?.pinned).toBe(true);
    expect(
      executeGroup(state, command(state, { ...send, mentions: ["noah"] })),
    ).toMatchObject({ ok: false, error: "invalid" });
  });
  it("counts one poll vote per actor and prohibits votes after closure", () => {
    let state = apply(
      createGroupPreview(),
      { type: "vote", pollId: "time", option: 0 },
      "leo",
    );
    state = apply(state, { type: "vote", pollId: "time", option: 1 }, "leo");
    expect(state.groups[0].polls[0].votes).toEqual({ leo: 1 });
    state = apply(state, { type: "close-poll", pollId: "time" });
    expect(
      executeGroup(
        state,
        command(state, { type: "vote", pollId: "time", option: 0 }, "leo"),
      ),
    ).toMatchObject({ ok: false, error: "invalid" });
  });
  it("detects concurrent shared-note edits and supports task/reminder/event actions", () => {
    let state = apply(createGroupPreview(), {
      type: "collaboration",
      kind: "note",
      title: "Plan",
      body: "Original",
    });
    const note = state.groups[0].collaboration[0];
    const edit = command(
      state,
      {
        type: "collaboration",
        kind: "note",
        itemId: note.id,
        itemRevision: 1,
        title: "Plan",
        body: "Stale",
      },
      "leo",
    );
    state = apply(state, {
      type: "collaboration",
      kind: "note",
      itemId: note.id,
      itemRevision: 1,
      title: "Plan",
      body: "Updated",
    });
    expect(executeGroup(state, edit)).toMatchObject({
      ok: false,
      error: "conflict",
    });
    for (const kind of ["task", "reminder", "event"] as const) {
      state = apply(state, {
        type: "collaboration",
        kind,
        title: kind,
        body: "",
        due: "2026-10-10T10:00",
        assignee: kind === "task" ? "leo" : undefined,
      });
      const item = state.groups[0].collaboration.at(-1)!;
      state = apply(
        state,
        { type: kind === "event" ? "rsvp" : "complete", itemId: item.id },
        "leo",
      );
      expect(state.groups[0].collaboration.at(-1)).toMatchObject(
        kind === "event" ? { attendees: ["leo"] } : { completed: true },
      );
    }
  });
  it("creates private groups with one admin and prevents unaccepted content reads", () => {
    const state = createGroupPreview();
    const result = executeGroup(state, {
      id: "create-id",
      groupId: "new",
      revision: 0,
      actor: "leo",
      operation: {
        type: "create",
        name: "New circle",
        description: "Synthetic",
      },
    });
    expect(result.ok).toBe(true);
    expect(result.state.groups[1].members).toHaveLength(1);
    expect(projectGroup(result.state.groups[1], "self")).toBeNull();
  });
});
