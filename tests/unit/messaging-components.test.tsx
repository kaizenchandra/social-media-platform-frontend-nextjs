import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessagingView } from "@/features/messaging/messaging-view";
describe("Personal messaging UI", () => {
  it("queues offline, reconnects, deduplicates receipts and searches history", async () => {
    render(<MessagingView />);
    const user = userEvent.setup();
    fireEvent.change(screen.getByLabelText("Connection"), {
      target: { value: "offline" },
    });
    await user.type(
      screen.getByLabelText("Message"),
      "Synthetic queued thought",
    );
    await user.click(screen.getByRole("button", { name: "Queue locally" }));
    expect(screen.getByText("Synthetic queued thought")).toBeVisible();
    expect(screen.getByText(/UTC · queued/)).toBeVisible();
    fireEvent.change(screen.getByLabelText("Connection"), {
      target: { value: "connected" },
    });
    await waitFor(
      () => expect(screen.getByText(/UTC · delivered/)).toBeVisible(),
      { timeout: 2500 },
    );
    await user.click(
      screen.getByRole("button", { name: "Repeat acknowledgment" }),
    );
    expect(screen.getAllByText("Synthetic queued thought")).toHaveLength(1);
    await user.type(
      screen.getByLabelText("Search this chat"),
      "queued thought",
    );
    expect(screen.queryByText("Perfect. Let's meet at 10 ☕")).toBeNull();
  });
  it("shows failure, manual retry and blocks the composer on permission changes", async () => {
    render(<MessagingView />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Fail simulated sends"));
    await user.type(screen.getByLabelText("Message"), "Retry me");
    await user.click(screen.getByRole("button", { name: "Send locally" }));
    const retry = await screen.findByRole(
      "button",
      { name: "Retry (1/3)" },
      { timeout: 2500 },
    );
    await user.click(screen.getByRole("button", { name: "Revoke permission" }));
    expect(retry).toBeDisabled();
    expect(screen.getByLabelText("Message")).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Restore permission" }),
    );
    await user.click(screen.getByLabelText("Fail simulated sends"));
    await user.click(retry);
    await waitFor(
      () => expect(screen.getByText(/Retried · delivered/)).toBeVisible(),
      { timeout: 2500 },
    );
    expect(screen.getAllByText("Retry me")).toHaveLength(1);
  });
  it("accepts requests, filters inbox and discloses unavailable reporting", async () => {
    render(<MessagingView />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Requests" }));
    await user.click(screen.getByRole("button", { name: /Sam Rivera/ }));
    expect(screen.getByLabelText("Message")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Accept request" }));
    expect(screen.getByLabelText("Message")).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Report" }));
    expect(screen.getByText(/No report has been submitted/)).toBeVisible();
    await user.type(screen.getByLabelText("Search conversations"), "Nobody");
    expect(screen.getByText("No conversations found.")).toBeVisible();
  });
});
