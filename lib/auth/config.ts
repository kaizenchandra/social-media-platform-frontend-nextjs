import type { AuthMode } from "@/features/auth/contracts";
export function resolveAuthMode(
  nodeEnv: string | undefined,
  configuredMode: string | undefined,
): AuthMode {
  return nodeEnv === "development" && configuredMode === "mock"
    ? "mock"
    : "unavailable";
}
