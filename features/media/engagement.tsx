"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { Textarea } from "@/components/ui/forms";
import { mutateMedia } from "./actions";
import type { MediaItem, MediaOutcome, VideoComment } from "./contracts";
import type { MediaCommand } from "./validation";
export function MediaEngagement({
  item,
  actorId,
  comments: initial = [],
  onUpdate,
  onDenied,
}: {
  item: MediaItem;
  actorId: string;
  comments?: VideoComment[];
  onUpdate: (item: MediaItem) => void;
  onDenied: (message: string) => void;
}) {
  const [comments, setComments] = useState(initial);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [share, setShare] = useState<string>();
  const busy = useRef(false);
  const request = useRef<{ serialized: string; id: string } | undefined>(
    undefined,
  );
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run(command: MediaCommand) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setNotice("");
    const serialized = JSON.stringify(command);
    if (request.current?.serialized !== serialized)
      request.current = { serialized, id: crypto.randomUUID() };
    let result: MediaOutcome;
    try {
      result = await mutateMedia(command, request.current.id);
    } catch {
      result = {
        ok: false,
        error: {
          code: "network",
          message: "Action unconfirmed. Retry manually with the same content.",
          retryable: true,
        },
      };
    }
    if (!mounted.current) return;
    setPending(false);
    busy.current = false;
    if (result.ok) {
      onUpdate(result.item);
      setComments(result.comments);
      if (command.operation === "comment") setText("");
      if (result.sharePath) setShare(result.sharePath);
      setNotice(
        command.operation === "share"
          ? "Preview link prepared. Recipient permissions are checked independently."
          : "Development preview updated; no production interaction was sent.",
      );
      request.current = undefined;
    } else {
      setNotice(result.error.message);
      if (["forbidden", "unauthorized"].includes(result.error.code))
        onDenied(result.error.message);
      if (result.error.code !== "network") request.current = undefined;
    }
  }
  return (
    <section className="media-engagement" aria-label="Media interactions">
      <div className="chat-tools">
        <Button
          variant="secondary"
          disabled={pending}
          aria-pressed={item.reaction === "love"}
          onClick={() =>
            void run({
              operation: "reaction",
              id: item.id,
              value: item.reaction === "love" ? null : "love",
            })
          }
        >
          {item.reaction === "love" ? "Loved" : "Love"}
        </Button>
        {item.kind !== "story" && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              void run({ operation: "save", id: item.id, value: !item.saved })
            }
          >
            {item.saved ? "Unsave video" : "Save video"}
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => void run({ operation: "share", id: item.id })}
        >
          Share preview link
        </Button>
        {item.kind === "story" && item.creator.id === actorId && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              void run({
                operation: "highlight",
                id: item.id,
                value: !item.highlighted,
              })
            }
          >
            {item.highlighted ? "Remove highlight" : "Add to highlights"}
          </Button>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
      {share && (
        <label className="field">
          Preview link
          <input
            className="input"
            aria-label="Media preview link"
            readOnly
            value={share}
            onFocus={(e) => e.target.select()}
          />
        </label>
      )}
      {item.kind !== "story" && (
        <>
          <h2>Video comments</h2>
          <p className="muted">
            Development comments only. No live audience or real engagement
            metrics.
          </p>
          <ol className="video-comments">
            {comments.map((comment) => (
              <li key={comment.id}>
                <strong>{comment.name}</strong>
                <p>{comment.text}</p>
              </li>
            ))}
          </ol>
          {!comments.length && (
            <p className="muted">No preview comments yet.</p>
          )}
          <form
            method="post"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim())
                void run({ operation: "comment", id: item.id, text });
            }}
          >
            <Textarea
              label="Video comment"
              value={text}
              maxLength={1500}
              disabled={pending}
              onChange={(e) => setText(e.target.value)}
            />
            <Button type="submit" disabled={pending || !text.trim()}>
              Comment locally
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
