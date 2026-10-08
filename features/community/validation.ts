import { z } from "zod";
const id = z.string().min(1).max(100);
const text = z.string().trim().min(1).max(1200);
export const communityCommand = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("create"),
      name: text.max(80),
      description: text.max(280),
      visibility: z.enum(["public", "private"]),
    })
    .strict(),
  z
    .object({
      operation: z.enum(["join", "leave"]),
      id,
      version: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("member"),
      id,
      version: z.number().int().nonnegative(),
      targetId: id,
      role: z.enum(["member", "admin", "none"]),
    })
    .strict(),
  z
    .object({
      operation: z.literal("post"),
      id,
      version: z.number().int().nonnegative(),
      text,
      topic: text.max(80),
      announcement: z.boolean(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("topic"),
      id,
      version: z.number().int().nonnegative(),
      text: text.max(80),
    })
    .strict(),
  z
    .object({
      operation: z.literal("event"),
      id,
      version: z.number().int().nonnegative(),
      text: text.max(80),
      date: z.string().datetime(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("rsvp"),
      id,
      version: z.number().int().nonnegative(),
      eventId: id,
      going: z.boolean(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("discussion"),
      id,
      version: z.number().int().nonnegative(),
      eventId: id,
      text,
    })
    .strict(),
  z
    .object({
      operation: z.literal("page"),
      id: id.optional(),
      version: z.number().int().nonnegative(),
      name: text.max(80),
      description: text.max(280),
    })
    .strict(),
]);
export type CommunityCommand = z.infer<typeof communityCommand>;
