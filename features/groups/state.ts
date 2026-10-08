import type {
  Group,
  GroupCommand,
  GroupResult,
  GroupState,
  Membership,
} from "./contracts";
import { people } from "./contracts";
export function member(group: Group, actor: string) {
  return group.members.find((m) => m.userId === actor);
}
export function isActive(group: Group, actor: string) {
  return member(group, actor)?.status === "active";
}
export function isAdmin(group: Group, actor: string) {
  return isActive(group, actor) && member(group, actor)?.role === "admin";
}
export function permitted(
  group: Group,
  actor: string,
  permission: "post" | "invite" | "collaborate",
) {
  return (
    isActive(group, actor) &&
    (group.permissions[permission] === "everyone" || isAdmin(group, actor))
  );
}
export function projectGroup(group: Group, actor: string): Group | null {
  const membership = member(group, actor);
  if (membership?.status !== "active") return null;
  const visible = (sequence: number) => sequence >= membership.joinedSequence;
  const messages = group.messages.filter((m) => visible(m.sequence));
  const ids = new Set(messages.map((m) => m.id));
  return {
    ...group,
    messages: messages.map((m) =>
      m.parentId && !ids.has(m.parentId) ? { ...m, parentId: undefined } : m,
    ),
    polls: group.polls.filter((p) => visible(p.sequence)),
    collaboration: group.collaboration.filter((c) => visible(c.sequence)),
    audit: group.audit.filter((a) => visible(a.sequence)),
  };
}
const activeMember = (
  userId: string,
  role: Membership["role"],
  sequence: number,
): Membership => ({
  userId,
  role,
  status: "active",
  joinedSequence: sequence,
  notifications: "all",
});
export function createGroupPreview(): GroupState {
  return {
    applied: [],
    groups: [
      {
        id: "garden",
        name: "Saturday circle",
        description: "A small space to plan, make and share.",
        revision: 1,
        nextSequence: 4,
        members: [
          activeMember("self", "admin", 0),
          activeMember("maya", "admin", 0),
          activeMember("leo", "member", 0),
          { ...activeMember("sam", "member", 0), status: "requested" },
        ],
        permissions: {
          invite: "admin",
          post: "everyone",
          collaborate: "everyone",
          attachments: true,
        },
        channels: [
          { id: "general", name: "General", kind: "topic" },
          { id: "announcements", name: "Announcements", kind: "announcements" },
          { id: "weekend", name: "Weekend plans", kind: "topic" },
        ],
        messages: [
          {
            id: "welcome",
            senderId: "maya",
            channelId: "general",
            sequence: 1,
            text: "Welcome! Let's plan something lovely for Saturday.",
            mentions: [],
            pinned: true,
            attachments: [],
          },
          {
            id: "bring",
            senderId: "leo",
            channelId: "weekend",
            sequence: 2,
            text: "I'll bring the camera. @maya, any ideas for the route?",
            mentions: ["maya"],
            pinned: false,
            attachments: [],
          },
        ],
        polls: [
          {
            id: "time",
            question: "When shall we meet?",
            options: ["10 AM", "11 AM"],
            votes: {},
            closed: false,
            sequence: 3,
          },
        ],
        collaboration: [],
        audit: [],
      },
    ],
  };
}
export function executeGroup(
  state: GroupState,
  command: GroupCommand,
): GroupResult {
  const { actor, operation: op } = command;
  const fail = (
    error: "forbidden" | "conflict" | "invalid" | "network" | "unavailable",
    message: string,
  ): GroupResult => ({ state, ok: false, error, message });
  if (
    !people.some((p) => p.id === actor) ||
    !command.id ||
    command.id.length > 120
  )
    return fail("invalid", "Unknown preview participant or request.");
  const original = state.groups.find((g) => g.id === command.groupId);
  const replay = state.applied.find((a) => a.id === command.id);
  if (replay) {
    if (
      replay.actor !== actor ||
      replay.fingerprint !== JSON.stringify(command)
    )
      return fail(
        "conflict",
        "This request ID was already used for different content.",
      );
    if (!original || !isActive(original, actor))
      return fail("forbidden", "Group access is no longer available.");
    return { state, ok: true, replay: true };
  }
  if (
    state.groups.some((g) =>
      [...g.messages, ...g.polls, ...g.collaboration, ...g.channels].some(
        (item) => item.id === command.id,
      ),
    )
  )
    return fail("conflict", "This item identity already exists.");
  if (op.type === "create") {
    if (
      !op.name.trim() ||
      op.name.length > 80 ||
      op.description.length > 500 ||
      state.groups.length >= 20 ||
      original
    )
      return fail(
        "invalid",
        "Use a unique group ID, a name under 80 characters, and at most 20 local groups.",
      );
    const group: Group = {
      id: command.groupId,
      name: op.name.trim(),
      description: op.description.trim(),
      revision: 1,
      nextSequence: 1,
      members: [activeMember(actor, "admin", 0)],
      permissions: {
        invite: "admin",
        post: "everyone",
        collaborate: "everyone",
        attachments: true,
      },
      channels: [
        { id: "general", name: "General", kind: "topic" },
        { id: "announcements", name: "Announcements", kind: "announcements" },
      ],
      messages: [],
      polls: [],
      collaboration: [],
      audit: [],
    };
    return {
      ok: true,
      state: {
        groups: [...state.groups, group],
        applied: [
          ...state.applied,
          {
            id: command.id,
            actor,
            groupId: group.id,
            fingerprint: JSON.stringify(command),
          },
        ].slice(-500),
      },
    };
  }
  if (!original) return fail("unavailable", "This group is unavailable.");
  const membership = member(original, actor);
  if (!["accept", "request"].includes(op.type) && !isActive(original, actor))
    return fail(
      "forbidden",
      "Only active group members can access this action.",
    );
  if (command.revision !== original.revision)
    return fail(
      "conflict",
      "Group membership or content changed. Review the latest state and try again.",
    );
  const group = structuredClone(original);
  const seq = () => group.nextSequence++;
  const admin = isAdmin(group, actor);
  const validPerson = (id: string) => people.some((p) => p.id === id);
  const activeCount = () =>
    group.members.filter((m) => ["active", "invited"].includes(m.status))
      .length;
  const setMember = (m: Membership) => {
    group.members = group.members
      .filter((old) => old.userId !== m.userId)
      .concat(m);
  };
  const audit = (text: string) => group.audit.push({ sequence: seq(), text });
  switch (op.type) {
    case "details":
      if (!admin)
        return fail(
          "forbidden",
          "Only administrators can change group details.",
        );
      if (!op.name.trim() || op.name.length > 80 || op.description.length > 500)
        return fail(
          "invalid",
          "Provide a group name under 80 characters and details under 500.",
        );
      group.name = op.name.trim();
      group.description = op.description.trim();
      break;
    case "invite": {
      if (!permitted(group, actor, "invite"))
        return fail("forbidden", "You cannot invite members.");
      if (
        !validPerson(op.userId) ||
        op.userId === actor ||
        ["active", "invited", "requested"].includes(
          member(group, op.userId)?.status ?? "",
        ) ||
        activeCount() >= 30
      )
        return fail(
          "invalid",
          "Choose an eligible participant. Local groups support 30 members and pending invitations.",
        );
      if (op.fail) {
        setMember({
          ...activeMember(op.userId, "member", group.nextSequence),
          status: "failed",
        });
        break;
      }
      setMember({
        ...activeMember(op.userId, "member", group.nextSequence),
        status: "invited",
      });
      audit(`${actor} invited ${op.userId}. Acceptance required.`);
      break;
    }
    case "request":
      if (
        membership &&
        ["active", "invited", "requested", "removed"].includes(
          membership.status,
        )
      )
        return fail(
          "forbidden",
          "This participant cannot request membership now.",
        );
      setMember({
        ...activeMember(actor, "member", group.nextSequence),
        status: "requested",
      });
      audit(`${actor} requested membership.`);
      break;
    case "accept":
      if (membership?.status !== "invited" || activeCount() > 30)
        return fail("forbidden", "An active invitation is required.");
      setMember(activeMember(actor, "member", group.nextSequence));
      audit(`${actor} joined. History starts here.`);
      break;
    case "approve":
    case "reject":
    case "remove":
    case "role": {
      if (!admin)
        return fail(
          "forbidden",
          "Only administrators can manage membership or roles.",
        );
      const target = member(group, op.userId);
      if (!target) return fail("invalid", "Participant not found.");
      if (op.type === "approve" || op.type === "reject") {
        if (
          target.status !== "requested" ||
          (op.type === "approve" && activeCount() >= 30)
        )
          return fail(
            "invalid",
            "This membership request is no longer eligible.",
          );
        setMember(
          op.type === "approve"
            ? activeMember(target.userId, "member", group.nextSequence)
            : { ...target, status: "left" },
        );
      } else {
        if (target.status !== "active")
          return fail("invalid", "Only active members can be changed.");
        if (
          target.role === "admin" &&
          (op.type === "remove" || op.role === "member") &&
          group.members.filter(
            (m) => m.status === "active" && m.role === "admin",
          ).length === 1
        )
          return fail(
            "forbidden",
            "Keep at least one administrator. Promote another member first.",
          );
        setMember(
          op.type === "remove"
            ? { ...target, status: "removed" }
            : { ...target, role: op.role },
        );
      }
      audit(`${actor}: ${op.type} ${op.userId}.`);
      break;
    }
    case "leave":
      if (
        admin &&
        group.members.filter((m) => m.status === "active" && m.role === "admin")
          .length === 1
      )
        return fail(
          "forbidden",
          "Promote another administrator before leaving.",
        );
      setMember({ ...membership!, status: "left" });
      audit(`${actor} left.`);
      break;
    case "permissions":
      if (!admin)
        return fail("forbidden", "Only administrators can change permissions.");
      if (
        [
          op.permissions.invite,
          op.permissions.post,
          op.permissions.collaborate,
        ].some((p) => !["admin", "everyone"].includes(p)) ||
        typeof op.permissions.attachments !== "boolean"
      )
        return fail("invalid", "Invalid group permissions.");
      group.permissions = op.permissions;
      break;
    case "notifications":
      if (!["all", "mentions", "none"].includes(op.value))
        return fail("invalid", "Invalid preference.");
      setMember({ ...membership!, notifications: op.value });
      break;
    case "channel":
      if (!admin)
        return fail("forbidden", "Only administrators can create channels.");
      if (
        !op.name.trim() ||
        op.name.length > 60 ||
        group.channels.length >= 12 ||
        group.channels.some(
          (c) => c.name.toLowerCase() === op.name.trim().toLowerCase(),
        )
      )
        return fail(
          "invalid",
          "Use a unique topic name under 60 characters, at most 12 channels.",
        );
      group.channels.push({
        id: command.id,
        name: op.name.trim(),
        kind: op.kind,
      });
      break;
    case "send": {
      const channel = group.channels.find((c) => c.id === op.channelId);
      if (
        !channel ||
        !permitted(group, actor, "post") ||
        (channel.kind === "announcements" && !admin)
      )
        return fail("forbidden", "Posting is not permitted in this channel.");
      const visible = projectGroup(group, actor)!;
      const parent = op.parentId
        ? visible.messages.find(
            (m) =>
              m.id === op.parentId &&
              m.channelId === op.channelId &&
              !m.parentId,
          )
        : null;
      if (
        (op.parentId && !parent) ||
        (!op.text.trim() && !op.attachments.length) ||
        op.text.length > 4000 ||
        op.mentions.some((id) => !isActive(group, id))
      )
        return fail(
          "invalid",
          "Check the message, thread and active mentions.",
        );
      if (
        op.attachments.length > 4 ||
        (op.attachments.length && !group.permissions.attachments) ||
        op.attachments.some(
          (a) => a.size > 10 * 1024 * 1024 || !a.url.startsWith("blob:"),
        )
      )
        return fail(
          "invalid",
          "Attachments are disabled or exceed local preview limits.",
        );
      if (op.fail)
        return fail(
          "network",
          "Simulated send failed. Draft retained; retry manually.",
        );
      if (group.messages.length >= 500)
        return fail("invalid", "Local history limit reached (500 messages).");
      group.messages.push({
        id: command.id,
        senderId: actor,
        channelId: op.channelId,
        sequence: seq(),
        text: op.text.trim(),
        mentions: [...new Set(op.mentions)],
        parentId: op.parentId,
        attachments: op.attachments,
        pinned: false,
      });
      break;
    }
    case "pin": {
      if (!admin)
        return fail("forbidden", "Only administrators can pin messages.");
      const message = group.messages.find(
        (m) =>
          m.id === op.messageId &&
          projectGroup(group, actor)!.messages.some((v) => v.id === m.id),
      );
      if (!message) return fail("invalid", "Message unavailable.");
      message.pinned = !message.pinned;
      break;
    }
    case "poll":
      if (!permitted(group, actor, "collaborate"))
        return fail("forbidden", "Poll creation is not permitted.");
      if (
        !op.question.trim() ||
        op.question.length > 200 ||
        op.options.length < 2 ||
        op.options.length > 6 ||
        op.options.some((o) => !o.trim() || o.length > 80) ||
        new Set(op.options.map((o) => o.trim().toLowerCase())).size !==
          op.options.length ||
        group.polls.length >= 50
      )
        return fail(
          "invalid",
          "Use a question and 2–6 distinct options under 80 characters.",
        );
      group.polls.push({
        id: command.id,
        question: op.question.trim(),
        options: op.options.map((o) => o.trim()),
        votes: {},
        closed: false,
        sequence: seq(),
      });
      break;
    case "vote":
    case "close-poll": {
      const poll = group.polls.find(
        (p) =>
          p.id === op.pollId &&
          projectGroup(group, actor)!.polls.some((v) => v.id === p.id),
      );
      if (!poll) return fail("invalid", "Poll unavailable.");
      if (op.type === "close-poll") {
        if (!admin)
          return fail("forbidden", "Only administrators can close polls.");
        poll.closed = true;
      } else {
        if (
          poll.closed ||
          !Number.isInteger(op.option) ||
          op.option < 0 ||
          op.option >= poll.options.length
        )
          return fail("invalid", "Poll closed or option unavailable.");
        poll.votes[actor] = op.option;
      }
      break;
    }
    case "collaboration": {
      if (!permitted(group, actor, "collaborate"))
        return fail("forbidden", "Collaboration changes are not permitted.");
      if (
        !op.title.trim() ||
        op.title.length > 120 ||
        op.body.length > 4000 ||
        (op.assignee && !isActive(group, op.assignee)) ||
        (["event", "reminder"].includes(op.kind) && !op.due) ||
        (op.due && !Number.isFinite(Date.parse(op.due)))
      )
        return fail(
          "invalid",
          "Provide a title, valid date where required, and an active assignee.",
        );
      const existing = op.itemId
        ? group.collaboration.find(
            (c) =>
              c.id === op.itemId &&
              projectGroup(group, actor)!.collaboration.some(
                (v) => v.id === c.id,
              ),
          )
        : undefined;
      if (op.itemId && (!existing || existing.revision !== op.itemRevision))
        return fail(
          "conflict",
          "The shared item changed. Review it before saving.",
        );
      if (!existing && group.collaboration.length >= 100)
        return fail("invalid", "Local collaboration limit reached.");
      const item = {
        id: existing?.id ?? command.id,
        kind: op.kind,
        title: op.title.trim(),
        body: op.body.trim(),
        assignee: op.assignee,
        due: op.due,
        completed: existing?.completed ?? false,
        attendees: existing?.attendees ?? [],
        sequence: existing?.sequence ?? seq(),
        revision: (existing?.revision ?? 0) + 1,
      };
      group.collaboration = group.collaboration
        .filter((c) => c.id !== item.id)
        .concat(item);
      break;
    }
    case "complete":
    case "rsvp": {
      if (!permitted(group, actor, "collaborate"))
        return fail("forbidden", "Collaboration changes are not permitted.");
      const item = group.collaboration.find(
        (c) =>
          c.id === op.itemId &&
          projectGroup(group, actor)!.collaboration.some((v) => v.id === c.id),
      );
      if (
        !item ||
        (op.type === "complete" && !["task", "reminder"].includes(item.kind)) ||
        (op.type === "rsvp" && item.kind !== "event")
      )
        return fail("invalid", "Shared item unavailable.");
      if (op.type === "complete") item.completed = !item.completed;
      else
        item.attendees = item.attendees.includes(actor)
          ? item.attendees.filter((a) => a !== actor)
          : [...item.attendees, actor];
      item.revision++;
      break;
    }
  }
  group.revision++;
  const next = {
    groups: state.groups.map((g) => (g.id === group.id ? group : g)),
    applied: [
      ...state.applied,
      {
        id: command.id,
        actor,
        groupId: group.id,
        fingerprint: JSON.stringify(command),
      },
    ].slice(-500),
  };
  return { state: next, ok: true };
}
