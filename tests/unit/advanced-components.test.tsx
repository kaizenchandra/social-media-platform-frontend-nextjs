import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdvancedForm } from "@/features/advanced/action-form";
import { AssistantView } from "@/features/advanced/assistant-view";
import { StoryViewer } from "@/features/media/story-viewer";
import { WellbeingProvider } from "@/features/advanced/wellbeing-provider";
import { useWellbeing } from "@/features/advanced/wellbeing-context";
import { wellbeingContext } from "@/features/advanced/wellbeing-context";
import {
  defaultWellbeing,
  type AssistantResult,
} from "@/features/advanced/contracts";
import { mediaFixtures } from "@/features/media/fixtures";
const actions = vi.hoisted(() => ({
  mutate: vi.fn(),
  assist: vi.fn(),
  preferences: vi.fn(),
}));
vi.mock("@/features/advanced/actions", () => ({
  advancedAction: actions.mutate,
  requestAssistance: actions.assist,
  readWellbeing: actions.preferences,
}));
vi.mock("@/features/media/actions", () => ({
  mutateMedia: vi.fn(),
  refreshMedia: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/stories" }));
beforeEach(() => {
  actions.preferences
    .mockReset()
    .mockResolvedValue({ actorId: null, preferences: null });
  actions.mutate.mockReset().mockResolvedValue({
    ok: true,
    data: undefined,
    message: "Saved privately.",
  });
  actions.assist.mockReset().mockResolvedValue({
    ok: false,
    error: {
      code: "unavailable",
      message: "AI provider unavailable. No output was generated.",
    },
  });
});
describe("Phase 12 explicit review and failure UI", () => {
  it("does not mutate before explicit confirmation and returns focus to editable text", async () => {
    const user = userEvent.setup();
    render(
      <AdvancedForm
        review
        base={{ operation: "assistant-draft", syntheticOnly: true }}
        label="Save private draft"
      >
        <label>
          Reviewed manual text
          <textarea name="text" defaultValue="Synthetic human draft" />
        </label>
        <input type="checkbox" name="syntheticOnly" defaultChecked />
      </AdvancedForm>,
    );
    await user.click(
      screen.getByRole("button", { name: "Save private draft" }),
    );
    expect(actions.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Synthetic human draft",
    );
    await user.click(screen.getByRole("button", { name: "Back to edit" }));
    expect(actions.mutate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Save private draft" }),
    ).toHaveFocus();
    await user.click(
      screen.getByRole("button", { name: "Save private draft" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm save private draft" }),
    );
    await waitFor(() => expect(actions.mutate).toHaveBeenCalledTimes(1));
    expect(actions.mutate.mock.calls[0][0]).toMatchObject({
      confirmed: true,
      text: "Synthetic human draft",
    });
  });
  it("preserves input and reuses request identity after unconfirmed network failures", async () => {
    const user = userEvent.setup();
    actions.mutate.mockRejectedValueOnce(new Error("offline"));
    render(
      <AdvancedForm base={{ operation: "wellbeing" }} label="Save preference">
        <label>
          Test input
          <input name="text" defaultValue="Keep this input" />
        </label>
      </AdvancedForm>,
    );
    await user.click(screen.getByRole("button", { name: "Save preference" }));
    await screen.findByText(/Connection interrupted/);
    expect(screen.getByLabelText("Test input")).toHaveValue("Keep this input");
    await user.click(screen.getByRole("button", { name: "Save preference" }));
    await waitFor(() => expect(actions.mutate).toHaveBeenCalledTimes(2));
    expect(actions.mutate.mock.calls[1][1]).toBe(
      actions.mutate.mock.calls[0][1],
    );
  });
  it("shows unavailable AI without generated suggestions and keeps the manual workspace", async () => {
    const user = userEvent.setup();
    render(<AssistantView sources={[]} />);
    await user.type(
      screen.getByLabelText("Synthetic draft or caption context"),
      "Synthetic request",
    );
    await user.click(
      screen.getByLabelText("I consent to this assistance request."),
    );
    await user.click(screen.getByLabelText("I am using synthetic text only."));
    await user.click(
      screen.getByRole("button", { name: "Request assistance" }),
    );
    await screen.findByText(
      "AI provider unavailable. No output was generated.",
    );
    expect(screen.getByLabelText("Reviewed manual text")).toHaveValue("");
    await user.selectOptions(
      screen.getByLabelText("Assistance task"),
      "translation",
    );
    expect(
      screen.getByRole("button", { name: "Request assistance" }),
    ).toBeDisabled();
  });
  it("ignores late request failures after changing the selected task", async () => {
    let resolve!: (r: AssistantResult) => void;
    actions.assist.mockImplementation(
      () =>
        new Promise<AssistantResult>((r) => {
          resolve = r;
        }),
    );
    const user = userEvent.setup();
    render(<AssistantView sources={[]} />);
    await user.type(
      screen.getByLabelText("Synthetic draft or caption context"),
      "Synthetic request",
    );
    await user.click(
      screen.getByLabelText("I consent to this assistance request."),
    );
    await user.click(screen.getByLabelText("I am using synthetic text only."));
    await user.click(
      screen.getByRole("button", { name: "Request assistance" }),
    );
    await user.selectOptions(
      screen.getByLabelText("Assistance task"),
      "caption",
    );
    resolve({
      ok: false,
      error: { code: "network", message: "Stale request failure" },
    });
    await waitFor(() =>
      expect(
        screen.queryByText("Stale request failure"),
      ).not.toBeInTheDocument(),
    );
  });
  it("requires opted-in automatic next-story behavior and always starts paused", () => {
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const item = mediaFixtures(Date.now()).find(
      (i) =>
        i.kind === "story" &&
        i.asset === "video" &&
        i.publication === "FIXTURE",
    )!;
    const entry = { ...item, saved: false, highlighted: false, reaction: null },
      navigate = vi.fn(),
      close = vi.fn();
    const view = (autoplay: boolean) => (
      <wellbeingContext.Provider value={{ ...defaultWellbeing, autoplay }}>
        <StoryViewer
          items={[entry, { ...entry, id: "second-story" }]}
          index={0}
          onNavigate={navigate}
          onClose={close}
          actorId="actor"
          onUpdate={() => {}}
          onDenied={() => {}}
        />
      </wellbeingContext.Provider>
    );
    const { rerender } = render(view(false));
    expect(document.querySelector("video")?.autoplay).toBe(false);
    fireEvent.ended(document.querySelector("video")!);
    expect(navigate).not.toHaveBeenCalled();
    rerender(view(true));
    fireEvent.ended(document.querySelector("video")!);
    expect(navigate).toHaveBeenCalledWith(1);
  });
});

function PreferenceProbe() {
  const p = useWellbeing();
  return <p>Autoplay {p.autoplay ? "allowed" : "disabled"}</p>;
}
describe("Document well-being permission and timer behavior", () => {
  it("refreshes authenticated preferences and fails closed on a failed focus check", async () => {
    actions.preferences
      .mockResolvedValueOnce({
        actorId: "actor",
        preferences: { ...defaultWellbeing, version: 1, autoplay: true },
      })
      .mockResolvedValueOnce({ actorId: null, preferences: null });
    render(
      <WellbeingProvider>
        <PreferenceProbe />
      </WellbeingProvider>,
    );
    await screen.findByText("Autoplay allowed");
    fireEvent.focus(window);
    await screen.findByText("Autoplay disabled");
  });
  it("counts only opted-in focused time and allows dismissing a reminder", async () => {
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockImplementation(() => Date.now());
    const focus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
    actions.preferences.mockResolvedValue({
      actorId: "actor",
      preferences: { ...defaultWellbeing, screenTimeReminder: 1 },
    });
    try {
      render(
        <WellbeingProvider>
          <p>Current document</p>
        </WellbeingProvider>,
      );
      await act(async () => {});
      await act(async () => {
        vi.advanceTimersByTime(60000);
      });
      expect(
        screen.queryByRole("region", { name: "Screen-time reminder" }),
      ).not.toBeInTheDocument();
      focus.mockReturnValue(true);
      await act(async () => {
        vi.advanceTimersByTime(60000);
      });
      expect(
        screen.getByRole("region", { name: "Screen-time reminder" }),
      ).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Dismiss reminder" }));
      expect(
        screen.queryByRole("region", { name: "Screen-time reminder" }),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
