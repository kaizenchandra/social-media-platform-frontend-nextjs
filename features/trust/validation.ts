import { z } from "zod";
const id = z.string().trim().min(1).max(100);
export const trustCommand = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("privacy"),
      version: z.number().int().nonnegative(),
      discoverable: z.boolean(),
      audience: z.enum(["public", "friends", "private"]),
      loginAlerts: z.boolean(),
      sessionReviewReminder: z.boolean(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("report"),
      targetKind: z.enum(["content", "user", "message", "community"]),
      targetId: id,
      category: z.enum([
        "harassment",
        "deepfake",
        "intimate-image-abuse",
        "spam",
        "other",
      ]),
    })
    .strict(),
  z
    .object({
      operation: z.literal("appeal"),
      id,
      version: z.number().int().nonnegative(),
      text: z.string().trim().min(10).max(1000),
    })
    .strict(),
  z
    .object({
      operation: z.literal("decision"),
      id,
      version: z.number().int().nonnegative(),
      decision: z.enum(["restrict", "dismiss", "uphold", "reverse"]),
      reason: z.enum([
        "policy-violation",
        "insufficient-evidence",
        "successful-appeal",
      ]),
    })
    .strict(),
]);
export type TrustCommand = z.infer<typeof trustCommand>;
