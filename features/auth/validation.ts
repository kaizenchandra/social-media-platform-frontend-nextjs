import { z } from "zod";
const email = z.string().trim().email("Enter a valid email address.").max(254);
const password = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use at most 128 characters.");
const code = z.string().regex(/^\d{6}$/, "Enter the six-digit code.");
const displayName = z
  .string()
  .trim()
  .min(1, "Enter a display name.")
  .max(60, "Use at most 60 characters.");
const bio = z.string().trim().max(280, "Use at most 280 characters.");
export const commands = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("login"),
    email: z
      .union([email, z.literal("demo")])
      .transform((value) => (value === "demo" ? "member@example.test" : value)),
    password: z.string().min(1, "Enter your password.").max(128),
    returnTo: z.string().max(100).optional(),
  }),
  z
    .object({
      operation: z.literal("register"),
      email,
      password,
      confirmPassword: z.string(),
      displayName,
      consent: z.literal(true, {
        error: "Confirm that you are using synthetic preview details.",
      }),
    })
    .refine((input) => input.password === input.confirmPassword, {
      path: ["confirmPassword"],
      message: "Passwords must match.",
    }),
  z.object({ operation: z.literal("verify-email"), code }),
  z.object({ operation: z.literal("resend-email") }),
  z.object({ operation: z.literal("forgot-password"), email }),
  z
    .object({
      operation: z.literal("reset-password"),
      code,
      password,
      confirmPassword: z.string(),
    })
    .refine((input) => input.password === input.confirmPassword, {
      path: ["confirmPassword"],
      message: "Passwords must match.",
    }),
  z.object({ operation: z.literal("mfa"), code }),
  z.object({
    operation: z.literal("recovery"),
    email,
    recoveryCode: z
      .string()
      .trim()
      .min(1, "Enter your recovery code.")
      .max(100),
  }),
  z.object({
    operation: z.literal("onboarding"),
    displayName,
    username: z
      .string()
      .trim()
      .regex(
        /^[a-z][a-z0-9_]{2,29}$/,
        "Use 3–30 lowercase letters, numbers or underscores, starting with a letter.",
      ),
    bio,
  }),
  z.object({
    operation: z.literal("update-account"),
    displayName,
    bio,
    version: z.number().int().positive(),
  }),
  z.object({
    operation: z.literal("revoke-session"),
    sessionId: z.string().uuid(),
  }),
  z.object({
    operation: z.literal("trust-device"),
    sessionId: z.string().uuid(),
    trusted: z.boolean(),
  }),
  z.object({ operation: z.literal("logout") }),
  z.object({
    operation: z.literal("deactivate"),
    password: z.string().min(1),
    confirmation: z.literal("DEACTIVATE", {
      error: "Type DEACTIVATE to confirm.",
    }),
  }),
  z.object({
    operation: z.literal("delete-account"),
    password: z.string().min(1),
    confirmation: z.literal("DELETE", { error: "Type DELETE to confirm." }),
  }),
  z.object({ operation: z.literal("expire-session") }),
]);
export type AuthCommand = z.infer<typeof commands>;
export type AuthOperation = AuthCommand["operation"];
export function validationFields(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}
const safeRoutes = new Set([
  "/",
  "/account",
  "/account/sessions",
  "/onboarding",
  "/profile",
  "/connections",
  "/saved",
  "/create",
  "/drafts",
  "/messages",
  "/groups",
  "/communities",
  "/pages",
  "/search",
  "/privacy",
  "/reports",
  "/moderation",
  "/stories",
  "/stories/create",
  "/reels",
  "/reels/create",
  "/videos",
  "/videos/create",
  "/live",
  "/creator",
  "/marketplace",
  "/assistant",
  "/wellbeing",
]);
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > 100) return "/account";
  return safeRoutes.has(value) ||
    /^\/(?:content\/[a-zA-Z0-9-]{1,80}(?:\/appeal)?|posts\/[a-zA-Z0-9_-]{1,80}|communities\/[a-zA-Z0-9-]{1,80}|videos\/[a-zA-Z0-9-]{1,80}|marketplace\/(?:sellers\/)?[a-zA-Z0-9-]{1,80}|profile\/[a-z0-9_]{3,30})$/.test(
      value,
    )
    ? value
    : "/account";
}
