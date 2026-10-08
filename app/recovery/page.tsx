import type { Metadata } from "next";
import { AuthScreen } from "@/features/auth/auth-screen";
export const metadata: Metadata = { title: "Recovery" };
export default function Page() {
  return <AuthScreen kind="recovery" />;
}
