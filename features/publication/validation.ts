import { z } from "zod";
import { scenarios, mediaTypes } from "./contracts";
const extensions: Record<string, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "video/mp4": ["mp4"],
  "video/webm": ["webm"],
};
export const mediaInput = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .refine((name) => !/[\x00-\x1f/\\]/.test(name), "Use a plain file name."),
    type: z.enum(mediaTypes, { error: "Choose JPEG, PNG, WebP, MP4 or WebM." }),
    size: z.number().int().positive("Empty files cannot be attached."),
    alt: z.string().trim().max(300),
  })
  .superRefine((media, ctx) => {
    if (
      !extensions[media.type].includes(
        media.name.split(".").pop()!.toLowerCase(),
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: "File extension must match its declared type.",
      });
    if (media.size > (media.type.startsWith("image/") ? 10 : 50) * 1024 * 1024)
      ctx.addIssue({
        code: "custom",
        path: ["size"],
        message: "Images are limited to 10 MB; videos to 50 MB.",
      });
    if (media.type.startsWith("image/") && !media.alt)
      ctx.addIssue({
        code: "custom",
        path: ["alt"],
        message: "Describe this image for readers who cannot see it.",
      });
  });
export const draftInput = z
  .object({
    format: z.enum(["post", "story", "reel", "video"]).optional(),
    text: z.string().trim().max(5000, "Keep the post within 5,000 characters."),
    audience: z.enum(["private", "friends", "public"]),
    disclosure: z.enum([
      "not-declared",
      "ai-generated",
      "ai-edited",
      "unknown",
    ]),
    media: z.array(mediaInput).max(6, "Attach at most six files."),
    scenario: z.enum(scenarios),
    syntheticOnly: z.literal(true, {
      error: "Confirm that this preview uses only benign synthetic material.",
    }),
  })
  .superRefine((draft, ctx) => {
    if (
      (draft.format === "reel" || draft.format === "video") &&
      !draft.media.some((media) => media.type.startsWith("video/"))
    )
      ctx.addIssue({
        code: "custom",
        path: ["media"],
        message: "Recorded video drafts require a video attachment.",
      });
    if (!draft.text && !draft.media.length)
      ctx.addIssue({
        code: "custom",
        path: ["text"],
        message: "Write a post or attach media.",
      });
    if (
      draft.media.reduce((sum, media) => sum + media.size, 0) >
      100 * 1024 * 1024
    )
      ctx.addIssue({
        code: "custom",
        path: ["media"],
        message: "Total attachments must be within 100 MB.",
      });
  });
const revision = { id: z.uuid(), version: z.number().int().positive() };
export const publicationCommand = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("save"),
      id: z.uuid().optional(),
      version: z.number().int().positive().optional(),
      draft: draftInput,
    })
    .strict()
    .refine((value) => Boolean(value.id) === (value.version !== undefined), {
      path: ["version"],
      message: "Existing drafts require their current revision.",
    }),
  z.object({ operation: z.literal("begin"), ...revision }).strict(),
  z.object({ operation: z.literal("advance"), ...revision }).strict(),
  z.object({ operation: z.literal("retry"), ...revision }).strict(),
  z.object({ operation: z.literal("cancel"), id: z.uuid() }).strict(),
  z.object({ operation: z.literal("publish"), ...revision }).strict(),
]);
export type PublicationCommand = z.infer<typeof publicationCommand>;
export function publicationFields(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues)
    fields[issue.path.join(".") || "form"] ??= issue.message;
  return fields;
}
