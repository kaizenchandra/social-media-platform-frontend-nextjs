import { Suspense } from "react";
import Link from "next/link";
import { communityAccount, Session } from "@/features/community/route";
import { getAdvancedAdapter } from "@/lib/advanced/server";
import { getFeedAdapter } from "@/lib/feed/server";
import { WellbeingView } from "@/features/advanced/wellbeing-view";
async function Content() {
  const a = await communityAccount("/wellbeing"),
    [preferences, feed] = await Promise.all([
      getAdvancedAdapter().wellbeing(a.profile),
      getFeedAdapter().read(a.profile, { mode: "home" }),
    ]);
  return (
    <div className="page-content discovery-page">
      <Session expiresAt={a.expiresAt} />
      {preferences.ok ? (
        <WellbeingView
          p={preferences.data}
          feed={feed.ok ? feed.page.preferences : null}
        />
      ) : (
        <>
          <h1>Well-being preferences unavailable</h1>
          <p>{preferences.error.message}</p>
          <Link href="/wellbeing">Retry</Link>
        </>
      )}
    </div>
  );
}
export default function Page() {
  return (
    <Suspense
      fallback={
        <>
          <p>Loading well-being preferences…</p>
          <p>JavaScript is required to submit this private preview form.</p>
        </>
      }
    >
      <Content />
    </Suspense>
  );
}
