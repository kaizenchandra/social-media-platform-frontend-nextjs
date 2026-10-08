import { Suspense } from "react";
import Link from "next/link";
import { communityAccount, Session } from "@/features/community/route";
import { AccessWatch } from "@/features/community/access-watch";
import { getAdvancedAdapter } from "@/lib/advanced/server";
import { CreatorView } from "@/features/advanced/views";
async function Content() {
  const a = await communityAccount("/creator"),
    result = await getAdvancedAdapter().creator(a.profile);
  return (
    <AccessWatch>
      <div className="page-content discovery-page">
        <Session expiresAt={a.expiresAt} />
        {result.ok ? (
          <CreatorView snapshot={result.data} />
        ) : (
          <>
            <h1>Creator studio unavailable</h1>
            <p>{result.error.message}</p>
            <Link href="/creator">Retry</Link>
          </>
        )}
      </div>
    </AccessWatch>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<p>Loading creator studio…</p>}>
      <Content />
    </Suspense>
  );
}
