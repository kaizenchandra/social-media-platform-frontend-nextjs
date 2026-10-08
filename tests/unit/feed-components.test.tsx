import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EngagementControls } from "@/features/feed/engagement-controls";
import { FeedFeedback } from "@/features/feed/feedback";
import { CommentThread } from "@/features/feed/comments";
import { PostTools } from "@/features/feed/post-tools";
import type { FeedPost, FeedOutcome } from "@/features/feed/contracts";
const action = vi.hoisted(() => ({ mutate: vi.fn(), refresh: vi.fn() }));
vi.mock("@/features/feed/actions", () => ({ mutateFeed: action.mutate }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: action.refresh }),
}));
const post: FeedPost = {
  id: "preview-public",
  title: "Preview post",
  text: "Synthetic",
  audience: "public",
  date: "2026-10-01",
  author: {
    id: "preview",
    username: "preview",
    displayName: "Preview author",
    avatar: "coast",
  },
  relationship: {
    kind: "visitor",
    request: "none",
    following: false,
    followedBy: false,
    favorite: false,
    restricted: false,
    blockedByMe: false,
    version: 0,
  },
  engagement: {
    reaction: null,
    reactions: 0,
    saved: false,
    reposted: false,
    comments: 0,
    version: 0,
  },
  repostedBy: [],
  explanation: "Public preview",
};
describe("Feed interaction feedback", () => {
  it("prevents duplicate reactions, rolls back failure and retries with the same request ID", async () => {
    let resolve!: (value: FeedOutcome) => void;
    action.mutate.mockReset().mockReturnValue(
      new Promise<FeedOutcome>((done) => {
        resolve = done;
      }),
    );
    render(
      <FeedFeedback>
        <EngagementControls post={post} />
      </FeedFeedback>,
    );
    const user = userEvent.setup(),
      like = screen.getByRole("button", { name: "Like" });
    await waitFor(() => expect(like).toBeEnabled());
    await user.dblClick(like);
    expect(action.mutate).toHaveBeenCalledTimes(1);
    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(like).toBeDisabled();
    expect(screen.getByText("1 reaction · confirming")).toBeInTheDocument();
    const requestId = action.mutate.mock.calls[0][1];
    resolve({
      ok: false,
      error: { code: "network", message: "Synthetic failure", retryable: true },
    });
    await screen.findByText("Synthetic failure");
    await waitFor(() => expect(like).toBeEnabled());
    expect(like).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("0 reactions")).toBeInTheDocument();
    action.mutate.mockResolvedValue({ ok: true, message: "Reaction updated" });
    await user.click(like);
    expect(action.mutate.mock.calls[1][1]).toBe(requestId);
  });
  it("uses reconciled server state and explains disabled private reposting", async () => {
    action.mutate.mockReset().mockResolvedValue({ ok: true, message: "Saved" });
    const { rerender } = render(<EngagementControls post={post} />);
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.queryByRole("button", { name: "Unsave" }),
    ).not.toBeInTheDocument();
    rerender(
      <EngagementControls
        post={{
          ...post,
          audience: "private",
          engagement: { ...post.engagement, saved: true, version: 1 },
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Unsave" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Repost" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Repost" }),
    ).toHaveAccessibleDescription(/only for public posts/);
  });
  it("focuses comment validation, preserves failed drafts and retries without duplication", async () => {
    action.mutate.mockReset().mockResolvedValue({
      ok: false,
      error: {
        code: "network",
        message: "Draft not confirmed",
        retryable: true,
      },
    });
    render(<CommentThread postId={post.id} comments={[]} />);
    const user = userEvent.setup(),
      input = screen.getByLabelText("Comment");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Send comment" }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Send comment" }));
    expect(action.mutate).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveFocus();
    await user.type(input, "Synthetic draft");
    await user.click(screen.getByRole("button", { name: "Send comment" }));
    await screen.findByText("Draft not confirmed");
    expect(input).toHaveValue("Synthetic draft");
    const id = action.mutate.mock.calls[0][1];
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(action.mutate.mock.calls[1][1]).toBe(id);
  });
  it("validates the report entry point without offering a real submission", async () => {
    action.mutate.mockReset().mockResolvedValue({
      ok: true,
      message: "Nothing was sent to reviewers.",
    });
    render(<PostTools post={post} />);
    const user = userEvent.setup(),
      report = screen.getByRole("button", { name: "Report post" });
    await waitFor(() => expect(report).toBeEnabled());
    await user.click(report);
    expect(
      screen.getByRole("button", { name: "Send report (service unavailable)" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Prepare preview draft" }),
    );
    expect(action.mutate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Report reason")).toHaveFocus();
    await user.selectOptions(screen.getByLabelText("Report reason"), "privacy");
    await user.click(
      screen.getByRole("button", { name: "Prepare preview draft" }),
    );
    await screen.findByText("Nothing was sent to reviewers.");
  });
  it("falls back to focused manual copying without disclosing a post body", async () => {
    action.mutate.mockReset().mockResolvedValue({
      ok: true,
      message: "Link",
      sharePath: `/posts/${post.id}`,
    });
    render(<PostTools post={post} />);
    const user = userEvent.setup(),
      share = screen.getByRole("button", { name: "Share post" });
    await waitFor(() => expect(share).toBeEnabled());
    await user.click(share);
    const input = await screen.findByLabelText("Post link");
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(
      new Error("Unavailable"),
    );
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    await screen.findByText(
      "Copy is unavailable. Select and copy the link below.",
    );
    expect(input).toHaveFocus();
    expect((input as HTMLInputElement).value).toContain(`/posts/${post.id}`);
    expect((input as HTMLInputElement).selectionEnd).toBe(
      (input as HTMLInputElement).value.length,
    );
  });
});
