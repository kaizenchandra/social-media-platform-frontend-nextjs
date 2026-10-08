"use client";
import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Bookmark, Plus, Play, ArrowLeft, ArrowRight } from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/overlays";
import { Input, Select } from "@/components/ui/forms";
import { useMediaCatalog } from "./use-catalog";
import { MediaNavigation, MediaNotice } from "./chrome";
import { StoryViewer } from "./story-viewer";
import { MediaPlayer } from "./player";
import { MediaEngagement } from "./engagement";
import type { Catalog, MediaItem, MediaKind, VideoComment } from "./contracts";
export function MediaExperience({
  initial,
  kind,
  actorId,
  requestedId,
}: {
  initial: Catalog;
  kind: MediaKind;
  actorId: string;
  requestedId?: string;
}) {
  const catalog = useMediaCatalog(initial);
  const [search, setSearch] = useState("");
  const [collection, setCollection] = useState("all");
  const [activeId, setActiveId] = useState<string | undefined>(requestedId);
  const [hidden, setHidden] = useState<string[]>([]);
  const path =
    kind === "story" ? "stories" : kind === "reel" ? "reels" : "videos";
  const heading =
    kind === "story"
      ? "Stories"
      : kind === "reel"
        ? "Reels discovery"
        : "Watch something thoughtful";
  const items = catalog.items.filter(
    (item) =>
      item.kind === kind &&
      !hidden.includes(item.id) &&
      (!search ||
        `${item.title} ${item.creator.name}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (collection !== "saved" || item.saved) &&
      (collection !== "highlights" || item.highlighted),
  );
  const storyItems = items.filter(
    (item) =>
      collection === "highlights" ||
      item.expiresAt === null ||
      item.expiresAt > catalog.now,
  );
  const current = items.find((item) => item.id === activeId);
  const index = items.findIndex((item) => item.id === activeId);
  function navigate(delta: number) {
    const next = Math.min(items.length - 1, Math.max(0, index + delta));
    if (items[next]) setActiveId(items[next].id);
  }
  function reelKey(event: KeyboardEvent<HTMLElement>) {
    if (
      event.target instanceof HTMLElement &&
      (event.target.closest(
        "button,input,textarea,select,a,[aria-label^='Player:']",
      ) ||
        event.target.isContentEditable)
    )
      return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      navigate(1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      navigate(-1);
    }
  }
  const restore = () => {
    setHidden([]);
    setActiveId(undefined);
  };
  return (
    <>
      <MediaNavigation active={path} />
      <div className="messages-title">
        <div>
          <p className="eyebrow">
            {kind === "story"
              ? "LITTLE MOMENTS, SHARED"
              : "ROOM FOR A NEW PERSPECTIVE"}
          </p>
          <h1>{heading}</h1>
        </div>
        <Link className="button button-primary" href={`/${path}/create`}>
          <Plus size={17} aria-hidden="true" />
          Create {kind} draft
        </Link>
      </div>
      <MediaNotice />
      <div className="media-discovery-tools">
        <Input
          label={`Search ${path}`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Title or creator"
        />
        <Select
          label="Media collection"
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
        >
          <option value="all">
            {kind === "story" ? "Stories tray" : "Discover"}
          </option>
          <option value={kind === "story" ? "highlights" : "saved"}>
            {kind === "story" ? "Story highlights" : "Saved videos"}
          </option>
        </Select>
        <Button
          variant="secondary"
          pending={catalog.checking}
          onClick={() => void catalog.refresh()}
        >
          Refresh media access
        </Button>
      </div>
      <details className="messaging-simulation">
        <summary>Preview content restrictions</summary>
        <p className="muted">
          These controls simulate revocation locally. Real permissions are
          rechecked by the development adapter on reads/actions and when this
          tab regains focus.
        </p>
        <div className="chat-tools">
          <Button
            variant="danger"
            disabled={!current}
            onClick={() => {
              if (current) setHidden((ids) => [...ids, current.id]);
            }}
          >
            Restrict selected fixture
          </Button>
          <Button variant="secondary" onClick={restore}>
            Reset local restrictions
          </Button>
        </div>
      </details>
      {catalog.notice && (
        <p role="alert" className="alert alert-warning">
          {catalog.notice}
        </p>
      )}
      {catalog.checking && (
        <p role="status">Checking current media permissions…</p>
      )}
      {!items.length && !catalog.checking && (
        <div className="empty-state">
          <h2>No available {path}</h2>
          <p>
            Try another collection or refresh access. Held, expired, blocked and
            restricted content is excluded.
          </p>
        </div>
      )}
      {kind === "story" ? (
        <>
          <div
            className="stories-tray"
            role="group"
            aria-label={
              collection === "highlights" ? "Story highlights" : "Stories tray"
            }
          >
            {storyItems.map((item) => (
              <button
                className="story-tile"
                key={item.id}
                aria-label={`View story: ${item.title}`}
                onClick={() => setActiveId(item.id)}
              >
                <span className="story-ring">
                  {/* Repository-authored artwork, not remote or user-published media. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.poster} alt="" />
                </span>
                <strong>
                  {item.creator.id === actorId
                    ? "Your story"
                    : item.creator.name}
                </strong>
                <small>{item.title}</small>
                {item.highlighted && <Badge>Highlight</Badge>}
              </button>
            ))}
          </div>
          <Dialog
            trigger={
              <Button variant="secondary" disabled={!storyItems.length}>
                Open story viewer
              </Button>
            }
            title="Story viewer"
            description="Bundled synthetic stories. Start paused; only currently permitted story fixtures are displayed."
            open={!!activeId}
            onOpenChange={(open) =>
              setActiveId(open ? storyItems[0]?.id : undefined)
            }
          >
            {current && storyItems.some((item) => item.id === current.id) ? (
              <StoryViewer
                key={current.id}
                items={storyItems}
                index={storyItems.findIndex((item) => item.id === current.id)}
                actorId={actorId}
                onNavigate={(next) => setActiveId(storyItems[next]?.id)}
                onClose={() => setActiveId(undefined)}
                onUpdate={catalog.update}
                onDenied={catalog.deny}
              />
            ) : (
              <p role="status">
                This story is no longer available. Close the viewer or refresh
                access.
              </p>
            )}
          </Dialog>
          <p className="muted">
            Highlights preserve only eligible creator story fixtures. Your new
            private drafts never enter the tray, regardless of simulated
            approval.
          </p>
        </>
      ) : (
        <>
          {kind === "reel" && (
            <p className="muted">
              Deterministic fixture discovery · no personalized recommendation
              service. Select a reel; only one player is mounted. Up/down arrows
              on the reel panel navigate.
            </p>
          )}
          <div className="video-discovery-grid">
            {items.map((item) => (
              <article className="card video-discovery-card" key={item.id}>
                <button
                  className="media-poster-button"
                  onClick={() => setActiveId(item.id)}
                  aria-label={`Watch ${item.title}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.poster} alt="" />
                  <span>
                    <Play size={20} aria-hidden="true" />
                    {kind === "video"
                      ? "Long-form layout · 6s fixture"
                      : "6s preview reel"}
                  </span>
                </button>
                <div>
                  <h2>{item.title}</h2>
                  <p>
                    {item.creator.name}{" "}
                    {item.saved && <Bookmark size={16} aria-label="Saved" />}
                  </p>
                  {kind === "video" && (
                    <Link href={`/videos/${item.id}`}>Open video page</Link>
                  )}
                </div>
              </article>
            ))}
          </div>
          {(activeId || kind === "reel") && (
            <section
              className="reel-panel"
              aria-label="Selected video"
              tabIndex={0}
              onKeyDown={reelKey}
            >
              {current ? (
                <>
                  <div className="chat-tools">
                    <h2>{current.title}</h2>
                    <Badge>Viewing fixture</Badge>
                    <Button
                      variant="ghost"
                      onClick={() => setActiveId(undefined)}
                    >
                      Close video
                    </Button>
                  </div>
                  <CreatorInfo item={current} />
                  <MediaPlayer
                    key={`player-${current.id}`}
                    src={current.src}
                    poster={current.poster}
                    captionSrc={current.captions}
                    transcript={current.transcript}
                    title={current.title}
                    vertical={kind === "reel"}
                  />
                  <div className="reel-navigation">
                    <Button
                      variant="secondary"
                      disabled={index <= 0}
                      onClick={() => navigate(-1)}
                    >
                      <ArrowLeft size={16} />
                      Previous video
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={index === items.length - 1}
                      onClick={() => navigate(1)}
                    >
                      Next video
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                  <MediaEngagement
                    key={`engagement-${current.id}`}
                    item={current}
                    actorId={actorId}
                    onUpdate={catalog.update}
                    onDenied={catalog.deny}
                  />
                </>
              ) : (
                <p role="status">
                  {activeId
                    ? "This media is no longer available. Playback and interactions have stopped."
                    : "Choose a reel to watch. Playback starts only when you press Play."}
                </p>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
export function CreatorInfo({ item }: { item: MediaItem }) {
  return (
    <div className="creator-video-info">
      <p className="eyebrow">CREATOR INFORMATION</p>
      <Link href={`/profile/${item.creator.username}`}>
        {item.creator.name}
      </Link>
      <p>{item.creator.bio}</p>
      <p>{item.description}</p>
      <small>
        Intended audience: {item.audience} · Bundled viewing fixture · No
        verified view or performance counts
      </small>
    </div>
  );
}
export function LongVideoView({
  initial,
  itemId,
  comments,
  actorId,
}: {
  initial: Catalog;
  itemId: string;
  comments: VideoComment[];
  actorId: string;
}) {
  const catalog = useMediaCatalog(initial);
  const [restricted, setRestricted] = useState(false);
  const item = catalog.items.find(
    (item) => item.id === itemId && item.kind === "video",
  );
  return (
    <>
      <MediaNavigation active="videos" />
      <Link href="/videos">Back to videos</Link>
      <MediaNotice />
      <div className="chat-tools">
        <Button
          variant="secondary"
          pending={catalog.checking}
          onClick={() => void catalog.refresh()}
        >
          Refresh media access
        </Button>
        <Button
          variant="danger"
          disabled={!item || restricted}
          onClick={() => setRestricted(true)}
        >
          Simulate content restriction
        </Button>
      </div>
      {item && !restricted ? (
        <>
          <h1>{item.title}</h1>
          <div className="long-video-layout">
            <section>
              <MediaPlayer
                key={`player-${item.id}`}
                src={item.src}
                poster={item.poster}
                captionSrc={item.captions}
                transcript={item.transcript}
                title={item.title}
              />
              <MediaEngagement
                key={`engagement-${item.id}`}
                item={item}
                actorId={actorId}
                comments={comments}
                onUpdate={catalog.update}
                onDenied={catalog.deny}
              />
            </section>
            <aside className="card creator-video-aside">
              <CreatorInfo item={item} />
              <h2>About this video</h2>
              <p>
                This long-form page uses a six-second original animation to
                verify playback. No creator upload, moderation decision or
                audience analytics are implied.
              </p>
              <p className="muted">
                An actual video must complete private upload, processing,
                mandatory screening, any required review, and authorized
                distribution.
              </p>
              <Link href="/videos/create">Prepare a private video draft</Link>
            </aside>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h1>Video unavailable</h1>
          <p role="status">
            {catalog.checking
              ? "Checking current permissions…"
              : catalog.notice ||
                "This content is restricted or no longer accessible. Playback and interactions have stopped."}
          </p>
        </div>
      )}
    </>
  );
}
