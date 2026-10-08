import type { AccountSnapshot, AuthOutcome } from "@/features/auth/contracts";
import type { AuthCommand } from "@/features/auth/validation";
export type AuthContext = {
  sessionToken?: string;
  challengeToken?: string;
  browserId: string;
};
export type AdapterResult = {
  outcome: AuthOutcome;
  sessionToken?: string;
  challengeToken?: string;
  clearSession?: boolean;
  clearChallenge?: boolean;
};
export interface AuthAdapter {
  execute(
    command: AuthCommand,
    context: AuthContext,
    requestId: string,
  ): Promise<AdapterResult>;
  profileIdentity(
    idOrUsername: string,
  ): Promise<Pick<
    import("@/features/auth/contracts").AuthProfile,
    "id" | "displayName" | "username" | "bio" | "version"
  > | null>;
  account(sessionToken?: string): Promise<AccountSnapshot | null>;
}
