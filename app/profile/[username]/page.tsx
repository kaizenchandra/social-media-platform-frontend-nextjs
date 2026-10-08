import { Suspense } from "react";
import Link from "next/link";
import { readProfile } from "@/lib/profiles/server";
import { ProfilePage } from "@/features/profiles/profile-view";
import { ProfileLoading } from "@/features/profiles/profile-loading";
import { EmptyState, Badge } from "@/components/ui/primitives";
async function PublicProfile({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const result = await readProfile(username);
  if (result.profile.kind !== "visible")
    return (
      <div className="page-content">
        <Badge>
          {result.mode === "mock"
            ? "Development preview"
            : "Service unavailable"}
        </Badge>
        <h1>Profile unavailable</h1>
        <EmptyState
          title="Nothing shared here"
          description="This profile is unavailable or has not shared content with this audience."
          action={
            <Link href="/connections" className="button button-secondary">
              Manage your connections
            </Link>
          }
        />
      </div>
    );
  return (
    <ProfilePage
      profile={result.profile}
      expiresAt={result.account?.expiresAt}
    />
  );
}
export default function Page({ params }: PageProps<"/profile/[username]">) {
  return (
    <Suspense fallback={<ProfileLoading />}>
      <PublicProfile params={params} />
    </Suspense>
  );
}
