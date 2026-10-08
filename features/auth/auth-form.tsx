"use client";
import Link from "next/link";
import { useEffect, useRef, type FormEvent } from "react";
import { Button, Alert } from "@/components/ui/primitives";
import { Input } from "@/components/ui/forms";
import { previewHints } from "./contracts";
import { useAuthOperation } from "./use-auth-operation";

export type AuthFormKind =
  | "login"
  | "register"
  | "verify-email"
  | "forgot-password"
  | "reset-password"
  | "mfa"
  | "recovery";
export function AuthForm({
  kind,
  available,
  returnTo,
}: {
  kind: AuthFormKind;
  available: boolean;
  returnTo?: string;
}) {
  const operation = useAuthOperation();
  const form = useRef<HTMLFormElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const fields = operation.fields;
  useEffect(() => {
    if (operation.outcome && !operation.outcome.ok) {
      const first = form.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"]',
      );
      (first ?? errorSummary.current)?.focus();
    }
  }, [operation.outcome]);
  const email = ["login", "register", "forgot-password", "recovery"].includes(
    kind,
  );
  const password = ["login", "register", "reset-password"].includes(kind);
  const code = ["verify-email", "mfa", "reset-password"].includes(kind);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!available) return;
    const data = new FormData(event.currentTarget);
    const input: Record<string, unknown> = { operation: kind };
    for (const [key, value] of data) input[key] = value;
    if (kind === "register") input.consent = data.get("consent") === "on";
    if (kind === "login") input.returnTo = returnTo;
    void operation.run(input);
  }
  return (
    <>
      {available && !operation.ready ? (
        <p className="field-hint" role="status">
          JavaScript is required for this preview. Waiting for the form to
          become ready.
        </p>
      ) : null}
      <form
        method="post"
        ref={form}
        noValidate
        onSubmit={submit}
        aria-label={`${kind} form`}
        aria-busy={operation.pending}
      >
        <fieldset
          disabled={!available || !operation.ready || operation.pending}
          className="auth-fieldset"
        >
          {kind === "register" ? (
            <Input
              name="displayName"
              label="Display name"
              autoComplete="nickname"
              error={fields.displayName}
              maxLength={60}
              required
            />
          ) : null}
          {email ? (
            <Input
              name="email"
              label={
                kind === "login" ? "Email address or username" : "Email address"
              }
              type={kind === "login" ? "text" : "email"}
              autoComplete={kind === "login" ? "username" : "email"}
              placeholder={kind === "login" ? "demo" : "you@example.test"}
              hint={
                kind === "login" && available
                  ? `Dummy username: ${previewHints.username}. Password: ${previewHints.password}.`
                  : undefined
              }
              error={fields.email}
              required
            />
          ) : null}
          {password ? (
            <Input
              name="password"
              label={kind === "reset-password" ? "New password" : "Password"}
              type="password"
              autoComplete={
                kind === "login" ? "current-password" : "new-password"
              }
              hint={
                kind !== "login"
                  ? "12–128 characters. Use a password made only for this preview."
                  : undefined
              }
              error={fields.password}
              required
            />
          ) : null}
          {kind === "register" || kind === "reset-password" ? (
            <Input
              name="confirmPassword"
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              error={fields.confirmPassword}
              required
            />
          ) : null}
          {code ? (
            <Input
              name="code"
              label="Verification code"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              hint={
                available
                  ? `Simulated code: ${previewHints.verificationCode}. No provider verification occurs.`
                  : "Code verification requires an identity provider."
              }
              error={fields.code}
              required
            />
          ) : null}
          {kind === "recovery" ? (
            <Input
              name="recoveryCode"
              label="Recovery code"
              autoComplete="off"
              hint={
                available
                  ? `Public preview code: ${previewHints.recoveryCode}. This is not identity verification.`
                  : undefined
              }
              error={fields.recoveryCode}
              required
            />
          ) : null}
          {kind === "register" ? (
            <div className="field">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="consent"
                  aria-describedby={
                    fields.consent ? "consent-error" : undefined
                  }
                  aria-invalid={!!fields.consent}
                />
                I am using synthetic preview details.
              </label>
              {fields.consent ? (
                <p className="field-error" id="consent-error">
                  {fields.consent}
                </p>
              ) : null}
            </div>
          ) : null}
          <Button
            type="submit"
            pending={operation.pending}
            className="auth-submit"
          >
            {kind === "login"
              ? "Sign in"
              : kind === "register"
                ? "Create preview account"
                : kind === "forgot-password"
                  ? "Prepare reset"
                  : kind === "reset-password"
                    ? "Reset preview password"
                    : kind === "recovery"
                      ? "Start recovery"
                      : "Confirm code"}
          </Button>
        </fieldset>
      </form>
      {operation.outcome ? (
        <div ref={errorSummary} tabIndex={-1} className="operation-feedback">
          <Alert
            tone={operation.outcome.ok ? "success" : "danger"}
            title={
              operation.outcome.ok ? "Preview update" : "Could not continue"
            }
          >
            {operation.outcome.ok
              ? operation.outcome.message
              : operation.outcome.error.message}
          </Alert>
          {!operation.outcome.ok && operation.outcome.error.retryable ? (
            <Button
              variant="secondary"
              pending={operation.pending}
              onClick={() => form.current?.requestSubmit()}
            >
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}
      {kind === "verify-email" ? (
        <Button
          variant="ghost"
          disabled={!available}
          pending={operation.pending}
          onClick={() => void operation.run({ operation: "resend-email" })}
        >
          Resend preview code
        </Button>
      ) : null}
      {kind === "login" ? (
        <>
          <div className="auth-links">
            <Link href="/forgot-password">Forgot password?</Link>
            <Link href="/recovery">Account recovery</Link>
          </div>
          <div className="passkey-entry">
            <Button
              variant="secondary"
              disabled
              aria-describedby="passkey-status"
            >
              Sign in with a passkey
            </Button>
            <p id="passkey-status" className="field-hint">
              Passkeys require a configured WebAuthn provider. They are not
              simulated.
            </p>
          </div>
          <p className="muted auth-bottom">
            New here? <Link href="/register">Create an account</Link>
          </p>
          {available ? (
            <details className="preview-scenarios">
              <summary>Development sign-in scenarios</summary>
              <p>
                Member: <code>{previewHints.email}</code>
              </p>
              <p>
                Password: <code>{previewHints.password}</code>
              </p>
              <p>
                MFA: <code>mfa@example.test</code> · code{" "}
                {previewHints.verificationCode}
              </p>
              <p>
                Unverified: <code>unverified@example.test</code>
              </p>
              <p>
                Failure: <code>offline@example.test</code>,{" "}
                <code>locked@example.test</code>, or{" "}
                <code>expired@example.test</code>
              </p>
              <p className="field-hint">
                All details are public synthetic fixtures. Sessions and accounts
                reset when the development process restarts.
              </p>
            </details>
          ) : null}
        </>
      ) : (
        <div className="auth-links">
          <Link href="/login">Back to sign in</Link>
          {kind === "reset-password" ||
          kind === "verify-email" ||
          kind === "mfa" ? (
            <Link
              href={kind === "reset-password" ? "/forgot-password" : "/login"}
            >
              Start a new challenge
            </Link>
          ) : null}
        </div>
      )}
    </>
  );
}
