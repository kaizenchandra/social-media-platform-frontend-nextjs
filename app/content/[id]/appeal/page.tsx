import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/server";
import { getPublicationAdapter } from "@/lib/publication/server";
import { AppealEntry } from "@/features/publication/support";
import { FeedLoading } from "@/features/feed/feed-loading";
import { SessionWatch } from "@/features/auth/account-panel";
import { EmptyState } from "@/components/ui/primitives";
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireAccount(`/content/${id}/appeal`);
  if (!account.profile.onboarded) redirect("/onboarding");
  const result = await getPublicationAdapter().read(account.profile.id, id);
  return (
    <div className="page-content composer-page">
      <SessionWatch expiresAt={account.expiresAt} />
      <h1>Appeal options</h1>
      {result.ok && result.item.decision?.appealEligible ? (
        <>
          <p>
            Scripted fixture explanation: {result.item.decision.reason}. This is
            not an authoritative moderation decision.
          </p>
          <AppealEntry />
          <Link href={`/content/${id}`}>Back to workflow status</Link>
        </>
      ) : (
        <EmptyState
          title="Appeal unavailable"
          description="No owned, eligible preview decision is available."
          action={<Link href="/drafts">View your workflows</Link>}
        />
      )}
    </div>
  );
}
export default function Page({ params }: PageProps<"/content/[id]/appeal">) {
  return (
    <Suspense fallback={<FeedLoading />}>
      <Content params={params} />
    </Suspense>
  );
}
