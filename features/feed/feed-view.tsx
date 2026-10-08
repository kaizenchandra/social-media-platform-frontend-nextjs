import Link from "next/link";
import { Bookmark, Users } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { SessionWatch } from "@/features/auth/account-panel";
import { FeedFeedback } from "./feedback";
import { PostCard } from "./post-card";
import { Preferences } from "./preferences";
import { FeedRefresh } from "./feed-refresh";
import { FeedScroll } from "./feed-scroll";
import type { FeedPage } from "./contracts";
export function FeedView({
  page,
  expiresAt,
  navigationKey,
}: {
  page: FeedPage;
  expiresAt: string;
  navigationKey: string;
}) {
  const saved = page.mode === "saved";
  return (
    <div className="page-content feed-page">
      <FeedScroll key={navigationKey} />
      <SessionWatch expiresAt={expiresAt} />
      <div className="page-heading">
        <p className="eyebrow">A LITTLE MORE CONNECTION</p>
        <Badge>Development preview</Badge>
      </div>
      <div className="feed-heading">
        <div>
          <h1>{saved ? "Saved posts" : "Your feed"}</h1>
          <p className="muted">
            {saved
              ? "A place for things you want to come back to."
              : "Good conversations. Small moments. People who matter."}
          </p>
        </div>
        <div className="publication-actions">
          <Link href="/create" className="button button-primary">
            Create a post
          </Link>
          <Preferences preferences={page.preferences} />
        </div>
      </div>
      <p className="field-hint feed-disclosure">
        Synthetic posts and engagement. No social, ranking or moderation service
        is connected.
      </p>
      <nav aria-label="Feed views" className="feed-navigation">
        {(
          [
            ["home", "Home"],
            ["friends", "Friends"],
            ["following", "Following"],
            ["chronological", "Chronological"],
            ["recommended", "Recommended"],
            ["saved", "Saved"],
          ] as const
        ).map(([mode, label]) => (
          <Link
            key={mode}
            href={mode === "saved" ? "/saved" : `/?mode=${mode}`}
            scroll={false}
            aria-current={page.mode === mode ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="feed-reading-bar">
        <p className="field-hint">
          {page.mode === "recommended"
            ? "Optional public discovery, ordered by date. This is not AI ranking."
            : page.mode === "chronological"
              ? "Newest permitted posts first. Equal dates use stable post order."
              : "Only eligible, published preview content is shown."}
        </p>
        <FeedRefresh />
      </div>
      <FeedFeedback>
        <div
          className="feed-posts"
          aria-label={saved ? "Saved posts" : "Feed posts"}
        >
          {page.items.length ? (
            page.items.map((post) => <PostCard key={post.id} post={post} />)
          ) : (
            <EmptyState
              title={saved ? "Nothing saved yet" : "You’re all caught up"}
              description={
                saved
                  ? "Save a permitted post from your feed to find it here."
                  : "No eligible posts in this view. Adjust your preferences or connect with someone."
              }
              icon={saved ? <Bookmark /> : <Users />}
              action={
                <Link
                  href={saved ? "/" : "/connections"}
                  className="button button-secondary"
                >
                  {saved ? "Explore your feed" : "Manage connections"}
                </Link>
              }
            />
          )}
        </div>
      </FeedFeedback>
      <nav className="feed-pagination" aria-label="Feed pagination">
        <Link
          href={saved ? "/saved" : `/?mode=${page.mode}`}
          className="button button-secondary"
        >
          First page
        </Link>
        {page.nextCursor ? (
          <Link
            className="button button-primary"
            href={
              saved
                ? `/saved?cursor=${page.nextCursor}`
                : `/?mode=${page.mode}&cursor=${page.nextCursor}`
            }
          >
            Next posts
          </Link>
        ) : (
          <p className="field-hint">End of this feed snapshot.</p>
        )}
      </nav>
    </div>
  );
}
