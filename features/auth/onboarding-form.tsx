"use client";
import { useEffect, useRef, type FormEvent } from "react";
import { Input, Textarea } from "@/components/ui/forms";
import { Alert, Button, Card, Badge } from "@/components/ui/primitives";
import type { AccountSnapshot } from "./contracts";
import { useAuthOperation } from "./use-auth-operation";
import { SessionWatch } from "./account-panel";
export function OnboardingForm({ account }: { account: AccountSnapshot }) {
  const operation = useAuthOperation();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (operation.outcome && !operation.outcome.ok)
      form.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
  }, [operation.outcome]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void operation.run({
      operation: "onboarding",
      displayName: data.get("displayName"),
      username: data.get("username"),
      bio: data.get("bio"),
    });
  }
  return (
    <div className="page-content auth-page">
      <SessionWatch expiresAt={account.expiresAt} />
      <div className="page-heading">
        <p className="eyebrow">MAKE YOURSELF AT HOME</p>
        <Badge tone="warning">Development simulation</Badge>
      </div>
      <h1>A name for your space.</h1>
      <p className="page-intro">
        Prepare a synthetic profile. Media uploads and public profile sharing
        are outside this phase.
      </p>
      <Alert title="Preview profile only" tone="warning">
        Use made-up details. No real account or identity is connected.
      </Alert>
      <Card className="sample-card auth-card">
        <form method="post" ref={form} noValidate onSubmit={submit}>
          <fieldset
            className="auth-fieldset"
            disabled={!operation.ready || operation.pending}
          >
            <Input
              label="Display name"
              name="displayName"
              defaultValue={account.profile.displayName}
              error={operation.fields.displayName}
              maxLength={60}
              required
            />
            <Input
              label="Username"
              name="username"
              hint="3–30 lowercase letters, numbers or underscores; start with a letter."
              error={operation.fields.username}
              maxLength={30}
              required
            />
            <Textarea
              label="About you"
              name="bio"
              error={operation.fields.bio}
              maxLength={280}
            />
            <Button type="submit" pending={operation.pending}>
              Finish preview onboarding
            </Button>
          </fieldset>
        </form>
        {operation.outcome ? (
          <Alert
            title="Onboarding update"
            tone={operation.outcome.ok ? "success" : "danger"}
          >
            {operation.outcome.ok
              ? operation.outcome.message
              : operation.outcome.error.message}
          </Alert>
        ) : null}
      </Card>
    </div>
  );
}
