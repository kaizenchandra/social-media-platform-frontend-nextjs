"use client";
import { useEffect, useState, useRef, useTransition, useContext } from "react";
import { ProfileFeedbackContext } from "./operation-feedback";
import { mutateProfile } from "./actions";
import { profileCommand } from "./validation";
import { validationFields } from "@/features/auth/validation";
import type { ProfileOutcome } from "./contracts";
export function useProfileOperation(announce = false) {
  const announceResult = useContext(ProfileFeedbackContext);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(timer);
  }, []);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const [outcome, setOutcome] = useState<ProfileOutcome>();
  const attempt = useRef<{ input: string; id: string } | undefined>(undefined);
  function run(input: unknown, done?: () => void) {
    if (busy.current || !ready) return;
    const parsed = profileCommand.safeParse(input);
    if (!parsed.success) {
      setOutcome({
        ok: false,
        error: {
          code: "validation",
          message: "Check the highlighted fields.",
          fields: validationFields(parsed.error),
          retryable: false,
        },
      });
      return;
    }
    const serialized = JSON.stringify(parsed.data);
    if (attempt.current?.input !== serialized)
      attempt.current = { input: serialized, id: crypto.randomUUID() };
    const id = attempt.current.id;
    busy.current = true;
    setOutcome(undefined);
    startTransition(async () => {
      try {
        const result = await mutateProfile(parsed.data, id);
        setOutcome(result);
        if (announce) announceResult?.(result);
        if (result.ok || result.error.code !== "network")
          attempt.current = undefined;
        if (result.ok) done?.();
        else if (result.error.code === "unauthorized")
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
      }
    });
  }
  return {
    run,
    ready,
    pending,
    outcome,
    fields: outcome && !outcome.ok ? (outcome.error.fields ?? {}) : {},
  };
}
