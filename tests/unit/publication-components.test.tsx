import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer } from "@/features/publication/composer";
import { RichTextPreview } from "@/features/publication/rich-text";
import { PublicationStatus } from "@/features/publication/status";
import { AppealEntry } from "@/features/publication/support";
import type {
  Publication,
  PublicationResult,
} from "@/features/publication/contracts";
const action = vi.hoisted(() => ({ mutate: vi.fn(), read: vi.fn() }));
vi.mock("@/features/publication/actions", () => ({
  mutatePublication: action.mutate,
  readPublication: action.read,
}));
const snapshot: Publication = {
  id: "ce093acb-08bb-4d65-a37f-76d44d75b657",
  version: 1,
  state: "DRAFT",
  mode: "simulated",
  draft: {
    text: "Synthetic thought",
    audience: "private",
    disclosure: "not-declared",
    scenario: "low-risk",
    syntheticOnly: true,
    media: [],
  },
  progress: 0,
  attempt: 0,
  updatedAt: "2026-10-08T00:00:00.000Z",
  targetAt: null,
  decision: null,
  retryable: false,
  explanation: "Private draft saved",
  distributionEnabled: false,
};
describe("Composer and safety interfaces", () => {
  it("retries an unconfirmed workflow start without resaving or changing its request ID", async () => {
    action.mutate
      .mockReset()
      .mockResolvedValueOnce({ ok: true, item: snapshot })
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: "network",
          message: "Start not confirmed",
          retryable: true,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        item: {
          ...snapshot,
          version: 3,
          state: "CANCELLED",
          explanation: "Latest server state is cancelled",
        },
      });
    render(<Composer />);
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByLabelText("Post text")).toBeEnabled(),
    );
    await user.type(screen.getByLabelText("Post text"), "Synthetic thought");
    await user.click(
      screen.getByLabelText("I am using only benign synthetic text and media."),
    );
    await user.click(
      screen.getByRole("button", { name: "Start simulated upload" }),
    );
    await screen.findByText("Start not confirmed");
    expect(screen.getByLabelText("Post text")).toBeDisabled();
    const request = action.mutate.mock.calls[1][1];
    await user.click(
      screen.getByRole("button", { name: "Retry draft action" }),
    );
    await screen.findByText("Simulated CANCELLED");
    expect(action.mutate.mock.calls.map((call) => call[0].operation)).toEqual([
      "save",
      "begin",
      "begin",
    ]);
    expect(action.mutate.mock.calls[2][1]).toBe(request);
  });
  it("renders safe formatting while keeping HTML and links inert", () => {
    const { container } = render(
      <RichTextPreview
        text={
          "**Bold text** *Soft text*\n- List text\n<script>alert(1)</script> https://example.test"
        }
      />,
    );
    expect(container.querySelector("strong")).toHaveTextContent("Bold text");
    expect(container.querySelector("em")).toHaveTextContent("Soft text");
    expect(screen.getByRole("listitem")).toHaveTextContent("List text");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
  });
  it("focuses validation and preserves failed draft text with stable retry identity", async () => {
    action.mutate.mockReset().mockResolvedValue({
      ok: false,
      error: {
        code: "network",
        message: "Unconfirmed draft",
        retryable: true,
      },
    });
    render(<Composer />);
    const user = userEvent.setup(),
      save = screen.getByRole("button", { name: "Save private draft" });
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);
    expect(action.mutate).not.toHaveBeenCalled();
    expect(
      screen.getByLabelText("I am using only benign synthetic text and media."),
    ).toHaveFocus();
    await user.click(
      screen.getByLabelText("I am using only benign synthetic text and media."),
    );
    await user.click(save);
    expect(screen.getByLabelText("Post text")).toHaveFocus();
    await user.type(screen.getByLabelText("Post text"), "A synthetic thought");
    await user.click(save);
    await screen.findByText("Unconfirmed draft");
    expect(screen.getByLabelText("Post text")).toHaveValue(
      "A synthetic thought",
    );
    const id = action.mutate.mock.calls[0][1];
    await user.click(
      screen.getByRole("button", { name: "Retry draft action" }),
    );
    expect(action.mutate.mock.calls[1][1]).toBe(id);
  });
  it("keeps attachment bytes local, prevents duplicate saves and revokes removed previews", async () => {
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:local-preview"),
        revokeObjectURL: vi.fn(),
      }),
    );
    let resolve!: (value: PublicationResult) => void;
    action.mutate.mockReset().mockReturnValue(
      new Promise<PublicationResult>((done) => {
        resolve = done;
      }),
    );
    render(<Composer />);
    const user = userEvent.setup(),
      file = new File(["synthetic"], "preview.png", { type: "image/png" });
    await waitFor(() =>
      expect(screen.getByLabelText("Image or video attachments")).toBeEnabled(),
    );
    await user.upload(
      screen.getByLabelText("Image or video attachments"),
      file,
    );
    await user.type(
      screen.getByLabelText("Image description 1"),
      "Synthetic landscape",
    );
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("Local preview unavailable")).toBeVisible();
    await user.upload(
      screen.getByLabelText("Image or video attachments"),
      new File(["synthetic video"], "preview.webm", { type: "video/webm" }),
    );
    const video = document.querySelector("video")!;
    expect(screen.getByText("Loading local video preview…")).toBeVisible();
    fireEvent.error(video);
    expect(screen.getAllByText("Local preview unavailable")).toHaveLength(2);
    await user.click(
      screen.getByLabelText("I am using only benign synthetic text and media."),
    );
    await user.dblClick(
      screen.getByRole("button", { name: "Save private draft" }),
    );
    expect(action.mutate).toHaveBeenCalledTimes(1);
    expect(action.mutate.mock.calls[0][0].draft.media[0]).toEqual({
      name: "preview.png",
      type: "image/png",
      size: 9,
      alt: "Synthetic landscape",
    });
    expect(JSON.stringify(action.mutate.mock.calls[0][0])).not.toContain(
      "blob:",
    );
    resolve({ ok: true, item: snapshot });
    await screen.findByText("Private draft saved");
    await user.click(
      screen.getByRole("button", { name: "Remove attachment 1" }),
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-preview");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
  it("requires restored draft files to be reselected before starting", async () => {
    action.mutate.mockReset();
    render(
      <Composer
        initial={{
          ...snapshot,
          draft: {
            ...snapshot.draft,
            media: [
              {
                name: "preview.png",
                type: "image/png",
                size: 9,
                alt: "Synthetic image",
              },
            ],
          },
        }}
      />,
    );
    const user = userEvent.setup();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Start simulated upload" }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole("button", { name: "Start simulated upload" }),
    );
    await screen.findByText(
      /Reselect the draft's files or remove unavailable attachments/,
    );
    expect(action.mutate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Image or video attachments")).toHaveFocus();
  });
  it("keeps overdue review and simulated approval non-public, without moderation timers", async () => {
    action.mutate.mockReset();
    const { rerender } = render(
      <PublicationStatus
        initial={{
          ...snapshot,
          state: "REVIEW_REQUIRED",
          targetAt: "2020-01-01T00:00:00.000Z",
          explanation: "Overdue simulated review",
        }}
        continuePreview
      />,
    );
    const user = userEvent.setup();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh status" }),
      ).toBeEnabled(),
    );
    expect(
      screen.getByRole("button", { name: "Publish (backend unavailable)" }),
    ).toBeDisabled();
    expect(action.mutate).not.toHaveBeenCalled();
    rerender(
      <PublicationStatus
        key="approved"
        initial={{
          ...snapshot,
          state: "APPROVED",
          explanation: "Simulated approval only",
          decision: {
            id: "simulated",
            source: "simulation",
            reason: "fixture",
            appealEligible: false,
          },
        }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Publish (backend unavailable)" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Publish (backend unavailable)" }),
    );
    expect(action.mutate).not.toHaveBeenCalled();
  });
  it("validates appeal notes locally and never sends a case or changes a decision", async () => {
    action.mutate.mockReset();
    render(<AppealEntry />);
    const user = userEvent.setup();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Prepare local appeal note" }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole("button", { name: "Prepare local appeal note" }),
    );
    expect(screen.getByLabelText("Why would you appeal?")).toHaveFocus();
    await user.type(
      screen.getByLabelText("Why would you appeal?"),
      "Synthetic disagreement with the fixture reason.",
    );
    await user.click(
      screen.getByRole("button", { name: "Prepare local appeal note" }),
    );
    await screen.findByText(/Local appeal note prepared. Nothing was sent/);
    expect(
      screen.getByRole("button", { name: "Send appeal (service unavailable)" }),
    ).toBeDisabled();
    expect(action.mutate).not.toHaveBeenCalled();
  });
});
