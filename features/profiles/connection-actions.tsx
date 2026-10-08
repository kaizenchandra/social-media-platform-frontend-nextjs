"use client";
import { useState } from "react";
import { Button, Alert } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/overlays";
import { useProfileOperation } from "./use-profile-operation";
import type { Relationship, GraphOperation } from "./contracts";
export function ConnectionActions({
  targetId,
  name,
  relationship: r,
  compact = false,
}: {
  targetId: string;
  name: string;
  relationship: Relationship;
  compact?: boolean;
}) {
  const operation = useProfileOperation(true);
  const [confirm, setConfirm] = useState<"block" | "unfriend" | null>(null);
  const disabled = !operation.ready || operation.pending;
  const send = (action: GraphOperation, done?: () => void) =>
    operation.run({ operation: action, targetId, version: r.version }, done);
  const action = (label: string, value: GraphOperation) => (
    <Button
      key={value}
      variant="secondary"
      disabled={disabled}
      onClick={() => send(value)}
    >
      {label}
    </Button>
  );
  const confirmation = (kind: "block" | "unfriend", label: string) => (
    <Dialog
      key={kind}
      open={confirm === kind}
      onOpenChange={(open) => setConfirm(open ? kind : null)}
      trigger={
        <Button variant="secondary" disabled={disabled}>
          {label}
        </Button>
      }
      title={`${label} ${name}?`}
      description={
        kind === "block"
          ? "This removes friendship, requests, follows and favorites in both directions. Unblocking will not restore them."
          : "Friends-only content will no longer be shared through this connection."
      }
    >
      <Button
        variant="danger"
        pending={operation.pending}
        disabled={disabled}
        onClick={() => send(kind, () => setConfirm(null))}
      >
        Confirm {kind === "block" ? "block" : "unfriend"}
      </Button>
      {operation.outcome && !operation.outcome.ok ? (
        <p role="alert">{operation.outcome.error.message}</p>
      ) : null}
    </Dialog>
  );
  const feedback = operation.outcome ? (
    <Alert
      title={operation.outcome.ok ? "Connection updated" : "Action failed"}
      tone={operation.outcome.ok ? "success" : "danger"}
    >
      {operation.outcome.ok
        ? operation.outcome.message
        : operation.outcome.error.message}
      {!operation.outcome.ok &&
      ["conflict", "network"].includes(operation.outcome.error.code) ? (
        <Button variant="ghost" onClick={() => window.location.reload()}>
          Reload connection
        </Button>
      ) : null}
    </Alert>
  ) : null;
  if (r.kind === "owner") return null;
  if (r.kind === "blocked")
    return (
      <div className="connection-controls">
        {r.blockedByMe ? action("Unblock", "unblock") : null}
        {feedback}
      </div>
    );
  return (
    <div
      className="connection-controls"
      aria-label={`Connection controls for ${name}`}
    >
      <div className="profile-actions">
        {r.kind === "friend" ? (
          confirmation("unfriend", "Unfriend")
        ) : r.request === "incoming" ? (
          <>
            {action("Accept", "accept")}
            {action("Reject", "reject")}
          </>
        ) : r.request === "outgoing" ? (
          action("Cancel request", "cancel")
        ) : (
          action("Add friend", "request")
        )}
        {action(
          r.following ? "Unfollow" : "Follow",
          r.following ? "unfollow" : "follow",
        )}
        {!compact ? (
          <>
            {r.kind === "friend" || r.following
              ? action(
                  r.favorite ? "Remove favorite" : "Add favorite",
                  r.favorite ? "unfavorite" : "favorite",
                )
              : null}
            {action(
              r.restricted ? "Unrestrict" : "Restrict",
              r.restricted ? "unrestrict" : "restrict",
            )}
            {confirmation("block", "Block")}
          </>
        ) : null}
      </div>
      {feedback}
    </div>
  );
}
