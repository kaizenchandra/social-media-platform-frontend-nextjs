import Link from "next/link";
import { getAdvancedAdapter } from "@/lib/advanced/server";
import { BuyerMessage } from "@/features/advanced/buyer-message";
import { AccessWatch } from "@/features/community/access-watch";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/server";
import { SessionWatch } from "@/features/auth/account-panel";
import { MessagingView } from "@/features/messaging/messaging-view";
import { FeedLoading } from "@/features/feed/feed-loading";
async function Content({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const account = await requireAccount("/messages");
  if (!account.profile.onboarded) redirect("/onboarding");
  const query = await searchParams;
  const listingId =
    typeof query.listing === "string" ? query.listing : undefined;
  const listing = listingId
    ? await getAdvancedAdapter().listing(account.profile, listingId)
    : null;
  return (
    <div className="page-content">
      <SessionWatch expiresAt={account.expiresAt} />
      {listingId ? (
        <AccessWatch>
          {listing?.ok && listing.data.canContact ? (
            <BuyerMessage item={listing.data} />
          ) : (
            <>
              <h1>Seller messaging unavailable</h1>
              <p>Listing access is required to prepare a buyer message.</p>
              <Link href="/marketplace">Browse listings</Link>
            </>
          )}
        </AccessWatch>
      ) : (
        <MessagingView />
      )}
    </div>
  );
}
export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<FeedLoading />}>
      <Content {...props} />
    </Suspense>
  );
}
