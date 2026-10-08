"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Monitor, ShieldCheck } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
} from "@/components/ui/primitives";
import { Input, Textarea, Switch } from "@/components/ui/forms";
import { Dialog } from "@/components/ui/overlays";
import type { AccountSnapshot } from "./contracts";
import { useAuthOperation } from "./use-auth-operation";
import { checkSession } from "./actions";

function Feedback({
  operation,
}: {
  operation: ReturnType<typeof useAuthOperation>;
}) {
  return operation.outcome ? (
    <Alert
      tone={operation.outcome.ok ? "success" : "danger"}
      title={
        operation.outcome.ok ? "Preview updated" : "Action needs attention"
      }
    >
      {operation.outcome.ok
        ? operation.outcome.message
        : operation.outcome.error.message}
    </Alert>
  ) : null;
}
export function SessionWatch({ expiresAt }: { expiresAt: string }) {
  const [failed, setFailed] = useState(false);
  async function verify() {
    try {
      if (!(await checkSession()).active)
        window.location.replace("/login?reason=expired");
      else setFailed(false);
    } catch {
      setFailed(true);
    }
  }
  useEffect(() => {
    const expiration = () => window.location.replace("/login?reason=expired");
    const timer = window.setTimeout(
      expiration,
      Math.max(0, new Date(expiresAt).getTime() - Date.now()),
    );
    const onFocus = () => {
      void verify();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [expiresAt]);
  return failed ? (
    <Alert tone="warning" title="Session check interrupted">
      Reconnect before making account changes.{" "}
      <Button variant="secondary" onClick={() => void verify()}>
        Retry session check
      </Button>
    </Alert>
  ) : null;
}
function LifecycleAction({
  operation: kind,
}: {
  operation: "deactivate" | "delete-account";
}) {
  const operation = useAuthOperation();
  const confirmation = kind === "deactivate" ? "DEACTIVATE" : "DELETE";
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (operation.outcome && !operation.outcome.ok)
      form.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
  }, [operation.outcome]);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!operation.pending) setOpen(value);
      }}
      trigger={
        <Button
          disabled={!operation.ready || operation.pending}
          variant={kind === "deactivate" ? "secondary" : "danger"}
        >
          {kind === "deactivate"
            ? "Deactivate preview account"
            : "Delete preview account"}
        </Button>
      }
      title={
        kind === "deactivate" ? "Take a break" : "Delete the preview account?"
      }
      description={
        kind === "deactivate"
          ? "Deactivation ends all preview sessions. You can reactivate through the simulated recovery/reset flow."
          : "Deletion removes only this process-local preview account and its sessions. No real account, backups, or service data is deleted."
      }
    >
      <form
        method="post"
        ref={form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void operation.run({
            operation: kind,
            password: data.get("password"),
            confirmation: data.get("confirmation"),
          });
        }}
      >
        <fieldset
          className="auth-fieldset"
          disabled={!operation.ready || operation.pending}
        >
          <Input
            label="Current preview password"
            name="password"
            type="password"
            autoComplete="current-password"
            error={operation.fields.password}
            required
          />
          <Input
            label={`Type ${confirmation} to confirm`}
            name="confirmation"
            autoComplete="off"
            error={operation.fields.confirmation}
            required
          />
          <Button type="submit" variant="danger" pending={operation.pending}>
            Confirm {kind === "deactivate" ? "deactivation" : "deletion"}
          </Button>
        </fieldset>
      </form>
      <Feedback operation={operation} />
    </Dialog>
  );
}
export function AccountPanel({
  account,
  sessionsOnly = false,
}: {
  account: AccountSnapshot;
  sessionsOnly?: boolean;
}) {
  const router = useRouter();
  const operation = useAuthOperation(() => router.refresh());
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (operation.outcome && !operation.outcome.ok)
      form.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
  }, [operation.outcome]);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void operation.run({
      operation: "update-account",
      displayName: data.get("displayName"),
      bio: data.get("bio"),
      version: account.profile.version,
    });
  }
  return (
    <div className="page-content account-page">
      <SessionWatch expiresAt={account.expiresAt} />
      <div className="page-heading">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <Badge tone="warning">Development simulation</Badge>
      </div>
      <h1>
        {sessionsOnly
          ? "Your devices & sessions."
          : `Your space, ${account.profile.displayName}.`}
      </h1>
      <p className="page-intro">
        Manage this synthetic preview account. Every read and change checks the
        current preview session on the server.
      </p>
      <Alert tone="warning" title="No production account is connected">
        This is a process-local demonstration, not production authentication.
        Use synthetic details only; nothing here verifies a real identity.
      </Alert>
      <nav className="account-tabs" aria-label="Account">
        <Link href="/account" aria-current={!sessionsOnly ? "page" : undefined}>
          Account settings
        </Link>
        <Link
          href="/account/sessions"
          aria-current={sessionsOnly ? "page" : undefined}
        >
          Devices & sessions
        </Link>
      </nav>
      <Feedback operation={operation} />
      {!sessionsOnly ? (
        <>
          <Card className="sample-card">
            <h2>Account details</h2>
            <p className="muted account-email">
              {account.profile.email} · @{account.profile.username}
            </p>
            <form method="post" ref={form} noValidate onSubmit={save}>
              <fieldset
                className="auth-fieldset"
                disabled={!operation.ready || operation.pending}
              >
                <Input
                  name="displayName"
                  label="Display name"
                  defaultValue={account.profile.displayName}
                  error={operation.fields.displayName}
                  maxLength={60}
                  required
                />
                <Textarea
                  name="bio"
                  label="About you"
                  defaultValue={account.profile.bio}
                  error={operation.fields.bio}
                  maxLength={280}
                  hint="Synthetic details only. This text stays in the preview process."
                />
                <Button type="submit" pending={operation.pending}>
                  Save preview changes
                </Button>
              </fieldset>
            </form>
          </Card>
          <Card className="sample-card">
            <h2>Sign-in methods</h2>
            <p className="muted">
              Password and MFA are simulated. To try the second-factor flow,
              sign in using mfa@example.test.
            </p>
            <Button
              disabled
              variant="secondary"
              aria-describedby="account-passkey-info"
            >
              Manage passkeys
            </Button>
            <p id="account-passkey-info" className="field-hint">
              WebAuthn registration requires an identity provider. No keys are
              generated here.
            </p>
          </Card>
          <Card className="sample-card">
            <h2>Account lifecycle</h2>
            <p className="muted">
              These controls affect the synthetic account only. Both require
              password confirmation and end all its preview sessions.
            </p>
            <div className="sample-row">
              <LifecycleAction operation="deactivate" />
              <LifecycleAction operation="delete-account" />
            </div>
          </Card>
        </>
      ) : (
        <Card className="sample-card">
          <h2>Recognized devices</h2>
          <p className="muted">
            Labels and timestamps below describe synthetic sessions. Trust is a
            preview preference, not a security guarantee.
          </p>
          {account.sessions.length ? (
            <ul className="device-list">
              {account.sessions.map((session) => (
                <li key={session.id}>
                  <div className="device-heading">
                    <Monitor size={22} aria-hidden="true" />
                    <div>
                      <strong>{session.label}</strong>
                      <p className="field-hint">
                        {session.current
                          ? "Current preview session"
                          : "Example session"}{" "}
                        · Started{" "}
                        <time dateTime={session.createdAt}>
                          {new Date(session.createdAt).toLocaleDateString(
                            "en-GB",
                            { timeZone: "UTC" },
                          )}
                        </time>
                      </p>
                    </div>
                    {session.current ? (
                      <Badge tone="primary">Current</Badge>
                    ) : null}
                  </div>
                  <Switch
                    label={`Trust ${session.label}`}
                    checked={session.trusted}
                    disabled={!operation.ready || operation.pending}
                    onCheckedChange={(trusted) =>
                      void operation.run({
                        operation: "trust-device",
                        sessionId: session.id,
                        trusted,
                      })
                    }
                  />
                  <Button
                    disabled={!operation.ready || operation.pending}
                    variant="secondary"
                    pending={operation.pending}
                    onClick={() =>
                      void operation.run({
                        operation: "revoke-session",
                        sessionId: session.id,
                      })
                    }
                  >
                    End {session.current ? "this" : "example"} session
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No active sessions"
              description="Sign in to start a new preview session."
            />
          )}
        </Card>
      )}
      <div className="account-actions">
        <Button
          disabled={!operation.ready || operation.pending}
          variant="secondary"
          pending={operation.pending}
          onClick={() => void operation.run({ operation: "logout" })}
        >
          Sign out
        </Button>
        <Button
          disabled={!operation.ready || operation.pending}
          variant="ghost"
          pending={operation.pending}
          onClick={() => void operation.run({ operation: "expire-session" })}
        >
          <ShieldCheck size={17} aria-hidden="true" />
          Simulate session expiration
        </Button>
      </div>
    </div>
  );
}
