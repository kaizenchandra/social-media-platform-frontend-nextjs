import { Suspense } from "react";
import Link from "next/link";
import { communityAccount, Session } from "@/features/community/route";
import { AccessWatch } from "@/features/community/access-watch";
import { getAdvancedAdapter } from "@/lib/advanced/server";
import { ListingDetail } from "@/features/advanced/views";
export const metadata = {
  title: "Marketplace listing",
  description:
    "Sign in to check listing access. No transaction service is connected.",
};
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const a = await communityAccount("/marketplace"),
    { id } = await params,
    result = await getAdvancedAdapter().listing(a.profile, id);
  return (
    <AccessWatch>
      <div className="page-content discovery-page">
        <Session expiresAt={a.expiresAt} />
        {result.ok ? (
          <ListingDetail item={result.data} />
        ) : (
          <>
            <h1>Listing unavailable</h1>
            <p>
              The listing is private, withdrawn from discovery, blocked or
              unavailable.
            </p>
            <Link href="/marketplace">Browse listings</Link>
          </>
        )}
      </div>
    </AccessWatch>
  );
}
export default function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p>Checking listing access…</p>}>
      <Content {...props} />
    </Suspense>
  );
}
