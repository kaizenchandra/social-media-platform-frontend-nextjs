import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MediaPlayer } from "@/features/media/player";
import { MediaExperience, LongVideoView } from "@/features/media/experience";
import { LiveView } from "@/features/media/live-view";
import { StoryViewer } from "@/features/media/story-viewer";
import { mediaFixtures } from "@/features/media/fixtures";
import { unavailableLive } from "@/features/media/policy";
import type { Catalog } from "@/features/media/contracts";
const actions = vi.hoisted(() => ({ refresh: vi.fn(), mutate: vi.fn() }));
vi.mock("@/features/media/actions", () => ({
  refreshMedia: actions.refresh,
  mutateMedia: actions.mutate,
}));
const initial: Catalog = {
  items: mediaFixtures(Date.now())
    .filter((i) => i.publication === "FIXTURE")
    .map((i) => ({
      ...i,
      saved: false,
      reaction: null,
      highlighted: i.creatorHighlight,
    })),
  mode: "fixture-preview",
  generatedAt: Date.now(),
};
const videoItem = initial.items.find((i) => i.id === "video-studio")!;
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  actions.refresh.mockReset().mockResolvedValue({ ok: true, catalog: initial });
  actions.mutate
    .mockReset()
    .mockResolvedValue({ ok: true, item: videoItem, comments: [] });
});
describe("Rich media viewers", () => {
  it("uses media events for playback, keyboard seeking/mute and loading failure/retry", async () => {
    render(
      <MediaPlayer
        src={videoItem.src}
        title={videoItem.title}
        transcript="Synthetic transcript"
        captionSrc={videoItem.captions}
      />,
    );
    const user = userEvent.setup();
    const video = document.querySelector("video")!;
    const region = screen.getByRole("region", {
      name: `Player: ${videoItem.title}`,
    });
    Object.defineProperty(video, "duration", { configurable: true, value: 6 });
    fireEvent.loadedMetadata(video);
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(video.play).toHaveBeenCalled();
    fireEvent.playing(video);
    expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
    video.currentTime = 2;
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(video.currentTime).toBe(6);
    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(video.currentTime).toBe(1);
    fireEvent.keyDown(region, { key: "m" });
    expect(video.muted).toBe(false);
    fireEvent.waiting(video);
    expect(screen.getByText("Buffering…")).toBeVisible();
    fireEvent.error(video);
    expect(screen.getByText("Media could not be loaded")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Retry media" }));
    expect(video.load).toHaveBeenCalled();
    expect(screen.getByText("Loading media…")).toBeVisible();
  });
  it("does not steal keyboard input, handles rejected playback and pauses on hidden tabs/unmount", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(
      new Error("NotAllowed"),
    );
    const { unmount } = render(
      <MediaPlayer
        src={videoItem.src}
        title="Playback test"
        transcript="Text"
      />,
    );
    const user = userEvent.setup();
    const video = document.querySelector("video")!;
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByText(/Playback did not start/)).toBeVisible();
    const range = screen.getByLabelText("Video volume");
    fireEvent.keyDown(range, { key: "m" });
    expect(video.muted).toBe(true);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    fireEvent(document, new Event("visibilitychange"));
    expect(video.pause).toHaveBeenCalled();
    unmount();
    expect(video.getAttribute("src")).toBeNull();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });
  it("supports story navigation, reactions and image-loading failures", async () => {
    const navigate = vi.fn();
    const close = vi.fn();
    const stories = initial.items.filter((i) => i.kind === "story").slice(0, 2);
    const update = vi.fn();
    render(
      <StoryViewer
        items={stories}
        index={0}
        onNavigate={navigate}
        onClose={close}
        actorId="viewer"
        onUpdate={update}
        onDenied={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    const root = screen.getByRole("region", {
      name: `Story: ${stories[0].title}`,
    });
    fireEvent.keyDown(root, { key: "ArrowRight" });
    expect(navigate).toHaveBeenCalledWith(1);
    await user.click(screen.getByRole("button", { name: "Love" }));
    expect(actions.mutate.mock.calls[0][0]).toMatchObject({
      operation: "reaction",
      id: stories[0].id,
      value: "love",
    });
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("Story image could not be loaded.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Retry story media" }));
    expect(screen.getByRole("img")).toBeVisible();
  });
  it("mounts one reel and removes sources and interactions on content restriction", async () => {
    render(<MediaExperience initial={initial} kind="reel" actorId="viewer" />);
    const user = userEvent.setup();
    expect(document.querySelectorAll("video")).toHaveLength(0);
    await user.click(
      screen.getByRole("button", { name: "Watch Six seconds of quiet" }),
    );
    expect(document.querySelectorAll("video")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Next video" }));
    expect(document.querySelectorAll("video")).toHaveLength(1);
    await user.click(
      screen.getByRole("button", { name: "Restrict selected fixture" }),
    );
    expect(document.querySelectorAll("video")).toHaveLength(0);
    expect(screen.queryByLabelText("Video comment")).toBeNull();
  });
  it("fails closed when permission refresh fails and hides saved blocked videos", async () => {
    actions.refresh.mockResolvedValue({
      ok: false,
      error: {
        code: "network",
        message: "Permission check unavailable",
        retryable: true,
      },
    });
    render(
      <LongVideoView
        initial={initial}
        itemId="video-studio"
        actorId="viewer"
        comments={[]}
      />,
    );
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Refresh media access" }),
    );
    await screen.findByText("Permission check unavailable");
    expect(document.querySelectorAll("video")).toHaveLength(0);
    expect(screen.queryByLabelText("Video comment")).toBeNull();
  });
  it("retains unconfirmed comment text and its retry request identity", async () => {
    actions.mutate
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: "network",
          message: "Unconfirmed comment",
          retryable: true,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        item: videoItem,
        comments: [
          {
            id: "c",
            authorId: "viewer",
            name: "Viewer",
            text: "Synthetic thought",
            sequence: 1,
          },
        ],
      });
    render(
      <LongVideoView
        initial={initial}
        itemId="video-studio"
        actorId="viewer"
        comments={[]}
      />,
    );
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("Video comment"),
      "Synthetic thought",
    );
    await user.click(screen.getByRole("button", { name: "Comment locally" }));
    await screen.findByText("Unconfirmed comment");
    expect(screen.getByLabelText("Video comment")).toHaveValue(
      "Synthetic thought",
    );
    const id = actions.mutate.mock.calls[0][1];
    await user.click(screen.getByRole("button", { name: "Comment locally" }));
    expect(actions.mutate.mock.calls[1][1]).toBe(id);
    expect(await screen.findByText("Synthetic thought")).toBeVisible();
  });
  it("keeps live ingest, chat and reporting disabled in every simulated connection state", async () => {
    render(<LiveView capabilities={unavailableLive} />);
    const user = userEvent.setup();
    expect(
      screen.getByRole("button", {
        name: "Start broadcast (provider unavailable)",
      }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Live UI state"), {
      target: { value: "interrupted-preview" },
    });
    expect(screen.getByText(/Simulated safety interruption/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Send live comment" }),
    ).toBeDisabled();
    await user.type(
      screen.getByLabelText("Broadcast title"),
      "Synthetic gathering",
    );
    await user.click(
      screen.getByRole("button", { name: "Prepare unsent plan" }),
    );
    expect(
      screen.getByText(
        /No eligibility check, schedule or broadcast was created/,
      ),
    ).toBeVisible();
    expect(screen.getByText(/Future video frames/)).toBeVisible();
  });
});

describe("Media lifecycle regression checks", () => {
  it("restores the source when development StrictMode replays effects", async () => {
    const { StrictMode } = await import("react");
    render(
      <StrictMode>
        <MediaPlayer
          src={videoItem.src}
          title="Strict lifecycle"
          transcript="Synthetic"
        />
      </StrictMode>,
    );
    const video = document.querySelector("video")!;
    expect(video.getAttribute("src")).toBe(videoItem.src);
    Object.defineProperty(video, "duration", { configurable: true, value: 6 });
    fireEvent.loadedMetadata(video);
    expect(screen.getByLabelText("Video position")).toBeEnabled();
  });
  it("keeps a transcript when captions fail to load", () => {
    render(
      <MediaPlayer
        src={videoItem.src}
        captionSrc={videoItem.captions}
        title="Caption failure"
        transcript="Readable fallback"
      />,
    );
    fireEvent.error(document.querySelector("track")!);
    expect(screen.getByText(/Captions unavailable/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Captions off" })).toBeDisabled();
    expect(screen.getByText("Readable fallback")).toBeInTheDocument();
  });
});
