"use client";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Dialog } from "@/components/ui/overlays";
import { Button, Alert } from "@/components/ui/primitives";
import { Select } from "@/components/ui/forms";
import { useFeedOperation } from "./use-feed-operation";
import type { FeedPreferences } from "./contracts";
export function Preferences({ preferences }: { preferences: FeedPreferences }) {
  const [open, setOpen] = useState(false);
  const operation = useFeedOperation(false);
  const form = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (operation.outcome && !operation.outcome.ok)
      (
        form.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
        summary.current
      )?.focus();
  }, [operation.outcome]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    operation.run(
      {
        operation: "preferences",
        version: preferences.version,
        defaultMode: data.get("defaultMode"),
        includeRecommendations: data.has("includeRecommendations"),
        prioritizeFavorites: data.has("prioritizeFavorites"),
        mediaOnly: data.has("mediaOnly"),
      },
      (result) => {
        if (result.ok) {
          setOpen(false);
          router.replace("/", { scroll: false });
        }
      },
    );
  }
  const disabled = !operation.ready || operation.pending;
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button variant="secondary" disabled={disabled}>
            <SlidersHorizontal size={17} aria-hidden="true" />
            Feed preferences
          </Button>
        }
        title="Your feed, your choices"
        description="These preferences affect this development preview. No AI ranking service or contact import is involved."
      >
        <form
          method="post"
          noValidate
          ref={form}
          onSubmit={submit}
          aria-label="Feed preferences form"
        >
          <fieldset className="auth-fieldset" disabled={disabled}>
            <Select
              label="Default feed"
              name="defaultMode"
              defaultValue={preferences.defaultMode}
              error={operation.fields.defaultMode}
            >
              <option value="home">Home</option>
              <option value="friends">Friends</option>
              <option value="following">Following</option>
              <option value="chronological">Chronological</option>
              <option value="recommended">Recommended</option>
            </Select>
            {(
              [
                [
                  "includeRecommendations",
                  "Include public discovery in Home",
                  preferences.includeRecommendations,
                ],
                [
                  "prioritizeFavorites",
                  "Prioritize favorites in Home",
                  preferences.prioritizeFavorites,
                ],
                [
                  "mediaOnly",
                  "Show only posts with media in feeds",
                  preferences.mediaOnly,
                ],
              ] as const
            ).map(([name, label, checked]) => (
              <label className="checkbox-row" key={name}>
                <input type="checkbox" name={name} defaultChecked={checked} />
                {label}
              </label>
            ))}
            <Button type="submit" pending={operation.pending}>
              Save feed preferences
            </Button>
          </fieldset>
        </form>
        <div className="feed-preference-management">
          <h3>Hidden posts</h3>
          <p>
            {preferences.hiddenCount} hidden from feeds. Saved posts are kept
            separately.
          </p>
          <Button
            variant="secondary"
            disabled={disabled || !preferences.hiddenCount}
            onClick={() => operation.run({ operation: "reset-hidden" })}
          >
            Reset hidden posts
          </Button>
          <h3>Muted accounts</h3>
          {preferences.muted.length ? (
            <ul>
              {preferences.muted.map((person) => (
                <li key={person.id}>
                  <span>{person.displayName}</span>
                  <Button
                    variant="ghost"
                    disabled={disabled}
                    onClick={() =>
                      operation.run({
                        operation: "unmute",
                        authorId: person.id,
                      })
                    }
                  >
                    Unmute {person.displayName}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No muted accounts.</p>
          )}
        </div>
        {operation.outcome ? (
          <div ref={summary} tabIndex={-1}>
            <Alert
              title={
                operation.outcome.ok
                  ? "Preferences updated"
                  : "Preferences not saved"
              }
              tone={operation.outcome.ok ? "success" : "danger"}
            >
              {operation.outcome.ok
                ? operation.outcome.message
                : operation.outcome.error.message}
              {!operation.outcome.ok && operation.outcome.error.retryable ? (
                <Button
                  variant="ghost"
                  onClick={() => form.current?.requestSubmit()}
                >
                  Try again
                </Button>
              ) : null}
              {!operation.outcome.ok &&
              operation.outcome.error.code === "conflict" ? (
                <Button
                  variant="ghost"
                  onClick={() => window.location.reload()}
                >
                  Reload preferences
                </Button>
              ) : null}
            </Alert>
          </div>
        ) : null}
      </Dialog>
      {operation.outcome?.ok ? (
        <p role="status">{operation.outcome.message}</p>
      ) : null}
    </>
  );
}
