import type { Attachment } from "@/features/messaging/contracts";
export type Role = "admin" | "member";
export type Membership = {
  userId: string;
  role: Role;
  status: "active" | "invited" | "requested" | "removed" | "left" | "failed";
  joinedSequence: number;
  notifications: "all" | "mentions" | "none";
};
export type Channel = {
  id: string;
  name: string;
  kind: "topic" | "announcements";
};
export type GroupMessage = {
  id: string;
  senderId: string;
  channelId: string;
  sequence: number;
  text: string;
  mentions: string[];
  parentId?: string;
  pinned: boolean;
  attachments: Attachment[];
};
export type Collaboration = {
  id: string;
  kind: "note" | "task" | "reminder" | "event";
  title: string;
  body: string;
  assignee?: string;
  due?: string;
  completed: boolean;
  attendees: string[];
  sequence: number;
  revision: number;
};
export type Poll = {
  id: string;
  question: string;
  options: string[];
  votes: Record<string, number>;
  closed: boolean;
  sequence: number;
};
export type Group = {
  id: string;
  name: string;
  description: string;
  revision: number;
  nextSequence: number;
  members: Membership[];
  permissions: {
    invite: Role | "everyone";
    post: Role | "everyone";
    collaborate: Role | "everyone";
    attachments: boolean;
  };
  channels: Channel[];
  messages: GroupMessage[];
  polls: Poll[];
  collaboration: Collaboration[];
  audit: { sequence: number; text: string }[];
};
export type GroupState = {
  groups: Group[];
  applied: {
    id: string;
    actor: string;
    groupId: string;
    fingerprint: string;
  }[];
};
export const people = [
  { id: "self", name: "You" },
  { id: "maya", name: "Maya Chen" },
  { id: "leo", name: "Leo Martin" },
  { id: "sam", name: "Sam Rivera" },
  { id: "noah", name: "Noah Ellis" },
];
export type GroupOperation =
  | { type: "create"; name: string; description: string }
  | { type: "details"; name: string; description: string }
  | { type: "invite"; userId: string; fail: boolean }
  | { type: "request" }
  | { type: "accept" }
  | { type: "approve"; userId: string }
  | { type: "reject"; userId: string }
  | { type: "remove"; userId: string }
  | { type: "role"; userId: string; role: Role }
  | { type: "leave" }
  | { type: "permissions"; permissions: Group["permissions"] }
  | { type: "notifications"; value: Membership["notifications"] }
  | { type: "channel"; name: string; kind: Channel["kind"] }
  | {
      type: "send";
      channelId: string;
      text: string;
      mentions: string[];
      parentId?: string;
      attachments: Attachment[];
      fail?: boolean;
    }
  | { type: "pin"; messageId: string }
  | { type: "poll"; question: string; options: string[] }
  | { type: "vote"; pollId: string; option: number }
  | { type: "close-poll"; pollId: string }
  | {
      type: "collaboration";
      itemId?: string;
      itemRevision?: number;
      kind: Collaboration["kind"];
      title: string;
      body: string;
      assignee?: string;
      due?: string;
    }
  | { type: "complete" | "rsvp"; itemId: string };
export type GroupCommand = {
  id: string;
  actor: string;
  groupId: string;
  revision: number;
  operation: GroupOperation;
};
export type GroupResult =
  | { state: GroupState; ok: true; replay?: boolean }
  | {
      state: GroupState;
      ok: false;
      error: "forbidden" | "conflict" | "invalid" | "network" | "unavailable";
      message: string;
    };
