import { Suspense } from "react";
import { communityAccount, Session } from "@/features/community/route";
import { getCommunityStore } from "@/lib/community/server";
import { BusinessPages } from "@/features/community/views";
async function Content() {
  const a = await communityAccount("/pages");
  return (
    <div className="page-content discovery-page">
      <Session expiresAt={a.expiresAt} />
      <BusinessPages
        pages={await getCommunityStore().businessPages(a.profile.id)}
      />
    </div>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<p>Loading pages…</p>}>
      <Content />
    </Suspense>
  );
}
