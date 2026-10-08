import type { Metadata } from "next";
import { AuthScreen } from "@/features/auth/auth-screen";
export const metadata: Metadata = { title: "Reset Password" };
export default function Page() {
  return <AuthScreen kind="reset-password" />;
}
