import { Suspense } from "react";
import { communityAccount, Session } from "@/features/community/route";
import { getCommunityStore } from "@/lib/community/server";
import { CommunityListing } from "@/features/community/views";
async function Content() {
  const a = await communityAccount("/communities");
  return (
    <div className="page-content discovery-page">
      <Session expiresAt={a.expiresAt} />
      <CommunityListing cards={await getCommunityStore().list(a.profile.id)} />
    </div>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<p>Loading communities…</p>}>
      <Content />
    </Suspense>
  );
}
