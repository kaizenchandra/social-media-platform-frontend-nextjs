import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/server";
import { getFeedAdapter } from "@/lib/feed/server";
import { PostCard } from "@/features/feed/post-card";
import { CommentThread } from "@/features/feed/comments";
import { FeedFeedback } from "@/features/feed/feedback";
import { FeedLoading } from "@/features/feed/feed-loading";
import { FeedRefresh } from "@/features/feed/feed-refresh";
import { SessionWatch } from "@/features/auth/account-panel";
import { EmptyState, Badge } from "@/components/ui/primitives";
async function PostContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireAccount(`/posts/${id}`);
  if (!account.profile.onboarded) redirect("/onboarding");
  const result = await getFeedAdapter().post(account.profile, id);
  if (!result.ok)
    return (
      <div className="page-content">
        <h1>Post unavailable</h1>
        <EmptyState
          title="Nothing shared here"
          description="This post is unavailable or is not shared with this audience."
          action={
            <Link className="button button-secondary" href="/">
              Back to feed
            </Link>
          }
        />
      </div>
    );
  return (
    <div className="page-content feed-page">
      <SessionWatch expiresAt={account.expiresAt} />
      <div className="page-heading">
        <Link href="/">Back to feed</Link>
        <Badge>Development preview</Badge>
      </div>
      <h1 className="post-page-title">Post and conversation</h1>
      <FeedRefresh />
      <FeedFeedback>
        <PostCard post={result.post} detail />
        <CommentThread postId={id} comments={result.comments} />
      </FeedFeedback>
    </div>
  );
}
export default function Page({ params }: PageProps<"/posts/[id]">) {
  return (
    <Suspense fallback={<FeedLoading />}>
      <PostContent params={params} />
    </Suspense>
  );
}
