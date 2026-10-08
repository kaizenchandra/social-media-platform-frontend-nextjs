"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Dialog } from "@/components/ui/overlays";
import { Button, Alert } from "@/components/ui/primitives";
import { Input, Textarea, Select } from "@/components/ui/forms";
import { useProfileOperation } from "./use-profile-operation";
import { artwork, type ProfileView } from "./contracts";
export function ProfileEditor({ profile }: { profile: ProfileView }) {
  const [open, setOpen] = useState(false);
  const operation = useProfileOperation();
  const form = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (operation.outcome && !operation.outcome.ok)
      (
        form.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
        summary.current
      )?.focus();
  }, [operation.outcome]);
  if (
    profile.relationship.kind !== "owner" ||
    !profile.settings ||
    !profile.details
  )
    return null;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    operation.run(
      {
        ...Object.fromEntries(new FormData(e.currentTarget)),
        operation: "edit",
        version: profile.version,
      },
      () => setOpen(false),
    );
  }
  const choices = (
    <>
      <option value="public">Everyone</option>
      <option value="friends">Friends</option>
      <option value="private">Only me</option>
    </>
  );
  const assets = Object.entries(artwork).map(([id, asset]) => (
    <option key={id} value={id}>
      {asset.label}
    </option>
  ));
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button disabled={!operation.ready || operation.pending}>
            Edit profile
          </Button>
        }
        title="Edit your profile"
        description="Choose what you share. Artwork and content are synthetic development fixtures."
      >
        <form
          method="post"
          noValidate
          ref={form}
          onSubmit={submit}
          aria-label="Edit profile form"
          aria-busy={operation.pending}
        >
          <fieldset
            disabled={!operation.ready || operation.pending}
            className="auth-fieldset"
          >
            <Input
              name="displayName"
              label="Display name"
              defaultValue={profile.person.displayName}
              error={operation.fields.displayName}
              maxLength={60}
              required
            />
            <Textarea
              name="bio"
              label="Biography"
              defaultValue={profile.bio}
              error={operation.fields.bio}
              maxLength={280}
            />
            <Input
              name="location"
              label="Location"
              defaultValue={profile.details.location}
              error={operation.fields.location}
              maxLength={80}
            />
            <Input
              name="work"
              label="Work or interests"
              defaultValue={profile.details.work}
              error={operation.fields.work}
              maxLength={80}
            />
            <Input
              name="website"
              label="Website"
              hint="Optional HTTPS address. Visiting it leaves Common."
              defaultValue={profile.details.website}
              error={operation.fields.website}
            />
            <div className="profile-form-grid">
              <Select
                name="avatar"
                label="Avatar artwork"
                defaultValue={profile.person.avatar}
              >
                {assets}
              </Select>
              <Select
                name="cover"
                label="Cover artwork"
                defaultValue={profile.cover}
              >
                {assets}
              </Select>
            </div>
            <p className="field-hint">
              Photo uploads are unavailable until private storage and safety
              screening are connected. Only the listed local preview artwork can
              be published here.
            </p>
            <Select
              name="visibility"
              label="Who can view this profile?"
              defaultValue={profile.settings.visibility}
            >
              {choices}
            </Select>
            <Select
              name="detailsAudience"
              label="Who can view profile details?"
              defaultValue={profile.settings.detailsAudience}
            >
              {choices}
            </Select>
            <Select
              name="connectionsAudience"
              label="Who can view connection lists?"
              defaultValue={profile.settings.connectionsAudience}
            >
              {choices}
            </Select>
            <Button type="submit" pending={operation.pending}>
              Save profile
            </Button>
          </fieldset>
          {operation.outcome && !operation.outcome.ok ? (
            <div ref={summary} tabIndex={-1}>
              <Alert title="Profile not saved" tone="danger">
                {operation.outcome.error.message}
                {operation.outcome.error.code === "conflict" ? (
                  <Button
                    variant="ghost"
                    onClick={() => window.location.reload()}
                  >
                    Reload profile
                  </Button>
                ) : null}
                {operation.outcome.error.retryable ? (
                  <Button
                    variant="ghost"
                    onClick={() => form.current?.requestSubmit()}
                  >
                    Try again
                  </Button>
                ) : null}
              </Alert>
            </div>
          ) : null}
        </form>
      </Dialog>
      {operation.outcome?.ok ? (
        <Alert title="Saved" tone="success">
          {operation.outcome.message}
        </Alert>
      ) : null}
    </>
  );
}
