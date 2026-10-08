"use client";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/primitives";
import { communityAction } from "./actions";
import { trustAction } from "@/features/trust/actions";
export function ActionForm({
  base,
  label,
  children,
  trust = false,
}: {
  base: Record<string, unknown>;
  label: string;
  children?: ReactNode;
  trust?: boolean;
}) {
  const [message, setMessage] = useState(""),
    [pending, start] = useTransition();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(timer);
  }, []);
  const busy = useRef(false);
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  return (
    <form
      method="post"
      className="discovery-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || busy.current) return;
        const data = new FormData(e.currentTarget),
          input = { ...base };
        for (const [key, value] of data) input[key] = value;
        for (const key of [
          "announcement",
          "discoverable",
          "loginAlerts",
          "sessionReviewReminder",
        ])
          if (key in base) input[key] = data.has(key);
        const fingerprint = JSON.stringify(input);
        if (request.current?.fingerprint !== fingerprint)
          request.current = { fingerprint, id: crypto.randomUUID() };
        const id = request.current.id;
        busy.current = true;
        start(async () => {
          try {
            const result = trust
              ? await trustAction(input, id)
              : await communityAction(input, id);
            setMessage(result.message);
            if (result.ok) request.current = null;
          } catch {
            setMessage(
              "Connection interrupted. Reload to verify the result before retrying.",
            );
          } finally {
            busy.current = false;
          }
        });
      }}
    >
      {children}
      <Button disabled={!ready || pending} type="submit">
        {pending ? "Working…" : label}
      </Button>
      <noscript>
        JavaScript is required to submit this private preview form.
      </noscript>
      <p role="status">{message}</p>
    </form>
  );
}
