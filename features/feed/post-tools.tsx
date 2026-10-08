"use client";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { MoreHorizontal, Share2, Flag } from "lucide-react";
import { Button, IconButton, Alert } from "@/components/ui/primitives";
import { DropdownMenu, Dialog } from "@/components/ui/overlays";
import { Input, Select, Textarea } from "@/components/ui/forms";
import { useFeedOperation } from "./use-feed-operation";
import type { FeedPost } from "./contracts";
function SharePost({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [feedback, setFeedback] = useState("");
  const [copying, setCopying] = useState(false);
  const operation = useFeedOperation(false);
  const busy = useRef(false);
  function prepare() {
    operation.run({ operation: "share", postId }, (result) => {
      if (result.ok && result.sharePath)
        setLink(`${window.location.origin}${result.sharePath}`);
    });
  }
  async function copy() {
    if (busy.current) return;
    busy.current = true;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(link);
      setFeedback("Link copied. Recipients still need permission to view it.");
    } catch {
      const input = document.getElementById(
        `share-link-${postId}`,
      ) as HTMLInputElement | null;
      input?.focus();
      input?.select();
      setFeedback("Copy is unavailable. Select and copy the link below.");
    } finally {
      busy.current = false;
      setCopying(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) {
          setLink("");
          setFeedback("");
          prepare();
        }
      }}
      trigger={
        <IconButton label="Share post" disabled={!operation.ready}>
          <Share2 size={18} aria-hidden="true" />
        </IconButton>
      }
      title="Share a post link"
      description="Sharing a link never changes the original audience. The recipient must have permission to view the post."
    >
      {operation.pending ? <p role="status">Checking access…</p> : null}
      {link ? (
        <>
          <Input
            id={`share-link-${postId}`}
            label="Post link"
            value={link}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button pending={copying} onClick={() => void copy()}>
            Copy link
          </Button>
        </>
      ) : null}
      {feedback ? <p role="status">{feedback}</p> : null}
      {operation.outcome && !operation.outcome.ok ? (
        <Alert title="Link unavailable" tone="danger">
          {operation.outcome.error.message}
          {operation.outcome.error.retryable ? (
            <Button variant="ghost" onClick={prepare}>
              Try again
            </Button>
          ) : null}
        </Alert>
      ) : null}
    </Dialog>
  );
}
function ReportPost({ postId }: { postId: string }) {
  const operation = useFeedOperation(false);
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
    operation.run({
      operation: "report-draft",
      postId,
      ...Object.fromEntries(new FormData(e.currentTarget)),
    });
  }
  return (
    <Dialog
      trigger={
        <IconButton label="Report post" disabled={!operation.ready}>
          <Flag size={18} aria-hidden="true" />
        </IconButton>
      }
      title="Report this post"
      description="Prepare a synthetic preview draft. No moderation service is connected and nothing will be sent to reviewers."
    >
      <form
        ref={form}
        method="post"
        noValidate
        onSubmit={submit}
        aria-label="Report draft form"
      >
        <fieldset
          className="auth-fieldset"
          disabled={!operation.ready || operation.pending}
        >
          <Select
            name="reason"
            label="Report reason"
            defaultValue=""
            error={operation.fields.reason}
          >
            <option value="" disabled>
              Choose a reason
            </option>
            <option value="spam">Spam</option>
            <option value="harassment">Harassment</option>
            <option value="misinformation">Misinformation</option>
            <option value="privacy">Privacy concern</option>
            <option value="other">Other</option>
          </Select>
          <Textarea
            name="details"
            label="Optional details"
            hint="Synthetic text only. Do not include personal information or sensitive evidence."
            maxLength={500}
            error={operation.fields.details}
          />
          <Button type="submit" pending={operation.pending}>
            Prepare preview draft
          </Button>
          <Button disabled variant="secondary">
            Send report (service unavailable)
          </Button>
        </fieldset>
      </form>
      {operation.outcome ? (
        <div ref={summary} tabIndex={-1}>
          <Alert
            title={
              operation.outcome.ok ? "Draft prepared" : "Draft not prepared"
            }
            tone={operation.outcome.ok ? "info" : "danger"}
          >
            {operation.outcome.ok
              ? operation.outcome.message
              : operation.outcome.error.message}
          </Alert>
        </div>
      ) : null}
    </Dialog>
  );
}
export function PostTools({ post }: { post: FeedPost }) {
  const operation = useFeedOperation();
  const disabled = !operation.ready || operation.pending;
  return (
    <div className="post-tools">
      <SharePost postId={post.id} />
      <ReportPost postId={post.id} />
      <DropdownMenu
        label="Post visibility actions"
        trigger={
          <IconButton label="More post actions" disabled={disabled}>
            <MoreHorizontal size={18} aria-hidden="true" />
          </IconButton>
        }
        items={[
          {
            label: "Hide post",
            disabled,
            onSelect: () =>
              operation.run({ operation: "hide", postId: post.id }),
          },
          {
            label: "Mute account",
            disabled: disabled || post.relationship.kind === "owner",
            onSelect: () =>
              operation.run({ operation: "mute", postId: post.id }),
          },
        ]}
      />
    </div>
  );
}
