import { AccessWatch } from "@/features/community/access-watch";
import { Suspense } from "react";
import Link from "next/link";
import { communityAccount, Session } from "@/features/community/route";
import { getTrustStore } from "@/lib/trust/server";
import { CaseList, ReportForm } from "@/features/trust/views";
import { PreviewNotice } from "@/features/community/views";
async function Content({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const a = await communityAccount("/reports"),
    p = await searchParams;
  return (
    <AccessWatch>
      <div className="page-content discovery-page">
        <Session expiresAt={a.expiresAt} />
        <h1>Reports and appeals</h1>
        <PreviewNotice />
        <Link href="/safety">Safety center</Link>
        <ReportForm
          kind={typeof p.kind === "string" ? p.kind : "content"}
          target={typeof p.target === "string" ? p.target.slice(0, 100) : ""}
        />
        <h2>Your report status</h2>
        <CaseList cases={getTrustStore().reports(a.profile.id)} />
      </div>
    </AccessWatch>
  );
}
export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <>
          <p>Loading reports…</p>
          <p>JavaScript is required to submit this private preview form.</p>
        </>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
