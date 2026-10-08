import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/server";
import { getProfilesAdapter } from "@/lib/profiles/server";
import { ConnectionsPage } from "@/features/profiles/connections-view";
import { ProfileLoading } from "@/features/profiles/profile-loading";
async function Connections() {
  const account = await requireAccount("/connections");
  if (!account.profile.onboarded) redirect("/onboarding");
  return (
    <ConnectionsPage
      data={await getProfilesAdapter().connections(account.profile)}
      expiresAt={account.expiresAt}
    />
  );
}
export default function Page() {
  return (
    <Suspense fallback={<ProfileLoading />}>
      <Connections />
    </Suspense>
  );
}
