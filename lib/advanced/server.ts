import "server-only";
import { getAuthAdapter, getAuthMode } from "@/lib/auth/server";
import { getProfilesAdapter } from "@/lib/profiles/server";
import { getPublicationAdapter } from "@/lib/publication/server";
import {
  createDevelopmentAdvancedAdapter,
  advancedFailure,
} from "./development-adapter";
import type { AdvancedAdapter } from "./adapter";
const unavailable: AdvancedAdapter = {
  async creator() {
    return advancedFailure(
      "unavailable",
      "Creator services are not connected.",
    );
  },
  async marketplace() {
    return advancedFailure(
      "unavailable",
      "Marketplace services are not connected.",
    );
  },
  async listing() {
    return advancedFailure(
      "unavailable",
      "Marketplace services are not connected.",
    );
  },
  async seller() {
    return advancedFailure(
      "unavailable",
      "Marketplace services are not connected.",
    );
  },
  async wellbeing() {
    return advancedFailure(
      "unavailable",
      "Preference services are not connected.",
    );
  },
  async execute() {
    return advancedFailure(
      "unavailable",
      "Advanced platform services are not connected.",
    );
  },
};
const state = globalThis as typeof globalThis & {
  commonAdvanced?: AdvancedAdapter;
};
export function getAdvancedAdapter(): AdvancedAdapter {
  if (getAuthMode() !== "mock") return unavailable;
  state.commonAdvanced ??= createDevelopmentAdvancedAdapter(
    { nodeEnv: process.env.NODE_ENV!, mode: "mock" },
    getProfilesAdapter(),
    getPublicationAdapter(),
    async (id) => !!(await getAuthAdapter().profileIdentity(id)),
  );
  return state.commonAdvanced;
}
