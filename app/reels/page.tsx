import { Suspense } from "react";
import { MediaContent } from "@/features/media/content";
import { FeedLoading } from "@/features/feed/feed-loading";
export default function Page({ searchParams }: PageProps<"/reels">) {
  return (
    <Suspense fallback={<FeedLoading />}>
      <MediaContent kind="reel" searchParams={searchParams} />
    </Suspense>
  );
}
