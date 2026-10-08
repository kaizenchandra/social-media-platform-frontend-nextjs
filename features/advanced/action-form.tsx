"use client";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/overlays";
import { advancedAction } from "./actions";
export function AdvancedForm({
  base,
  label,
  children,
  review = false,
}: {
  base: Record<string, unknown>;
  label: string;
  children?: ReactNode;
  review?: boolean;
}) {
  const [message, setMessage] = useState(""),
    [pending, start] = useTransition(),
    [open, setOpen] = useState(false),
    [prepared, setPrepared] = useState<Record<string, unknown> | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(timer);
  }, []);
  const busy = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  function submit(input: Record<string, unknown>) {
    if (!ready || busy.current) return;
    busy.current = true;
    const fingerprint = JSON.stringify(input);
    if (request.current?.fingerprint !== fingerprint)
      request.current = { fingerprint, id: crypto.randomUUID() };
    const id = request.current.id;
    setOpen(false);
    start(async () => {
      try {
        const result = await advancedAction(input, id);
        setMessage(result.ok ? result.message : result.error.message);
        if (result.ok) {
          request.current = null;
          if (input.operation === "wellbeing")
            window.dispatchEvent(new Event("common:wellbeing-change"));
        }
      } catch {
        setMessage(
          "Connection interrupted. Reload to check the result or explicitly retry the same request.",
        );
      } finally {
        busy.current = false;
      }
    });
  }
  return (
    <>
      <form
        method="post"
        ref={form}
        className="discovery-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready || busy.current) return;
          const data = new FormData(e.currentTarget),
            input = { ...base };
          for (const [key, value] of data) input[key] = value;
          for (const key of ["screenTimeReminder"])
            if (key in input) input[key] = Number(input[key]);
          for (const key of [
            "syntheticOnly",
            "quietEnabled",
            "autoplay",
            "inAppNotifications",
            "pushNotifications",
            "emailNotifications",
          ])
            if (key in base) input[key] = data.has(key);
          if (review) {
            setPrepared({ ...input, confirmed: true });
            setOpen(true);
          } else submit(input);
        }}
      >
        <fieldset disabled={!ready || pending} className="advanced-fields">
          {children}
          <Button type="submit" disabled={!ready || pending}>
            {pending ? "Working…" : label}
          </Button>
        </fieldset>
        <noscript>
          JavaScript is required to submit this private preview form.
        </noscript>
        <p role="status">{message}</p>
      </form>
      {review && (
        <Dialog
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            form.current
              ?.querySelector<HTMLButtonElement>('button[type="submit"]')
              ?.focus();
          }}
          open={open}
          onOpenChange={setOpen}
          trigger={
            <button hidden type="button">
              Review action
            </button>
          }
          title="Review and confirm"
          description="Check this private preview change. Nothing is published or sent to another person."
        >
          <dl className="review-fields">
            {Object.entries(prepared ?? {})
              .filter(
                ([k]) =>
                  ![
                    "confirmed",
                    "version",
                    "publicationVersion",
                    "operation",
                    "syntheticOnly",
                    "id",
                  ].includes(k),
              )
              .map(([key, value]) => (
                <div key={key}>
                  <dt>
                    {{
                      text: "Draft text",
                      title: "Listing title",
                      description: "Description",
                      category: "Category",
                      condition: "Condition",
                      at: "Planned time (UTC)",
                      publicationId: "Content reference",
                    }[key] ?? key}
                  </dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
          </dl>
          <div className="publication-actions">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Back to edit
            </Button>
            <Button
              onClick={() => prepared && submit(prepared)}
              disabled={!ready || pending}
            >
              Confirm {label.toLowerCase()}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
