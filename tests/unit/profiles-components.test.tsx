import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectionActions } from "@/features/profiles/connection-actions";
import { ProfileEditor } from "@/features/profiles/profile-editor";
import { OperationFeedback } from "@/features/profiles/operation-feedback";
import type {
  ProfileView,
  ProfileOutcome,
  Relationship,
} from "@/features/profiles/contracts";
const action = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@/features/profiles/actions", () => ({
  mutateProfile: action.mutate,
}));
const relationship: Relationship = {
  kind: "visitor",
  request: "none",
  following: false,
  followedBy: false,
  favorite: false,
  restricted: false,
  blockedByMe: false,
  version: 0,
};
const own: ProfileView = {
  kind: "visible",
  person: {
    id: "own",
    username: "own",
    displayName: "Synthetic owner",
    avatar: "coast",
  },
  bio: "A sample",
  cover: "studio",
  version: "1:1",
  relationship: { ...relationship, kind: "owner" },
  canAct: false,
  details: { location: "", work: "", website: "" },
  settings: {
    visibility: "public",
    detailsAudience: "friends",
    connectionsAudience: "friends",
  },
  posts: [],
  featured: [],
  media: [],
  connections: null,
};
describe("Profile interactions", () => {
  it("renders correct owner, friend, request and blocked controls", () => {
    const { rerender } = render(
      <ConnectionActions
        targetId="target"
        name="Synthetic"
        relationship={relationship}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Add friend" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Accept" }),
    ).not.toBeInTheDocument();
    rerender(
      <ConnectionActions
        targetId="target"
        name="Synthetic"
        relationship={{ ...relationship, request: "incoming" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    rerender(
      <ConnectionActions
        targetId="target"
        name="Synthetic"
        relationship={{ ...relationship, request: "outgoing" }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Cancel request" }),
    ).toBeInTheDocument();
    rerender(
      <ConnectionActions
        targetId="target"
        name="Synthetic"
        relationship={{ ...relationship, kind: "friend" }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Unfriend" }),
    ).toBeInTheDocument();
    rerender(
      <ConnectionActions
        targetId="target"
        name="Synthetic"
        relationship={{ ...relationship, kind: "blocked", blockedByMe: true }}
      />,
    );
    expect(screen.getByRole("button", { name: "Unblock" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Follow" }),
    ).not.toBeInTheDocument();
    rerender(
      <ConnectionActions
        targetId="target"
        name="Synthetic"
        relationship={{ ...relationship, kind: "owner" }}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("prevents repeated mutations, announces failures, and retains the connection state", async () => {
    let resolve!: (value: ProfileOutcome) => void;
    action.mutate.mockReset().mockReturnValue(
      new Promise<ProfileOutcome>((done) => {
        resolve = done;
      }),
    );
    render(
      <OperationFeedback>
        <ConnectionActions
          targetId="target"
          name="Synthetic"
          relationship={relationship}
        />
      </OperationFeedback>,
    );
    const user = userEvent.setup();
    const follow = screen.getByRole("button", { name: "Follow" });
    await waitFor(() => expect(follow).toBeEnabled());
    await user.dblClick(follow);
    expect(action.mutate).toHaveBeenCalledTimes(1);
    expect(follow).toBeDisabled();
    resolve({
      ok: false,
      error: {
        code: "network",
        message: "Network interrupted",
        retryable: true,
      },
    });
    await screen.findAllByText("Network interrupted");
    expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unfollow" }),
    ).not.toBeInTheDocument();
  });
  it("requires explicit destructive confirmation and restores keyboard focus", async () => {
    action.mutate.mockReset();
    render(
      <ConnectionActions
        targetId="target"
        name="Synthetic"
        relationship={relationship}
      />,
    );
    const user = userEvent.setup();
    const block = screen.getByRole("button", { name: "Block" });
    await waitFor(() => expect(block).toBeEnabled());
    await user.click(block);
    expect(
      screen.getByRole("dialog", { name: "Block Synthetic?" }),
    ).toHaveAccessibleDescription(/removes friendship/);
    expect(action.mutate).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(block).toHaveFocus());
  });
  it("keeps editor owner-only, focuses validation errors and preserves drafts after network failure for retry", async () => {
    action.mutate.mockReset();
    const { rerender } = render(
      <ProfileEditor profile={{ ...own, relationship }} />,
    );
    expect(
      screen.queryByRole("button", { name: "Edit profile" }),
    ).not.toBeInTheDocument();
    rerender(<ProfileEditor profile={own} />);
    const user = userEvent.setup();
    const edit = screen.getByRole("button", { name: "Edit profile" });
    await waitFor(() => expect(edit).toBeEnabled());
    await user.click(edit);
    const name = screen.getByLabelText("Display name");
    await user.clear(name);
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(action.mutate).not.toHaveBeenCalled();
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAttribute("aria-invalid", "true");
    await user.type(name, "Revised synthetic");
    action.mutate.mockResolvedValue({
      ok: false,
      error: { code: "network", message: "Draft preserved", retryable: true },
    });
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await screen.findByText("Draft preserved");
    expect(name).toHaveValue("Revised synthetic");
    const id = action.mutate.mock.calls[0][1];
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(action.mutate.mock.calls[1][1]).toBe(id);
  });
});
