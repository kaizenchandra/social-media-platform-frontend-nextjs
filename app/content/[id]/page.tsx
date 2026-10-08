import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/server";
import { getPublicationAdapter } from "@/lib/publication/server";
import { PublicationStatus } from "@/features/publication/status";
import { SessionWatch } from "@/features/auth/account-panel";
import { FeedLoading } from "@/features/feed/feed-loading";
import { EmptyState } from "@/components/ui/primitives";
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireAccount(`/content/${id}`);
  if (!account.profile.onboarded) redirect("/onboarding");
  const result = await getPublicationAdapter().read(account.profile.id, id);
  return (
    <div className="page-content composer-page">
      <SessionWatch expiresAt={account.expiresAt} />
      <h1>Private content workflow</h1>
      <Link href="/drafts">Back to drafts</Link>
      {result.ok ? (
        <PublicationStatus initial={result.item} />
      ) : (
        <EmptyState
          title="Content unavailable"
          description="This content is unavailable or is not owned by this account."
          action={
            <Link className="button button-secondary" href="/drafts">
              View your drafts
            </Link>
          }
        />
      )}
    </div>
  );
}
export default function Page({ params }: PageProps<"/content/[id]">) {
  return (
    <Suspense fallback={<FeedLoading />}>
      <Content params={params} />
    </Suspense>
  );
}
