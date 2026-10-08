import "server-only";
import { CommunityStore } from "./store";
import { getProfilesAdapter } from "@/lib/profiles/server";
import { getAuthAdapter, getAuthMode } from "@/lib/auth/server";
const state = globalThis as typeof globalThis & {
  commonCommunities?: CommunityStore;
};
export function getCommunityStore() {
  if (getAuthMode() !== "mock")
    throw new Error("Community services unavailable");
  state.commonCommunities ??= new CommunityStore(async (actor, owner) => {
    if (actor === owner) return true;
    const identity = await getAuthAdapter().profileIdentity(actor);
    if (!identity) return false;
    return !!(await getProfilesAdapter().person(identity, owner));
  });
  return state.commonCommunities;
}
