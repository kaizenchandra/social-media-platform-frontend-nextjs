import type { Metadata } from "next";
import { AuthScreen } from "@/features/auth/auth-screen";
export const metadata: Metadata = { title: "Verify Email" };
export default function Page() {
  return <AuthScreen kind="verify-email" />;
}
