import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/server";
import { AccountPanel } from "@/features/auth/account-panel";
async function ProtectedAccount() {
  const account = await requireAccount("/account");
  if (!account.profile.onboarded) redirect("/onboarding");
  return <AccountPanel account={account} sessionsOnly={false} />;
}
export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="page-content" role="status">
          Checking your session…
        </p>
      }
    >
      <ProtectedAccount />
    </Suspense>
  );
}
