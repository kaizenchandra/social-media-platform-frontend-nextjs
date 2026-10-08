import type { Message, MessageEvent, MessagingState } from "./contracts";
export const MAX_ATTEMPTS = 3;
const rank = {
  queued: 0,
  sending: 1,
  failed: 1,
  sent: 2,
  delivered: 3,
  read: 4,
};
export function canSend(state: MessagingState, conversationId: string) {
  const conversation = state.conversations.find((c) => c.id === conversationId);
  return (
    !!conversation &&
    conversation.permitted &&
    !conversation.blocked &&
    !conversation.request
  );
}
export function messagingReducer(
  state: MessagingState,
  event: MessageEvent,
): MessagingState {
  if (event.type === "connection")
    return { ...state, connection: event.connection };
  if (event.type === "permission" || event.type === "conversation") {
    return {
      ...state,
      conversations: state.conversations.map((c) =>
        c.id !== event.conversationId
          ? c
          : {
              ...c,
              ...(event.type === "permission"
                ? { permitted: event.permitted }
                : event.change),
            },
      ),
    };
  }
  if (event.type === "enqueue") {
    const m = event.message;
    if (
      !canSend(state, m.conversationId) ||
      state.messages.some(
        (existing) =>
          existing.id === m.id ||
          (m.serverId && existing.serverId === m.serverId),
      )
    )
      return state;
    return {
      ...state,
      messages: [...state.messages, m].sort((a, b) => a.sequence - b.sequence),
    };
  }
  return {
    ...state,
    messages: state.messages.map((m) => {
      if (m.id !== event.id || m.lifecycle !== "active") return m;
      const allowed = canSend(state, m.conversationId);
      switch (event.type) {
        case "attempt":
          if (
            !allowed ||
            state.connection !== "connected" ||
            m.sender !== "self" ||
            !["queued", "failed"].includes(m.delivery) ||
            m.attempts >= MAX_ATTEMPTS
          )
            return m;
          return {
            ...m,
            delivery: "sending",
            attempts: m.attempts + 1,
            retried: m.attempts > 0,
          };
        case "ack":
          if (
            !allowed ||
            event.attempt !== m.attempts ||
            m.attempts === 0 ||
            (event.serverId &&
              state.messages.some(
                (other) =>
                  other.id !== m.id && other.serverId === event.serverId,
              ))
          )
            return m;
          if (event.delivery === "failed")
            return m.delivery === "sending" ? { ...m, delivery: "failed" } : m;
          if (rank[event.delivery] <= rank[m.delivery]) return m;
          return {
            ...m,
            delivery: event.delivery,
            serverId: m.serverId ?? event.serverId,
          };
        case "edit":
          return allowed &&
            m.sender === "self" &&
            rank[m.delivery] >= 2 &&
            event.text.trim() &&
            event.text.length <= 4000
            ? {
                ...m,
                text: event.text.trim(),
                edited: true,
                revision: m.revision + 1,
              }
            : m;
        case "lifecycle":
          return event.lifecycle === "expired" ||
            (allowed && m.sender === "self")
            ? {
                ...m,
                lifecycle: event.lifecycle,
                text: "",
                attachments: [],
                reactions: [],
                saved: false,
                pinned: false,
                revision: m.revision + 1,
              }
            : m;
        case "toggle":
          return allowed ? { ...m, [event.field]: !m[event.field] } : m;
        case "reaction":
          return allowed
            ? {
                ...m,
                reactions: m.reactions.includes(event.emoji)
                  ? m.reactions.filter((e) => e !== event.emoji)
                  : [...m.reactions, event.emoji],
              }
            : m;
      }
    }),
  };
}
export function createPreviewState(): MessagingState {
  const seed = (
    id: string,
    conversationId: string,
    text: string,
    sequence: number,
    sender: Message["sender"] = "peer",
  ): Message => ({
    id,
    conversationId,
    text,
    sequence,
    sender,
    createdAt: "2026-10-09T09:30:00Z",
    delivery: "read",
    attempts: sender === "self" ? 1 : 0,
    retried: false,
    revision: 1,
    edited: false,
    lifecycle: "active",
    attachments: [],
    reactions: [],
    saved: false,
    pinned: false,
  });
  return {
    connection: "connected",
    conversations: [
      {
        id: "maya",
        name: "Maya Chen",
        initials: "MC",
        subtitle: "A little space for good conversations",
        request: false,
        blocked: false,
        permitted: true,
        muted: false,
        unread: 2,
      },
      {
        id: "leo",
        name: "Leo Martin",
        initials: "LM",
        subtitle: "Weekend plans",
        request: false,
        blocked: false,
        permitted: true,
        muted: false,
        unread: 0,
      },
      {
        id: "sam",
        name: "Sam Rivera",
        initials: "SR",
        subtitle: "Wants to connect",
        request: true,
        blocked: false,
        permitted: true,
        muted: false,
        unread: 1,
      },
    ],
    messages: [
      seed("m1", "maya", "Hey! Have you found a spot for Saturday?", 1),
      seed(
        "m2",
        "maya",
        "The little café by the garden looks lovely.",
        2,
        "self",
      ),
      seed("m3", "maya", "Perfect. Let's meet at 10 ☕", 3),
      seed("l1", "leo", "I'll bring my camera this weekend.", 4),
      seed("s1", "sam", "Hi, we met at the design workshop!", 5),
    ],
  };
}
