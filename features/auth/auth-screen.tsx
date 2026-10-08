import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Alert, Badge, Card } from "@/components/ui/primitives";
import { getAuthMode } from "@/lib/auth/server";
import { AuthForm, type AuthFormKind } from "./auth-form";

export function AuthScreen({
  kind,
  notice,
  returnTo,
}: {
  kind: AuthFormKind;
  notice?: string;
  returnTo?: string;
}) {
  const mode = getAuthMode();
  const titles: Record<AuthFormKind, [string, string]> = {
    login: ["Welcome back.", "A little more connection, on your terms."],
    register: [
      "A fresh beginning.",
      "Prepare a preview account for the Common experience.",
    ],
    "verify-email": [
      "Check your email.",
      "Confirm your preview email with a simulated code.",
    ],
    "forgot-password": [
      "Let’s get you back in.",
      "Start a password reset without disclosing whether an account exists.",
    ],
    "reset-password": [
      "Choose a new password.",
      "Complete your preview reset with a simulated verification code.",
    ],
    mfa: ["One more step.", "Confirm the simulated second-factor challenge."],
    recovery: [
      "Recover your access.",
      "Use a preview recovery code when another sign-in method is unavailable.",
    ],
  };
  return (
    <div className="page-content auth-page">
      <div className="page-heading">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <Badge tone={mode === "mock" ? "warning" : "neutral"}>
          {mode === "mock"
            ? "Development simulation"
            : "Integration unavailable"}
        </Badge>
      </div>
      <span className="feature-icon">
        <KeyRound size={22} aria-hidden="true" />
      </span>
      <h1>{titles[kind][0]}</h1>
      <p className="page-intro">{titles[kind][1]}</p>
      <Alert
        title={
          mode === "mock"
            ? "Preview authentication only"
            : "Authentication is not connected"
        }
        tone="warning"
      >
        {mode === "mock"
          ? "This does not verify a real identity or provide production security. Use only synthetic .test emails and preview passwords. No email is sent."
          : "No identity provider is configured. These forms remain unavailable in production. No fixture account can grant production access."}
      </Alert>
      {notice ? <Alert title="Account update">{notice}</Alert> : null}
      <noscript>
        <p className="alert">
          JavaScript is required for this preview. Form submission stays
          disabled until the page is ready.
        </p>
      </noscript>
      <Card className="sample-card auth-card">
        <AuthForm kind={kind} available={mode === "mock"} returnTo={returnTo} />
      </Card>
      <p className="auth-footer">
        <Link href="/overview">Back to overview</Link>
        <span>Common · Clear choices, thoughtful boundaries.</span>
      </p>
    </div>
  );
}
