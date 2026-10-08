import { Skeleton } from "@/components/ui/primitives";
export function FeedLoading() {
  return (
    <div
      className="page-content feed-page"
      role="status"
      aria-label="Loading feed"
    >
      <span className="sr-only">Loading feed…</span>
      <Skeleton className="feed-skeleton-title" />
      <Skeleton className="feed-skeleton-nav" />
      {[1, 2, 3].map((id) => (
        <div className="feed-card card" key={id}>
          <Skeleton className="feed-skeleton-author" />
          <Skeleton className="feed-skeleton-text" />
          <Skeleton className="feed-skeleton-media" />
        </div>
      ))}
    </div>
  );
}
