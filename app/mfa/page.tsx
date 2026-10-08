import type { Metadata } from "next";
import { AuthScreen } from "@/features/auth/auth-screen";
export const metadata: Metadata = { title: "Mfa" };
export default function Page() {
  return <AuthScreen kind="mfa" />;
}
