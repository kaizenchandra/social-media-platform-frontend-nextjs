import type { Metadata } from "next";
import { AuthScreen } from "@/features/auth/auth-screen";
export const metadata: Metadata = { title: "Register" };
export default function Page() {
  return <AuthScreen kind="register" />;
}
