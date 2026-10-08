"use client";
import { useState, useEffect, useRef, useTransition } from "react";
import { publicationCommand, publicationFields } from "./validation";
import { mutatePublication } from "./actions";
import type { PublicationResult } from "./contracts";
export function usePublicationOperation() {
  const [ready, setReady] = useState(false);
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<PublicationResult>();
  const busy = useRef(false);
  const attempt = useRef<{ input: string; id: string } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(timer);
  }, []);
  function run(input: unknown): Promise<PublicationResult | null> {
    if (!ready || busy.current) return Promise.resolve(null);
    const parsed = publicationCommand.safeParse(input);
    if (!parsed.success) {
      const result: PublicationResult = {
        ok: false,
        error: {
          code: "validation",
          message: "Check the highlighted fields.",
          retryable: false,
          fields: publicationFields(parsed.error),
        },
      };
      setOutcome(result);
      return Promise.resolve(result);
    }
    const serialized = JSON.stringify(parsed.data);
    if (attempt.current?.input !== serialized)
      attempt.current = { input: serialized, id: crypto.randomUUID() };
    const requestId = attempt.current.id;
    busy.current = true;
    setOutcome(undefined);
    return new Promise((resolve) =>
      startTransition(async () => {
        let result: PublicationResult;
        try {
          result = await mutatePublication(parsed.data, requestId);
        } catch {
          result = {
            ok: false,
            error: {
              code: "network",
              message:
                "Connection interrupted. Nothing was confirmed. Retry with the same request or reload status to reconcile.",
              retryable: true,
            },
          };
        }
        setOutcome(result);
        if (result.ok || result.error.code !== "network")
          attempt.current = null;
        busy.current = false;
        resolve(result);
        if (!result.ok && result.error.code === "unauthorized")
          window.location.replace("/login?reason=expired");
      }),
    );
  }
  return {
    ready,
    pending,
    outcome,
    run,
    fields: outcome && !outcome.ok ? (outcome.error.fields ?? {}) : {},
  };
}
