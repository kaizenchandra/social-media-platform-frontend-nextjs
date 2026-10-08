import { Suspense } from "react";
import { communityAccount, Session } from "@/features/community/route";
import { AccessWatch } from "@/features/community/access-watch";
import { getProfilesAdapter } from "@/lib/profiles/server";
import { AssistantView } from "@/features/advanced/assistant-view";
async function Content() {
  const a = await communityAccount("/assistant"),
    sources = (await getProfilesAdapter().content(a.profile))
      .filter((s) => s.post.audience === "public")
      .map((s) => ({
        id: s.post.id,
        title: `${s.author.displayName} · ${s.post.title}`,
      }));
  return (
    <AccessWatch>
      <div className="page-content discovery-page">
        <Session expiresAt={a.expiresAt} />
        <AssistantView sources={sources} />
      </div>
    </AccessWatch>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<p>Loading assistance tools…</p>}>
      <Content />
    </Suspense>
  );
}
