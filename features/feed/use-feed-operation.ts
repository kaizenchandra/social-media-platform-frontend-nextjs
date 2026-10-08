"use client";
import { useState, useRef, useEffect, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mutateFeed } from "./actions";
import { feedCommand } from "./validation";
import { validationFields } from "@/features/auth/validation";
import { FeedFeedbackContext } from "./feedback";
import type { FeedOutcome } from "./contracts";
export function useFeedOperation(announce = true) {
  const notify = useContext(FeedFeedbackContext);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(timer);
  }, []);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const [outcome, setOutcome] = useState<FeedOutcome>();
  const attempt = useRef<{ input: string; id: string } | undefined>(undefined);
  function run(input: unknown, callback?: (result: FeedOutcome) => void) {
    if (!ready || busy.current) return;
    const parsed = feedCommand.safeParse(input);
    if (!parsed.success) {
      const error: FeedOutcome = {
        ok: false,
        error: {
          code: "validation",
          message: "Check the highlighted fields.",
          fields: validationFields(parsed.error),
          retryable: false,
        },
      };
      setOutcome(error);
      callback?.(error);
      return;
    }
    const serialized = JSON.stringify(parsed.data);
    if (attempt.current?.input !== serialized)
      attempt.current = { input: serialized, id: crypto.randomUUID() };
    const id = attempt.current.id;
    busy.current = true;
    setOutcome(undefined);
    startTransition(async () => {
      let result: FeedOutcome;
      try {
        result = await mutateFeed(parsed.data, id);
      } catch {
        result = {
          ok: false,
          error: {
            code: "network",
            message:
              "Connection interrupted. The update was not confirmed. Retry or reload to reconcile it.",
            retryable: true,
          },
        };
      }
      setOutcome(result);
      if (announce) notify?.(result);
      if (result.ok || result.error.code !== "network")
        attempt.current = undefined;
      callback?.(result);
      busy.current = false;
      if (!result.ok && result.error.code === "unauthorized")
        window.location.replace("/login?reason=expired");
      else if (!result.ok && result.error.code === "forbidden")
        router.refresh();
    });
  }
  return {
    ready,
    pending,
    outcome,
    run,
    fields: outcome && !outcome.ok ? (outcome.error.fields ?? {}) : {},
  };
}
