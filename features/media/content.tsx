import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/server";
import { getMediaAdapter } from "@/lib/media/server";
import { SessionWatch } from "@/features/auth/account-panel";
import { EmptyState } from "@/components/ui/primitives";
import { MediaExperience, LongVideoView } from "./experience";
import type { MediaKind } from "./contracts";
export async function MediaContent({
  kind,
  searchParams,
}: {
  kind: MediaKind;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const path =
    kind === "story" ? "stories" : kind === "reel" ? "reels" : "videos";
  const account = await requireAccount(`/${path}`);
  if (!account.profile.onboarded) redirect("/onboarding");
  const query = await searchParams;
  const result = await getMediaAdapter().catalog(account.profile);
  const requestedId = typeof query.item === "string" ? query.item : undefined;
  return (
    <div className="page-content rich-media-page">
      <SessionWatch expiresAt={account.expiresAt} />
      {result.ok ? (
        <MediaExperience
          initial={result.catalog}
          kind={kind}
          actorId={account.profile.id}
          requestedId={requestedId}
        />
      ) : (
        <>
          <h1>Media unavailable</h1>
          <EmptyState
            title="Try again later"
            description={result.error.message}
          />
        </>
      )}
    </div>
  );
}
export async function VideoContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await requireAccount(`/videos/${id}`);
  if (!account.profile.onboarded) redirect("/onboarding");
  const result = await getMediaAdapter().read(account.profile, id);
  return (
    <div className="page-content rich-media-page">
      <SessionWatch expiresAt={account.expiresAt} />
      {result.ok && result.item.kind === "video" ? (
        <LongVideoView
          initial={{
            items: [result.item],
            mode: "fixture-preview",
            generatedAt: result.generatedAt,
          }}
          itemId={id}
          actorId={account.profile.id}
          comments={result.comments}
        />
      ) : (
        <>
          <h1>Video unavailable</h1>
          <EmptyState
            title="This media cannot be viewed"
            description="It is unavailable, outside your audience, expired, or not eligible for distribution."
            action={
              <Link className="button button-secondary" href="/videos">
                Browse available videos
              </Link>
            }
          />
        </>
      )}
    </div>
  );
}
