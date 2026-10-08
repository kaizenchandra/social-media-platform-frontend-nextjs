import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthScreen } from "@/features/auth/auth-screen";
import { safeReturnTo } from "@/features/auth/validation";
export const metadata: Metadata = { title: "Sign in" };
async function LoginContent({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const notices: Record<string, string> = {
    expired:
      "Your preview session is missing or expired. Sign in again to continue.",
    "signed-out": "You have signed out of the preview.",
    reset: "The preview password was reset. Sign in with the new password.",
    deactivated:
      "Preview account deactivated. Use account recovery to reactivate it.",
    deleted: "Preview account deleted. No real service data was affected.",
  };
  return (
    <AuthScreen
      kind="login"
      notice={
        typeof params.reason === "string" ? notices[params.reason] : undefined
      }
      returnTo={safeReturnTo(params.returnTo)}
    />
  );
}
export default function LoginPage(props: PageProps<"/login">) {
  return (
    <>
      <noscript>
        <p className="page-content">
          JavaScript is required for this preview. Sign-in submission stays
          disabled until the page is ready.
        </p>
      </noscript>
      <Suspense
        fallback={
          <p className="page-content" role="status">
            Loading sign in…
          </p>
        }
      >
        <LoginContent {...props} />
      </Suspense>
    </>
  );
}
