import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAccount } from "@/lib/auth/server";
import { SessionWatch } from "@/features/auth/account-panel";
import { Composer } from "@/features/publication/composer";
import type { MediaKind } from "./contracts";
export async function MediaCreatorPage({ kind }: { kind: MediaKind }) {
  const path =
    kind === "story" ? "stories" : kind === "reel" ? "reels" : "videos";
  const account = await requireAccount(`/${path}/create`);
  if (!account.profile.onboarded) redirect("/onboarding");
  return (
    <div className="page-content composer-page">
      <SessionWatch expiresAt={account.expiresAt} />
      <Link href={`/${path}`}>Back to {path}</Link>
      <h1>Create a {kind}</h1>
      <p className="muted">
        Private {kind} draft · Phase 06 upload, processing, screening and review
        simulation. No public distribution, even after simulated approval.
      </p>
      {kind === "story" && (
        <p className="alert">
          Text, image and video story drafts are supported. A real service must
          enforce the intended 24-hour availability and approved highlights;
          this draft never enters the stories tray.
        </p>
      )}
      <Composer format={kind} />
    </div>
  );
}
