import { Suspense } from "react";
import { FeedContent } from "@/features/feed/feed-content";
import { FeedLoading } from "@/features/feed/feed-loading";
export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<FeedLoading />}>
      <FeedContent searchParams={searchParams} />
    </Suspense>
  );
}
