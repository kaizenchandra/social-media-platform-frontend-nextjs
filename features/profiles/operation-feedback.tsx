"use client";
import { createContext, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/primitives";
import type { ProfileOutcome } from "./contracts";
// Page-scoped announcements survive a request row disappearing after a mutation.
export const ProfileFeedbackContext = createContext<
  ((result: ProfileOutcome) => void) | null
>(null);
export function OperationFeedback({ children }: { children: ReactNode }) {
  const [outcome, setOutcome] = useState<ProfileOutcome>();
  return (
    <ProfileFeedbackContext.Provider value={setOutcome}>
      {outcome ? (
        <div className="profile-operation-feedback">
          <Alert
            title={outcome.ok ? "Connection updated" : "Action failed"}
            tone={outcome.ok ? "success" : "danger"}
          >
            {outcome.ok ? outcome.message : outcome.error.message}
          </Alert>
        </div>
      ) : null}
      {children}
    </ProfileFeedbackContext.Provider>
  );
}
