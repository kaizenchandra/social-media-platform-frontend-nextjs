import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/server";
import { getPublicationAdapter } from "@/lib/publication/server";
import { SessionWatch } from "@/features/auth/account-panel";
import { FeedLoading } from "@/features/feed/feed-loading";
import { Alert, Badge, EmptyState } from "@/components/ui/primitives";
async function Content() {
  const account = await requireAccount("/drafts");
  if (!account.profile.onboarded) redirect("/onboarding");
  const result = await getPublicationAdapter().list(account.profile.id);
  return (
    <div className="page-content composer-page">
      <SessionWatch expiresAt={account.expiresAt} />
      <h1>Drafts and workflows</h1>
      <p className="muted">
        Owner-only preview content. Nothing here is publicly distributed.
      </p>
      <Link className="button button-primary" href="/create">
        Create a post
      </Link>
      {!result.ok ? (
        <Alert title="Drafts unavailable" tone="danger">
          {result.error.message}
          <Link href="/drafts">Retry draft list</Link>
        </Alert>
      ) : !result.items.length ? (
        <EmptyState
          title="No private drafts yet"
          description="Write a thought or attach benign synthetic media in the composer."
        />
      ) : (
        <ul className="draft-list">
          {result.items.map((item) => (
            <li className="card draft-card" key={item.id}>
              <Badge>Simulated {item.state}</Badge>
              <p>{item.draft.text.slice(0, 150) || "Media-only draft"}</p>
              <p className="field-hint">
                {item.draft.media.length} attachments · Intended audience:{" "}
                {item.draft.audience}
              </p>
              <div className="publication-actions">
                <Link
                  className="button button-secondary"
                  href={
                    item.state === "DRAFT"
                      ? `/create?draft=${item.id}`
                      : `/content/${item.id}`
                  }
                >
                  {item.state === "DRAFT"
                    ? "Edit private draft"
                    : "View workflow status"}
                </Link>
                <Link href={`/create?copy=${item.id}`}>
                  Copy into a new draft revision
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
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
