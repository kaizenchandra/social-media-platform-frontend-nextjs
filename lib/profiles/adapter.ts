import type {
  ProfileRead,
  ProfileIdentity,
  ConnectionsView,
  ProfileOutcome,
} from "@/features/profiles/contracts";
import type { ProfileCommand } from "@/features/profiles/validation";
export type IdentitySave = (
  name: string,
  bio: string,
  version: number,
) => Promise<ProfileOutcome>;
export interface ProfilesAdapter {
  content(
    actor: ProfileIdentity,
  ): Promise<import("@/features/feed/contracts").ContentSource[]>;
  person(
    actor: ProfileIdentity,
    id: string,
  ): Promise<import("@/features/profiles/contracts").Person | null>;
  profile(
    actor: ProfileIdentity | null,
    username?: string,
  ): Promise<ProfileRead>;
  connections(actor: ProfileIdentity): Promise<ConnectionsView>;
  execute(
    actor: ProfileIdentity | null,
    command: ProfileCommand,
    requestId: string,
    saveIdentity: IdentitySave,
  ): Promise<ProfileOutcome>;
}
