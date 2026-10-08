import "server-only";
import { connection } from "next/server";
import {
  getAuthMode,
  getAuthAdapter,
  readAuthContext,
} from "@/lib/auth/server";
import type { ProfilesAdapter } from "./adapter";
import { createDevelopmentProfilesAdapter, failure } from "./mock-adapter";
const empty = {
  incoming: [],
  outgoing: [],
  friends: [],
  followers: [],
  following: [],
  suggestions: [],
  favorites: [],
  blocked: [],
  restricted: [],
};
const unavailable: ProfilesAdapter = {
  async content() {
    return [];
  },
  async person() {
    return null;
  },
  async profile() {
    return { kind: "unavailable" };
  },
  async connections() {
    return empty;
  },
  async execute() {
    return failure(
      "unavailable",
      "Profiles and connections are not connected to a service.",
    );
  },
};
const state = globalThis as typeof globalThis & {
  commonPreviewProfiles?: ProfilesAdapter;
};
export function getProfilesAdapter() {
  if (getAuthMode() !== "mock") return unavailable;
  state.commonPreviewProfiles ??= createDevelopmentProfilesAdapter(
    { nodeEnv: process.env.NODE_ENV!, mode: "mock" },
    (id) => getAuthAdapter().profileIdentity(id),
  );
  return state.commonPreviewProfiles;
}
export async function readProfile(username?: string) {
  await connection();
  const context = await readAuthContext();
  const account = await getAuthAdapter().account(context.sessionToken);
  return {
    mode: getAuthMode(),
    account,
    profile: await getProfilesAdapter().profile(
      account?.profile.onboarded ? account.profile : null,
      username,
    ),
  };
}
