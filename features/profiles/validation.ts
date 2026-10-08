import { z } from "zod";
const audience = z.enum(["public", "friends", "private"]);
const asset = z.enum(["coast", "garden", "studio"]);
export const profileCommand = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("edit"),
    version: z.string().max(40),
    displayName: z.string().trim().min(1, "Enter a display name.").max(60),
    bio: z.string().trim().max(280),
    location: z.string().trim().max(80),
    work: z.string().trim().max(80),
    website: z
      .string()
      .trim()
      .max(200)
      .refine(
        (v) =>
          !v ||
          (/^https:\/\//i.test(v) &&
            (() => {
              try {
                const u = new URL(v);
                return !!u.hostname && !u.username && !u.password;
              } catch {
                return false;
              }
            })()),
        "Use a complete HTTPS address without credentials.",
      ),
    avatar: asset,
    cover: asset,
    visibility: audience,
    detailsAudience: audience,
    connectionsAudience: audience,
  }),
  z.object({
    operation: z.literal("feature"),
    postId: z.string().max(80),
    version: z.string().max(40),
    enabled: z.boolean(),
  }),
  z.object({
    operation: z.enum([
      "request",
      "accept",
      "reject",
      "cancel",
      "unfriend",
      "follow",
      "unfollow",
      "favorite",
      "unfavorite",
      "block",
      "unblock",
      "restrict",
      "unrestrict",
    ]),
    targetId: z.string().min(1).max(80),
    version: z.number().int().nonnegative(),
  }),
]);
export type ProfileCommand = z.infer<typeof profileCommand>;
