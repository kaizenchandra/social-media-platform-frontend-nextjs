import { z } from "zod";
import { feedModes } from "./contracts";
const id = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,80}$/, "Invalid content reference.");
const version = z.number().int().nonnegative();
const text = z
  .string()
  .trim()
  .min(1, "Write a comment before sending.")
  .max(1000, "Keep comments under 1,000 characters.");
export const feedQuery = z.object({
  mode: z.enum(feedModes).optional(),
  cursor: z.string().uuid().optional(),
});
export const feedCommand = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("reaction"),
    postId: id,
    version,
    value: z.enum(["like", "love", "support"]).nullable(),
  }),
  z.object({
    operation: z.enum(["save", "repost"]),
    postId: id,
    version,
    enabled: z.boolean(),
  }),
  z.object({ operation: z.enum(["hide", "mute", "share"]), postId: id }),
  z.object({
    operation: z.literal("comment"),
    postId: id,
    parentId: id.nullable(),
    text,
  }),
  z.object({
    operation: z.literal("edit-comment"),
    postId: id,
    commentId: id,
    version,
    text,
  }),
  z.object({
    operation: z.literal("delete-comment"),
    postId: id,
    commentId: id,
    version,
  }),
  z.object({
    operation: z.literal("preferences"),
    version,
    defaultMode: z.enum([
      "home",
      "friends",
      "following",
      "chronological",
      "recommended",
    ]),
    includeRecommendations: z.boolean(),
    prioritizeFavorites: z.boolean(),
    mediaOnly: z.boolean(),
  }),
  z.object({ operation: z.literal("unmute"), authorId: id }),
  z.object({ operation: z.literal("reset-hidden") }),
  z.object({
    operation: z.literal("report-draft"),
    postId: id,
    reason: z.enum(
      ["spam", "harassment", "misinformation", "privacy", "other"],
      { error: "Choose a report reason." },
    ),
    details: z.string().trim().max(500),
  }),
]);
export type FeedCommand = z.infer<typeof feedCommand>;
export type FeedQuery = z.infer<typeof feedQuery>;
