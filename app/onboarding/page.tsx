import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/server";
import { OnboardingForm } from "@/features/auth/onboarding-form";
async function ProtectedOnboarding() {
  const account = await requireAccount("/onboarding");
  if (account.profile.onboarded) redirect("/account");
  return <OnboardingForm account={account} />;
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
      <ProtectedOnboarding />
    </Suspense>
  );
}
