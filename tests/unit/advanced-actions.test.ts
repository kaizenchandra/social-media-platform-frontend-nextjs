import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  content: vi.fn(),
  generate: vi.fn(),
  execute: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("@/lib/auth/server", () => ({
  readAuthContext: async () => ({ sessionToken: "preview" }),
  getAuthAdapter: () => ({ account: mocks.account }),
}));
vi.mock("@/lib/profiles/server", () => ({
  getProfilesAdapter: () => ({ content: mocks.content }),
}));
vi.mock("@/lib/advanced/server", () => ({
  getAdvancedAdapter: () => ({ execute: mocks.execute }),
}));
vi.mock("@/lib/advanced/ai-provider", () => ({
  getAssistantProvider: () => ({ generate: mocks.generate }),
}));
import { advancedAction, requestAssistance } from "@/features/advanced/actions";
const request = {
  task: "summary",
  sourceId: "public-post",
  text: "Forged private text",
  language: "en",
  consent: true,
  syntheticOnly: true,
} as const;
beforeEach(() => {
  mocks.account
    .mockReset()
    .mockResolvedValue({ profile: { id: "actor", onboarded: true } });
  mocks.content.mockReset().mockResolvedValue([
    {
      post: {
        id: "public-post",
        audience: "public",
        text: "Authoritative public text",
      },
    },
  ]);
  mocks.generate.mockReset().mockResolvedValue({
    ok: false,
    error: { code: "unavailable", message: "Provider unavailable" },
  });
  mocks.execute.mockReset();
  mocks.refresh.mockReset();
});
describe("Server assistance privacy and failure boundaries", () => {
  it("derives public source text server-side rather than trusting client text", async () => {
    await requestAssistance(request);
    expect(mocks.generate).toHaveBeenCalledWith({
      ...request,
      text: "Authoritative public text",
    });
  });
  it("rejects private, revoked or missing source access without contacting the provider", async () => {
    mocks.content.mockResolvedValue([
      { post: { id: "public-post", audience: "friends", text: "Private" } },
    ]);
    const r = await requestAssistance(request);
    expect(r.ok).toBe(false);
    expect(mocks.generate).not.toHaveBeenCalled();
    mocks.content.mockResolvedValue([]);
    expect((await requestAssistance(request)).ok).toBe(false);
  });
  it("rechecks session and consent on every assistance request", async () => {
    mocks.account.mockResolvedValue(null);
    expect((await requestAssistance(request)).ok).toBe(false);
    expect(mocks.generate).not.toHaveBeenCalled();
    mocks.account.mockResolvedValue({
      profile: { id: "actor", onboarded: true },
    });
    expect((await requestAssistance({ ...request, consent: false })).ok).toBe(
      false,
    );
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("handles provider failure without output, logging or automatic retries", async () => {
    mocks.generate.mockRejectedValue(new Error("Provider unavailable"));
    const r = await requestAssistance(request);
    expect(r.ok).toBe(false);
    expect(r).not.toHaveProperty("data");
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
  it("rejects injected actor and missing confirmation before mutation", async () => {
    const command = {
      operation: "assistant-draft",
      text: "Manual synthetic draft",
      syntheticOnly: true,
      confirmed: true,
    };
    expect(
      (await advancedAction({ ...command, actorId: "other" }, "request-1")).ok,
    ).toBe(false);
    expect(
      (await advancedAction({ ...command, confirmed: false }, "request-2")).ok,
    ).toBe(false);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
