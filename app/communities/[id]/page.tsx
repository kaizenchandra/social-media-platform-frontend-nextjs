import { AccessWatch } from "@/features/community/access-watch";
import { Suspense } from "react";
import { communityAccount, Session } from "@/features/community/route";
import { getCommunityStore } from "@/lib/community/server";
import { CommunityView } from "@/features/community/views";
import Link from "next/link";
// Shared previews deliberately contain no community-specific title, text, or media.
export const metadata = {
  title: "Community | Common",
  description: "Sign in to check community access.",
};
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const a = await communityAccount("/communities"),
    { id } = await params,
    c = await getCommunityStore().detail(a.profile.id, id);
  return (
    <AccessWatch>
      <div className="page-content discovery-page">
        <Session expiresAt={a.expiresAt} />
        {c ? (
          <CommunityView c={c} />
        ) : (
          <>
            <h1>Community unavailable</h1>
            <Link href="/communities">Explore communities</Link>
          </>
        )}
      </div>
    </AccessWatch>
  );
}
export default function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p>Loading community…</p>}>
      <Content {...props} />
    </Suspense>
  );
}
