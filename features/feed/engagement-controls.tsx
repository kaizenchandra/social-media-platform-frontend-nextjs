"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ThumbsUp,
  Heart,
  HandHeart,
  MessageCircle,
  Bookmark,
  Repeat2,
} from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useFeedOperation } from "./use-feed-operation";
import type { FeedPost, Reaction } from "./contracts";
export function EngagementControls({
  post,
  detail = false,
}: {
  post: FeedPost;
  detail?: boolean;
}) {
  const operation = useFeedOperation();
  const [optimistic, setOptimistic] = useState<{
    version: number;
    value: Reaction | null;
  } | null>(null);
  const optimisticApplies = optimistic?.version === post.engagement.version;
  const value = optimisticApplies
    ? optimistic!.value
    : post.engagement.reaction;
  const count =
    post.engagement.reactions +
    (optimisticApplies
      ? Number(value !== null) - Number(post.engagement.reaction !== null)
      : 0);
  const disabled = !operation.ready || operation.pending;
  function react(selected: Reaction) {
    if (disabled) return;
    const next = value === selected ? null : selected;
    setOptimistic({ version: post.engagement.version, value: next });
    operation.run(
      {
        operation: "reaction",
        postId: post.id,
        version: post.engagement.version,
        value: next,
      },
      () => setOptimistic(null),
    );
  }
  return (
    <div className="engagement-controls">
      <div className="feed-counts" aria-live="polite">
        <span>
          {count} {count === 1 ? "reaction" : "reactions"}
          {optimisticApplies && operation.pending ? " · confirming" : ""}
        </span>
        <span>
          {post.engagement.comments}{" "}
          {post.engagement.comments === 1 ? "comment" : "comments"}
        </span>
      </div>
      <div className="feed-action-row" aria-label={`Actions for ${post.title}`}>
        {(
          [
            ["like", "Like", ThumbsUp],
            ["love", "Love", Heart],
            ["support", "Support", HandHeart],
          ] as const
        ).map(([reaction, label, Icon]) => (
          <Button
            key={reaction}
            variant="ghost"
            aria-pressed={value === reaction}
            disabled={disabled}
            onClick={() => react(reaction)}
          >
            <Icon size={17} aria-hidden="true" />
            {label}
          </Button>
        ))}
        <Link
          href={`/posts/${post.id}${detail ? "#comments" : ""}`}
          className="button button-ghost"
        >
          <MessageCircle size={17} aria-hidden="true" />
          Comments
        </Link>
        <Button
          variant="ghost"
          disabled={disabled}
          aria-pressed={post.engagement.saved}
          onClick={() =>
            operation.run({
              operation: "save",
              postId: post.id,
              version: post.engagement.version,
              enabled: !post.engagement.saved,
            })
          }
        >
          <Bookmark size={17} aria-hidden="true" />
          {post.engagement.saved ? "Unsave" : "Save"}
        </Button>
        <Button
          variant="ghost"
          disabled={disabled || post.audience !== "public"}
          aria-describedby={
            post.audience !== "public" ? `repost-${post.id}` : undefined
          }
          aria-pressed={post.engagement.reposted}
          onClick={() =>
            operation.run({
              operation: "repost",
              postId: post.id,
              version: post.engagement.version,
              enabled: !post.engagement.reposted,
            })
          }
        >
          <Repeat2 size={17} aria-hidden="true" />
          {post.engagement.reposted ? "Undo repost" : "Repost"}
        </Button>
      </div>
      {post.audience !== "public" ? (
        <p id={`repost-${post.id}`} className="field-hint">
          Reposting is available only for public posts.
        </p>
      ) : null}
      {operation.outcome && !operation.outcome.ok ? (
        <p className="field-hint">
          Your previous interaction is restored. Reload or retry to reconcile
          server state.
        </p>
      ) : null}
    </div>
  );
}
