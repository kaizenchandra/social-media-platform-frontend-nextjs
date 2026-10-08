import { Suspense } from "react";
import Link from "next/link";
import { communityAccount, Session } from "@/features/community/route";
import { AccessWatch } from "@/features/community/access-watch";
import { getAdvancedAdapter } from "@/lib/advanced/server";
import {
  AdvancedNavigation,
  AdvancedNotice,
  ListingCard,
} from "@/features/advanced/views";
export const metadata = {
  title: "Seller profile",
  description: "Sign in to check seller access.",
};
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const a = await communityAccount("/marketplace"),
    { id } = await params,
    result = await getAdvancedAdapter().seller(a.profile, id);
  return (
    <AccessWatch>
      <div className="page-content discovery-page">
        <Session expiresAt={a.expiresAt} />
        <AdvancedNavigation />
        {result.ok ? (
          <>
            <h1>{result.data.person.displayName}</h1>
            <AdvancedNotice />
            <p>@{result.data.person.username} · synthetic seller profile</p>
            <p>
              Verification, buyer ratings and transaction reputation are
              unavailable. No seller score has been calculated.
            </p>
            <div className="publication-actions">
              <Link href={`/profile/${result.data.person.username}`}>
                View social profile
              </Link>
              <Link href={`/reports?kind=user&target=${id}`}>
                Report seller
              </Link>
            </div>
            <h2>Available synthetic listings</h2>
            <div className="discovery-grid">
              {result.data.listings.map((item) => (
                <ListingCard key={item.id} item={item} />
              ))}
            </div>
            {!result.data.listings.length && <p>No available listings.</p>}
          </>
        ) : (
          <>
            <h1>Seller unavailable</h1>
            <Link href="/marketplace">Browse listings</Link>
          </>
        )}
      </div>
    </AccessWatch>
  );
}
export default function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p>Checking seller access…</p>}>
      <Content {...props} />
    </Suspense>
  );
}
