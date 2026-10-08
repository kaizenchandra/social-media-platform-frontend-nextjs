"use client";
import { Button } from "@/components/ui/primitives";
import { useProfileOperation } from "./use-profile-operation";
import type { ProfileView } from "./contracts";
export function FeaturedControl({
  profile,
  postId,
  enabled,
}: {
  profile: ProfileView;
  postId: string;
  enabled: boolean;
}) {
  const operation = useProfileOperation();
  return (
    <div>
      <Button
        variant="ghost"
        aria-pressed={enabled}
        disabled={!operation.ready || operation.pending}
        pending={operation.pending}
        onClick={() =>
          operation.run({
            operation: "feature",
            postId,
            version: profile.version,
            enabled: !enabled,
          })
        }
      >
        {enabled ? "Remove from featured" : "Feature this post"}
      </Button>
      {operation.outcome ? (
        <p role={operation.outcome.ok ? "status" : "alert"}>
          {operation.outcome.ok
            ? operation.outcome.message
            : operation.outcome.error.message}
        </p>
      ) : null}
    </div>
  );
}
