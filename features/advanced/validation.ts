import { z } from "zod";
import {
  listingCategories,
  listingConditions,
  assistantTasks,
} from "./contracts";
const id = z.string().min(1).max(100),
  version = z.number().int().nonnegative(),
  text = z.string().trim().min(1).max(1200),
  confirmed = z.literal(true, {
    error: "Review and explicitly confirm this action.",
  });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const timeZone = z
  .string()
  .min(1)
  .max(80)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid IANA time zone.");
export const marketplaceQuery = z
  .object({
    q: z.string().trim().max(120).default(""),
    category: z.enum(["all", ...listingCategories]).default("all"),
    condition: z.enum(["all", ...listingConditions]).default("all"),
    collection: z.enum(["discover", "mine"]).default("discover"),
  })
  .strict();
export const advancedCommand = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("schedule"),
      publicationId: id,
      publicationVersion: version,
      at: z.string().datetime(),
      confirmed,
    })
    .strict(),
  z
    .object({ operation: z.literal("cancel-schedule"), id, version, confirmed })
    .strict(),
  z
    .object({
      operation: z.literal("listing"),
      id: id.optional(),
      version,
      title: text.max(80),
      description: text,
      category: z.enum(listingCategories),
      condition: z.enum(listingConditions),
      syntheticOnly: z.literal(true),
      confirmed,
    })
    .strict(),
  z
    .object({
      operation: z.literal("withdraw-listing"),
      id,
      version,
      confirmed,
    })
    .strict(),
  z
    .object({
      operation: z.literal("wellbeing"),
      version,
      screenTimeReminder: z.number().int().min(0).max(240),
      quietEnabled: z.boolean(),
      quietStart: time,
      quietEnd: time,
      timeZone,
      autoplay: z.boolean(),
      inAppNotifications: z.boolean(),
      pushNotifications: z.boolean(),
      emailNotifications: z.boolean(),
    })
    .strict()
    .refine(
      (c) => !c.quietEnabled || c.quietStart !== c.quietEnd,
      "Quiet hours must have different start and end times.",
    ),
  z
    .object({
      operation: z.literal("assistant-draft"),
      text: text.max(5000),
      syntheticOnly: z.literal(true),
      confirmed,
    })
    .strict(),
]);
export const assistantRequest = z
  .object({
    task: z.enum(assistantTasks),
    text: z.string().trim().max(5000),
    sourceId: id.optional(),
    language: z.enum(["en", "es", "fr", "hi"]),
    consent: z.literal(true),
    syntheticOnly: z.literal(true),
  })
  .strict()
  .refine(
    (r) =>
      ["translation", "summary"].includes(r.task) ? !!r.sourceId : !!r.text,
    "Provide synthetic draft text or select an eligible public source.",
  );
export type AdvancedCommand = z.infer<typeof advancedCommand>;
