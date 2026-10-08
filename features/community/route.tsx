import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/server";
import { SessionWatch } from "@/features/auth/account-panel";
export async function communityAccount(path: string) {
  const a = await requireAccount(path);
  if (!a.profile.onboarded) redirect("/onboarding");
  return a;
}
export function Session({ expiresAt }: { expiresAt: string }) {
  return <SessionWatch expiresAt={expiresAt} />;
}
