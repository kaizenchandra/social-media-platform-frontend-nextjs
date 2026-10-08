import { Skeleton } from "@/components/ui/primitives";
export function ProfileLoading() {
  return (
    <div
      className="page-content profile-loading"
      role="status"
      aria-label="Loading profile or connections"
    >
      <span className="sr-only">Loading profile or connections…</span>
      <Skeleton className="profile-loading-cover" />
      <Skeleton className="profile-loading-title" />
      <Skeleton className="profile-loading-post" />
    </div>
  );
}
