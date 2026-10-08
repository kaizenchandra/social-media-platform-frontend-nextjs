import { AccessWatch } from "@/features/community/access-watch";
import { Suspense } from "react";
import Link from "next/link";
import { communityAccount, Session } from "@/features/community/route";
import { getTrustStore } from "@/lib/trust/server";
import { CaseList, AuditView } from "@/features/trust/views";
import { PreviewNotice } from "@/features/community/views";
async function Content() {
  const a = await communityAccount("/moderation"),
    store = getTrustStore(),
    queue = store.queue(a.profile.id);
  if (!queue)
    return (
      <AccessWatch>
        <div className="page-content">
          <h1>Moderator access required</h1>
          <p>
            Your account does not have access to moderation cases or evidence.
          </p>
          <Link href="/safety">Safety center</Link>
        </div>
      </AccessWatch>
    );
  const audit = store.audits(a.profile.id);
  return (
    <AccessWatch>
      <div className="page-content discovery-page">
        <Session expiresAt={a.expiresAt} />
        <p className="eyebrow">{store.role(a.profile.id)} workspace</p>
        <h1>Moderation queue</h1>
        <PreviewNotice />
        <p>
          Urgent consent concerns are identified individually. Expiration never
          automatically approves or dismisses a case. Simulated reversals do not
          bypass the publication safety pipeline.
        </p>
        <CaseList cases={queue} moderator />
        {audit && <AuditView entries={audit} />}
      </div>
    </AccessWatch>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<p>Checking moderator access…</p>}>
      <Content />
    </Suspense>
  );
}
