"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/primitives";
import { MediaEngagement } from "./engagement";
import { MediaPlayer } from "./player";
import { useWellbeing } from "@/features/advanced/wellbeing-context";
import type { MediaItem } from "./contracts";
export function StoryViewer({
  items,
  index,
  onNavigate,
  onClose,
  actorId,
  onUpdate,
  onDenied,
}: {
  items: MediaItem[];
  index: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
  actorId: string;
  onUpdate: (item: MediaItem) => void;
  onDenied: (message: string) => void;
}) {
  const preferences = useWellbeing();
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [failure, setFailure] = useState(false);
  const [retry, setRetry] = useState(0);
  const root = useRef<HTMLElement>(null);
  const item = items[index];
  useEffect(() => {
    root.current?.focus();
  }, []);
  useEffect(() => {
    const stop = () => setPlaying(false);
    document.addEventListener("visibilitychange", stop);
    window.addEventListener("blur", stop);
    return () => {
      document.removeEventListener("visibilitychange", stop);
      window.removeEventListener("blur", stop);
    };
  }, []);
  useEffect(() => {
    if (!item || !playing || failure || item.asset === "video") return;
    const timer = setInterval(() => {
      const nextElapsed = elapsed + 100;
      setElapsed(nextElapsed);
      if (nextElapsed >= item.duration * 1000) {
        setPlaying(false);
        if (preferences.autoplay) {
          if (index < items.length - 1) onNavigate(index + 1);
          else onClose();
        }
      }
    }, 100);
    return () => clearInterval(timer);
  }, [
    preferences.autoplay,
    playing,
    failure,
    item,
    elapsed,
    index,
    items.length,
    onNavigate,
    onClose,
  ]);
  if (!item) return <p role="status">Story unavailable.</p>;
  const next = () =>
    index < items.length - 1 ? onNavigate(index + 1) : onClose();
  function key(e: KeyboardEvent<HTMLElement>) {
    if (
      e.target instanceof HTMLElement &&
      e.target.closest("button,input,textarea,select,a")
    )
      return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onNavigate(Math.max(0, index - 1));
    }
    if (e.key === " " && item.asset === "image") {
      e.preventDefault();
      setPlaying((value) => !value);
    }
  }
  return (
    <section
      className="story-viewer"
      ref={root}
      tabIndex={0}
      aria-label={`Story: ${item.title}`}
      onKeyDown={key}
    >
      <div className="story-progress" aria-label="Story navigation progress">
        {items.map((entry, i) => (
          <progress
            key={entry.id}
            aria-label={`Story ${i + 1}`}
            max="100"
            value={
              i < index
                ? 100
                : i === index
                  ? Math.min(100, elapsed / (item.duration * 10))
                  : 0
            }
          />
        ))}
      </div>
      <p>
        {item.creator.name} · {index + 1} of {items.length}
      </p>
      <h3>{item.title}</h3>
      <div className="story-artwork">
        {item.asset === "video" ? (
          <MediaPlayer
            key={item.id}
            src={item.src}
            poster={item.poster}
            captionSrc={item.captions}
            transcript={item.transcript}
            title={item.title}
            vertical
            onEnded={preferences.autoplay ? next : undefined}
          />
        ) : failure ? (
          <div role="alert">
            <p>Story image could not be loaded.</p>
            <Button
              variant="secondary"
              onClick={() => {
                setFailure(false);
                setRetry((count) => count + 1);
              }}
            >
              Retry story media
            </Button>
          </div>
        ) : (
          // Repository-owned SVG artwork; no remote image optimization or user distribution.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${item.id}:${retry}`}
            src={item.src}
            alt={item.title}
            onError={() => {
              setFailure(true);
              setPlaying(false);
            }}
          />
        )}
      </div>
      <p className="muted">
        Bundled story fixture
        {item.highlighted
          ? " · Creator highlight"
          : " · 24-hour preview availability"}
      </p>
      <div className="chat-tools">
        <Button
          variant="secondary"
          disabled={index === 0}
          onClick={() => onNavigate(index - 1)}
        >
          Previous story
        </Button>
        {item.asset === "image" && (
          <Button
            variant="secondary"
            disabled={failure}
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? "Pause story" : "Play story"}
          </Button>
        )}
        <Button variant="secondary" onClick={next}>
          Next story
        </Button>
      </div>
      <p className="muted">
        Use left/right arrows to navigate, Space to pause image stories, Escape
        to close. Stories start paused.
      </p>
      <MediaEngagement
        key={item.id}
        item={item}
        actorId={actorId}
        onUpdate={onUpdate}
        onDenied={onDenied}
      />
    </section>
  );
}
