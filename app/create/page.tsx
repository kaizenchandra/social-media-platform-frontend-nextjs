import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/server";
import { getPublicationAdapter } from "@/lib/publication/server";
import { Composer } from "@/features/publication/composer";
import { SessionWatch } from "@/features/auth/account-panel";
import { FeedLoading } from "@/features/feed/feed-loading";
import { EmptyState } from "@/components/ui/primitives";
async function Content({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const account = await requireAccount("/create");
  if (!account.profile.onboarded) redirect("/onboarding");
  const query = await searchParams;
  const reference = query.draft ?? query.copy;
  const result = reference
    ? await getPublicationAdapter().read(
        account.profile.id,
        typeof reference === "string" ? reference : "invalid",
      )
    : null;
  if (result && (!result.ok || (query.draft && result.item.state !== "DRAFT")))
    return (
      <div className="page-content">
        <h1>Draft unavailable</h1>
        <EmptyState
          title="Start with a fresh draft"
          description="This draft is unavailable or has already entered a workflow."
          action={
            <Link className="button button-primary" href="/create">
              Create a new draft
            </Link>
          }
        />
      </div>
    );
  return (
    <div className="page-content composer-page">
      <SessionWatch expiresAt={account.expiresAt} />
      <h1>Create a post</h1>
      <p className="muted">
        Make room for a thought. Choose who it is intended for.
      </p>
      <Composer
        initial={query.draft && result?.ok ? result.item : undefined}
        copy={query.copy && result?.ok ? result.item.draft : undefined}
      />
    </div>
  );
}
export default function Page({ searchParams }: PageProps<"/create">) {
  return (
    <Suspense fallback={<FeedLoading />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
