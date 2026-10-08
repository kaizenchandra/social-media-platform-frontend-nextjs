import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/server";
import { getProfilesAdapter } from "@/lib/profiles/server";
import { ProfilePage } from "@/features/profiles/profile-view";
import { ProfileLoading } from "@/features/profiles/profile-loading";
import { EmptyState } from "@/components/ui/primitives";
async function OwnProfile() {
  const account = await requireAccount("/profile");
  if (!account.profile.onboarded) redirect("/onboarding");
  const profile = await getProfilesAdapter().profile(account.profile);
  return profile.kind === "visible" ? (
    <ProfilePage profile={profile} expiresAt={account.expiresAt} />
  ) : (
    <EmptyState
      title="Profile unavailable"
      description="The profile service is unavailable. Try again later."
    />
  );
}
export default function Page() {
  return (
    <Suspense fallback={<ProfileLoading />}>
      <OwnProfile />
    </Suspense>
  );
}
