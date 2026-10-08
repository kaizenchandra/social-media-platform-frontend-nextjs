import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/server";
import { getFeedAdapter } from "@/lib/feed/server";
import { FeedView } from "@/features/feed/feed-view";
import { feedQuery } from "@/features/feed/validation";
import { EmptyState } from "@/components/ui/primitives";
export async function FeedContent({
  searchParams,
  saved = false,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  saved?: boolean;
}) {
  const account = await requireAccount(saved ? "/saved" : "/");
  if (!account.profile.onboarded) redirect("/onboarding");
  const query = await searchParams;
  const parsed = feedQuery.safeParse({
    mode: saved ? "saved" : query.mode,
    cursor: query.cursor,
  });
  const result = parsed.success
    ? await getFeedAdapter().read(account.profile, parsed.data)
    : {
        ok: false as const,
        error: {
          message: "This feed link is invalid. Start from the first page.",
        },
      };
  if (!result.ok)
    return (
      <div className="page-content">
        <h1>Feed unavailable</h1>
        <EmptyState
          title="Let’s try a fresh page"
          description={result.error.message}
          action={
            <Link
              className="button button-primary"
              href={saved ? "/saved" : "/"}
            >
              Start from first page
            </Link>
          }
        />
      </div>
    );
  return (
    <FeedView
      page={result.page}
      expiresAt={account.expiresAt}
      navigationKey={`${parsed.success ? (parsed.data.mode ?? "default") : "default"}:${parsed.success ? (parsed.data.cursor ?? "first") : "first"}`}
    />
  );
}
