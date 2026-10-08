import "server-only";
import { getAuthMode, getAuthAdapter } from "@/lib/auth/server";
import {
  createDevelopmentPublicationAdapter,
  publicationFailure,
} from "./mock-adapter";
import type { PublicationAdapter } from "./adapter";
const unavailable: PublicationAdapter = {
  async read() {
    return publicationFailure(
      "unavailable",
      "The publication service is not connected.",
    );
  },
  async list() {
    return publicationFailure(
      "unavailable",
      "The draft service is not connected.",
    );
  },
  async execute() {
    return publicationFailure(
      "unavailable",
      "Upload, screening and publication are not connected.",
    );
  },
};
const processState = globalThis as typeof globalThis & {
  commonPreviewPublication?: PublicationAdapter;
};
export function getPublicationAdapter(): PublicationAdapter {
  if (getAuthMode() !== "mock") return unavailable;
  processState.commonPreviewPublication ??= createDevelopmentPublicationAdapter(
    { nodeEnv: process.env.NODE_ENV!, mode: "mock" },
    async (id) => !!(await getAuthAdapter().profileIdentity(id)),
  );
  return processState.commonPreviewPublication;
}
