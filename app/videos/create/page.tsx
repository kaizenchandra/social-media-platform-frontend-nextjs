import { Suspense } from "react";
import { MediaCreatorPage } from "@/features/media/creator-page";
import { FeedLoading } from "@/features/feed/feed-loading";
export default function Page() {
  return (
    <Suspense fallback={<FeedLoading />}>
      <MediaCreatorPage kind="video" />
    </Suspense>
  );
}
