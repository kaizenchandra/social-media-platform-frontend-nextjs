"use client";
import { useRef, useState, useEffect } from "react";
import type { AuthOutcome } from "./contracts";
import { commands, validationFields } from "./validation";
import { submitAuth } from "./actions";

export function useAuthOperation(
  onSuccess?: (outcome: Extract<AuthOutcome, { ok: true }>) => void,
) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Defer interactive readiness until the App Router's commit finishes.
    const timer = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(timer);
  }, []);
  const busy = useRef(false);
  const attempt = useRef<{ input: string; id: string } | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<AuthOutcome>();
  async function run(input: unknown) {
    if (busy.current) return;
    const parsed = commands.safeParse(input);
    if (!parsed.success) {
      setOutcome({
        ok: false,
        error: {
          code: "validation",
          message: "Check the highlighted fields.",
          retryable: false,
          fields: validationFields(parsed.error),
        },
      });
      return;
    }
    busy.current = true;
    setPending(true);
    setOutcome(undefined);
    try {
      const serialized = JSON.stringify(parsed.data);
      if (attempt.current?.input !== serialized)
        attempt.current = { input: serialized, id: crypto.randomUUID() };
      const result = await submitAuth(parsed.data, attempt.current.id);
      if (result.ok || result.error.code !== "network")
        attempt.current = undefined;
      setOutcome(result);
      if (result.ok) {
        if (result.next) window.location.assign(result.next);
        else onSuccess?.(result);
      } else if (result.error.code === "unauthorized")
        window.location.replace("/login?reason=expired");
    } catch {
      setOutcome({
        ok: false,
        error: {
          code: "network",
          message:
            "Connection interrupted. Your input is preserved. Try again.",
          retryable: true,
        },
      });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return {
    run,
    ready,
    pending,
    outcome,
    fields: outcome && !outcome.ok ? (outcome.error.fields ?? {}) : {},
  };
}
