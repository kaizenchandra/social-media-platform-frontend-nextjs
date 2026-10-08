import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroupView } from "@/features/groups/group-view";
describe("Group messaging interfaces", () => {
  it("retains failed drafts, mentions and threads then hides everything on removal", async () => {
    render(<GroupView />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Group message"), "Synthetic retry");
    await user.click(screen.getByLabelText("Simulate failed send"));
    await user.click(
      screen.getByRole("button", { name: "Send to group locally" }),
    );
    expect(screen.getByText(/Simulated send failed/)).toBeVisible();
    expect(screen.getByLabelText("Group message")).toHaveValue(
      "Synthetic retry",
    );
    await user.click(screen.getByLabelText("Simulate failed send"));
    await user.click(
      screen.getByRole("button", { name: "Send to group locally" }),
    );
    expect(screen.getAllByText("Synthetic retry")).toHaveLength(1);
    await user.click(screen.getAllByRole("button", { name: "Thread (0)" })[0]);
    await user.type(
      screen.getByLabelText("Thread reply"),
      "Synthetic threaded response",
    );
    fireEvent.change(screen.getByLabelText("Mention member"), {
      target: { value: "maya" },
    });
    await user.click(screen.getByRole("button", { name: "Reply locally" }));
    expect(
      screen.getByText(/Synthetic threaded response @Maya Chen/),
    ).toBeVisible();
    await user.type(
      screen.getByLabelText("Thread reply"),
      "Unsent secret draft",
    );
    await user.click(
      screen.getByRole("button", { name: "Simulate removal by Maya" }),
    );
    expect(screen.getByText(/You were removed/)).toBeVisible();
    expect(screen.queryByLabelText("Thread reply")).toBeNull();
    expect(screen.queryByText("Synthetic retry")).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Group sections" }),
    ).toBeNull();
  });
  it("handles failed invitations and consent before revealing newly shared content", async () => {
    render(<GroupView />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Members" }));
    await user.click(screen.getByLabelText("Simulate failed invitation"));
    await user.click(screen.getByRole("button", { name: "Invite locally" }));
    expect(screen.getByText(/Simulated invitation failed/)).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Retry invitation to Noah Ellis" }),
    );
    fireEvent.change(screen.getByLabelText("Preview participant"), {
      target: { value: "noah" },
    });
    expect(screen.queryByText(/Welcome! Let's plan/)).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Accept local invitation" }),
    );
    expect(
      screen.getByText("No accessible messages in this view."),
    ).toBeVisible();
    await user.type(
      screen.getByLabelText("Group message"),
      "New member content",
    );
    await user.click(
      screen.getByRole("button", { name: "Send to group locally" }),
    );
    expect(screen.getByText("New member content")).toBeVisible();
  });
  it("restricts admin controls and announcements for ordinary members", async () => {
    render(<GroupView />);
    const user = userEvent.setup();
    fireEvent.change(screen.getByLabelText("Preview participant"), {
      target: { value: "leo" },
    });
    fireEvent.change(screen.getByLabelText("Conversation topic"), {
      target: { value: "announcements" },
    });
    expect(screen.getByLabelText("Group message")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Members" }));
    expect(
      screen.getByRole("button", { name: "Remove Maya Chen" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Invite locally" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(
      screen.getByRole("button", { name: "Save permissions locally" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Prepare report note" }),
    );
    await user.type(
      screen.getByLabelText("Group report reason"),
      "Synthetic concern",
    );
    await user.click(
      screen.getByRole("button", { name: "Prepare unsent note" }),
    );
    expect(screen.getByText(/No report was submitted/)).toBeVisible();
  });
  it("creates groups, polls and shared tasks with active assignees", async () => {
    render(<GroupView />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Create group" }));
    await user.type(screen.getByLabelText("New group name"), "Synthetic team");
    await user.click(screen.getByRole("button", { name: "Create locally" }));
    expect(
      screen.getByRole("heading", { name: "Synthetic team" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Polls" }));
    await user.type(screen.getByLabelText("Poll question"), "Meet where?");
    await user.type(screen.getByLabelText("Poll options"), "Garden\nCafe");
    await user.click(
      screen.getByRole("button", { name: "Create poll locally" }),
    );
    const poll = screen.getByRole("region", { name: "Meet where?" });
    await user.click(
      within(poll).getByRole("button", { name: "Garden · 0 votes" }),
    );
    expect(
      within(poll).getByRole("button", { name: "Garden · 1 votes" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Collaboration" }));
    fireEvent.change(screen.getByLabelText("Shared item type"), {
      target: { value: "task" },
    });
    await user.type(
      screen.getByLabelText("Shared item title"),
      "Bring supplies",
    );
    fireEvent.change(screen.getByLabelText("Task assignee"), {
      target: { value: "self" },
    });
    await user.click(
      screen.getByRole("button", { name: "Add shared item locally" }),
    );
    expect(screen.getByText("Assigned to You")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Mark complete" }));
    expect(
      screen.getByRole("button", { name: "Mark incomplete" }),
    ).toBeVisible();
  });
  it("previews shared files and revokes unsent object URLs on removal", async () => {
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:group-file");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    render(<GroupView />);
    const user = userEvent.setup();
    await user.upload(
      screen.getByLabelText("Group attachments"),
      new File(["Synthetic"], "plan.txt", { type: "text/plain" }),
    );
    expect(create).toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Simulate removal by Maya" }),
    );
    expect(revoke).toHaveBeenCalledWith("blob:group-file");
    expect(screen.queryByText(/Download local file/)).toBeNull();
    create.mockRestore();
    revoke.mockRestore();
  });
});
