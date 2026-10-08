import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/server";
import { SessionWatch } from "@/features/auth/account-panel";
import { GroupView } from "@/features/groups/group-view";
import { FeedLoading } from "@/features/feed/feed-loading";
async function Content() {
  const account = await requireAccount("/groups");
  if (!account.profile.onboarded) redirect("/onboarding");
  return (
    <div className="page-content">
      <SessionWatch expiresAt={account.expiresAt} />
      <GroupView />
    </div>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<FeedLoading />}>
      <Content />
    </Suspense>
  );
}
