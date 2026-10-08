export type Delivery =
  "queued" | "sending" | "sent" | "delivered" | "read" | "failed";
export type Attachment = {
  id: string;
  name: string;
  kind: "image" | "audio" | "file";
  url: string;
  size: number;
};
export type Message = {
  id: string;
  serverId?: string;
  conversationId: string;
  sender: "self" | "peer";
  sequence: number;
  createdAt: string;
  text: string;
  delivery: Delivery;
  attempts: number;
  retried: boolean;
  revision: number;
  edited: boolean;
  lifecycle: "active" | "deleted" | "expired";
  replyTo?: string;
  attachments: Attachment[];
  reactions: string[];
  saved: boolean;
  pinned: boolean;
};
export type Conversation = {
  id: string;
  name: string;
  initials: string;
  subtitle: string;
  request: boolean;
  blocked: boolean;
  permitted: boolean;
  muted: boolean;
  unread: number;
};
export type MessagingState = {
  conversations: Conversation[];
  messages: Message[];
  connection: "connected" | "offline" | "disconnected";
};
export type MessageEvent =
  | { type: "enqueue"; message: Message }
  | { type: "connection"; connection: MessagingState["connection"] }
  | { type: "permission"; conversationId: string; permitted: boolean }
  | {
      type: "conversation";
      conversationId: string;
      change: Partial<
        Pick<Conversation, "blocked" | "muted" | "request" | "unread">
      >;
    }
  | { type: "attempt"; id: string }
  | {
      type: "ack";
      id: string;
      attempt: number;
      delivery: "sent" | "delivered" | "read" | "failed";
      serverId?: string;
    }
  | { type: "edit"; id: string; text: string }
  | { type: "lifecycle"; id: string; lifecycle: "deleted" | "expired" }
  | { type: "toggle"; id: string; field: "saved" | "pinned" }
  | { type: "reaction"; id: string; emoji: string };
