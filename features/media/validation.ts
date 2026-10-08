import { z } from "zod";
const target = { id: z.string().regex(/^[a-z0-9-]{1,80}$/) };
export const mediaCommand = z.discriminatedUnion("operation", [
  z
    .object({ operation: z.literal("save"), ...target, value: z.boolean() })
    .strict(),
  z
    .object({
      operation: z.literal("reaction"),
      ...target,
      value: z.enum(["love", "like"]).nullable(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("highlight"),
      ...target,
      value: z.boolean(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("comment"),
      ...target,
      text: z.string().trim().min(1).max(1500),
    })
    .strict(),
  z.object({ operation: z.literal("share"), ...target }).strict(),
]);
export type MediaCommand = z.infer<typeof mediaCommand>;
