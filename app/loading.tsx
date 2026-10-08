import { Skeleton } from "@/components/ui/primitives";
export default function Loading() {
  return (
    <div className="page-content" role="status" aria-label="Loading page">
      <span className="sr-only">Loading page…</span>
      <p className="field-hint">
        JavaScript is required for this preview. If loading does not finish,
        check that scripts are enabled and reload the page.
      </p>
      <Skeleton className="skeleton-title" />
      <Skeleton className="skeleton-block" />
      <Skeleton className="skeleton-block" />
    </div>
  );
}
