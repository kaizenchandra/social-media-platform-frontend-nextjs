export type AuthMode = "mock" | "unavailable";
export type AuthErrorCode =
  | "validation"
  | "invalid_credentials"
  | "expired"
  | "unauthorized"
  | "forbidden"
  | "network"
  | "conflict"
  | "unavailable"
  | "invalid_challenge"
  | "rate_limited";
export type AuthError = {
  code: AuthErrorCode;
  message: string;
  retryable: boolean;
  fields?: Record<string, string>;
};
export type AuthOutcome =
  | { ok: true; message: string; next?: string }
  | { ok: false; error: AuthError };
export type AuthProfile = {
  id: string;
  email: string;
  displayName: string;
  username: string;
  bio: string;
  onboarded: boolean;
  version: number;
};
export type DeviceSession = {
  id: string;
  label: string;
  current: boolean;
  trusted: boolean;
  createdAt: string;
  expiresAt: string;
};
export type AccountSnapshot = {
  profile: AuthProfile;
  sessions: DeviceSession[];
  expiresAt: string;
};
export const previewHints = {
  username: "demo",
  accountId: "00000000-0000-4000-8000-000000000007",
  email: "member@example.test",
  password: "Preview-only-42!",
  verificationCode: "123456",
  recoveryCode: "DEMO-RECOVER",
} as const;
