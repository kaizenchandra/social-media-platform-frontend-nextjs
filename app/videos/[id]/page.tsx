import { Suspense } from "react";
import { VideoContent } from "@/features/media/content";
import { FeedLoading } from "@/features/feed/feed-loading";
export default function Page({ params }: PageProps<"/videos/[id]">) {
  return (
    <Suspense fallback={<FeedLoading />}>
      <VideoContent params={params} />
    </Suspense>
  );
}
