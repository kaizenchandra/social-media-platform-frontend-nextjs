import { Suspense } from "react";
import { communityAccount, Session } from "@/features/community/route";
import { getTrustStore } from "@/lib/trust/server";
import { getProfilesAdapter } from "@/lib/profiles/server";
import { PrivacyView } from "@/features/trust/views";
async function Content() {
  const a = await communityAccount("/privacy"),
    profiles = getProfilesAdapter(),
    view = await profiles.profile(a.profile),
    connections = await profiles.connections(a.profile),
    p = getTrustStore().privacy(a.profile.id);
  if (view.kind === "visible" && view.settings)
    p.audience = view.settings.visibility;
  return (
    <div className="page-content discovery-page">
      <Session expiresAt={a.expiresAt} />
      <PrivacyView p={p} blocked={connections.blocked} />
    </div>
  );
}
export default function Page() {
  return (
    <Suspense
      fallback={
        <>
          <p>Loading privacy…</p>
          <p>JavaScript is required to submit this private preview form.</p>
        </>
      }
    >
      <Content />
    </Suspense>
  );
}
