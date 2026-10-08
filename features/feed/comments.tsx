"use client";
import { useState, useEffect, useRef, type FormEvent } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button, Alert, EmptyState } from "@/components/ui/primitives";
import { Textarea } from "@/components/ui/forms";
import { Dialog } from "@/components/ui/overlays";
import { artwork } from "@/features/profiles/contracts";
import { useFeedOperation } from "./use-feed-operation";
import type { FeedComment } from "./contracts";
function CommentForm({
  postId,
  parentId = null,
  comment,
  done,
  label = "Comment",
}: {
  postId: string;
  parentId?: string | null;
  comment?: FeedComment;
  done?: () => void;
  label?: string;
}) {
  const operation = useFeedOperation(false);
  const [text, setText] = useState(comment?.text ?? "");
  const form = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (operation.outcome && !operation.outcome.ok)
      (
        form.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
        summary.current
      )?.focus();
  }, [operation.outcome]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    operation.run(
      comment
        ? {
            operation: "edit-comment",
            postId,
            commentId: comment.id,
            version: comment.version,
            text,
          }
        : { operation: "comment", postId, parentId, text },
      (result) => {
        if (result.ok) {
          setText("");
          done?.();
        }
      },
    );
  }
  return (
    <form
      method="post"
      noValidate
      ref={form}
      onSubmit={submit}
      aria-label={`${label} form`}
      aria-busy={operation.pending}
    >
      <fieldset
        className="auth-fieldset"
        disabled={!operation.ready || operation.pending}
      >
        <Textarea
          label={label}
          name="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          error={operation.fields.text}
          maxLength={1000}
          hint="Synthetic preview text only. Do not include private information."
          required
        />
        <Button type="submit" pending={operation.pending}>
          {comment ? "Save comment" : parentId ? "Send reply" : "Send comment"}
        </Button>
      </fieldset>
      {operation.outcome ? (
        <div ref={summary} tabIndex={-1}>
          <Alert
            title={
              operation.outcome.ok ? "Comment update" : "Comment not confirmed"
            }
            tone={operation.outcome.ok ? "success" : "danger"}
          >
            {operation.outcome.ok
              ? operation.outcome.message
              : operation.outcome.error.message}
            {!operation.outcome.ok && operation.outcome.error.retryable ? (
              <Button
                variant="ghost"
                onClick={() => form.current?.requestSubmit()}
              >
                Try again
              </Button>
            ) : null}
            {!operation.outcome.ok &&
            operation.outcome.error.code === "conflict" ? (
              <Button variant="ghost" onClick={() => window.location.reload()}>
                Reload comment
              </Button>
            ) : null}
          </Alert>
        </div>
      ) : null}
    </form>
  );
}
function CommentRow({
  comment,
  postId,
  replies,
}: {
  comment: FeedComment;
  postId: string;
  replies: FeedComment[];
}) {
  const [dialog, setDialog] = useState<"reply" | "edit" | "delete" | null>(
    null,
  );
  const operation = useFeedOperation();
  const disabled = !operation.ready || operation.pending;
  return (
    <li className="comment-thread" data-comment-id={comment.id}>
      <article
        className="comment-card"
        aria-label={
          comment.deleted
            ? "Deleted comment"
            : `Comment by ${comment.author?.displayName}`
        }
      >
        {comment.deleted ? (
          <p className="muted">Comment deleted</p>
        ) : (
          <>
            <header className="comment-author">
              <Avatar
                name={comment.author!.displayName}
                src={artwork[comment.author!.avatar].src}
                size="small"
              />
              <Link href={`/profile/${comment.author!.username}`}>
                {comment.author!.displayName}
              </Link>
              <time className="field-hint" dateTime={comment.createdAt}>
                {comment.createdAt.slice(0, 10)}
                {comment.edited ? " · edited" : ""}
              </time>
            </header>
            <p className="comment-text">{comment.text}</p>
            <div className="profile-actions">
              {!comment.parentId ? (
                <Dialog
                  open={dialog === "reply"}
                  onOpenChange={(open) => setDialog(open ? "reply" : null)}
                  trigger={
                    <Button variant="ghost" disabled={disabled}>
                      Reply
                    </Button>
                  }
                  title="Reply to comment"
                  description="Reply in the original post audience. Replies support one level in this preview."
                >
                  <CommentForm
                    postId={postId}
                    parentId={comment.id}
                    done={() => setDialog(null)}
                    label="Reply"
                  />
                </Dialog>
              ) : null}
              {comment.canEdit ? (
                <>
                  <Dialog
                    open={dialog === "edit"}
                    onOpenChange={(open) => setDialog(open ? "edit" : null)}
                    trigger={
                      <Button variant="ghost" disabled={disabled}>
                        Edit comment
                      </Button>
                    }
                    title="Edit your comment"
                    description="Changes are saved only after server confirmation."
                  >
                    <CommentForm
                      postId={postId}
                      comment={comment}
                      done={() => setDialog(null)}
                      label="Edited comment"
                    />
                  </Dialog>
                  <Dialog
                    open={dialog === "delete"}
                    onOpenChange={(open) => setDialog(open ? "delete" : null)}
                    trigger={
                      <Button variant="ghost" disabled={disabled}>
                        Delete comment
                      </Button>
                    }
                    title="Delete your comment?"
                    description="The preview removes your comment text. Permitted replies remain in the thread."
                  >
                    <Button
                      variant="danger"
                      pending={operation.pending}
                      disabled={disabled}
                      onClick={() =>
                        operation.run(
                          {
                            operation: "delete-comment",
                            postId,
                            commentId: comment.id,
                            version: comment.version,
                          },
                          (result) => {
                            if (result.ok) setDialog(null);
                          },
                        )
                      }
                    >
                      Confirm delete comment
                    </Button>
                    {operation.outcome && !operation.outcome.ok ? (
                      <p role="alert">{operation.outcome.error.message}</p>
                    ) : null}
                  </Dialog>
                </>
              ) : null}
            </div>
          </>
        )}
      </article>
      {replies.length ? (
        <ul className="comment-replies" aria-label="Replies">
          {replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              postId={postId}
              replies={[]}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
export function CommentThread({
  postId,
  comments,
}: {
  postId: string;
  comments: FeedComment[];
}) {
  return (
    <section
      id="comments"
      className="comments-section card"
      aria-labelledby="comments-heading"
    >
      <h2 id="comments-heading">Comments</h2>
      <p className="field-hint">
        Comments are filtered by post access and visible author permissions.
      </p>
      <CommentForm postId={postId} />
      <div className="comment-list-area">
        {comments.length ? (
          <ul className="comment-list" aria-label="Post comments">
            {comments
              .filter((c) => !c.parentId)
              .map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  postId={postId}
                  replies={comments.filter((r) => r.parentId === c.id)}
                />
              ))}
          </ul>
        ) : (
          <EmptyState
            title="Start a conversation"
            description="No permitted comments yet. Share a synthetic thought to try this preview."
          />
        )}
      </div>
    </section>
  );
}
