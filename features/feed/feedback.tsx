"use client";
import { createContext, useState, type ReactNode } from "react";
import { Alert, Button } from "@/components/ui/primitives";
import type { FeedOutcome } from "./contracts";
export const FeedFeedbackContext = createContext<
  ((result: FeedOutcome) => void) | null
>(null);
export function FeedFeedback({ children }: { children: ReactNode }) {
  const [outcome, setOutcome] = useState<FeedOutcome>();
  return (
    <FeedFeedbackContext.Provider value={setOutcome}>
      {outcome ? (
        <div className="feed-feedback">
          <Alert
            title={outcome.ok ? "Update" : "Update not confirmed"}
            tone={outcome.ok ? "success" : "danger"}
          >
            {outcome.ok ? outcome.message : outcome.error.message}
            {!outcome.ok && outcome.error.code !== "validation" ? (
              <Button variant="ghost" onClick={() => window.location.reload()}>
                Reload to reconcile
              </Button>
            ) : null}
          </Alert>
        </div>
      ) : null}
      {children}
    </FeedFeedbackContext.Provider>
  );
}
