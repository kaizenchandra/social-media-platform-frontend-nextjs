import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthForm } from "@/features/auth/auth-form";
import type { AuthOutcome } from "@/features/auth/contracts";
const actions = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("@/features/auth/actions", () => ({ submitAuth: actions.submit }));

describe("Accessible authentication interactions", () => {
  it("disables authentication and passkeys without a connected adapter", () => {
    render(<AuthForm kind="login" available={false} />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    expect(screen.getByLabelText("Email address or username")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Sign in with a passkey" }),
    ).toHaveAccessibleDescription(/configured WebAuthn provider/);
  });
  it("links validation errors and focuses the first invalid field without a request", async () => {
    actions.submit.mockClear();
    render(<AuthForm kind="login" available />);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(actions.submit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Email address or username")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Email address or username")).toHaveFocus(),
    );
  });
  it("prevents duplicate submissions and preserves inputs after network failure", async () => {
    let resolve!: (outcome: AuthOutcome) => void;
    actions.submit.mockClear().mockReturnValue(
      new Promise<AuthOutcome>((done) => {
        resolve = done;
      }),
    );
    render(<AuthForm kind="login" available />);
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("Email address or username"),
      "offline@example.test",
    );
    await user.type(
      screen.getByLabelText("Password", { exact: true }),
      "Preview-only-42!",
    );
    const submit = screen.getByRole("button", { name: "Sign in" });
    await user.dblClick(submit);
    expect(actions.submit).toHaveBeenCalledTimes(1);
    expect(submit).toBeDisabled();
    resolve({
      ok: false,
      error: {
        code: "network",
        message: "Connection interrupted",
        retryable: true,
      },
    });
    await screen.findByText("Connection interrupted");
    expect(screen.getByLabelText("Email address or username")).toHaveValue(
      "offline@example.test",
    );
    expect(screen.getByLabelText("Password", { exact: true })).toHaveValue(
      "Preview-only-42!",
    );
    expect(submit).toBeEnabled();
    const requestId = actions.submit.mock.calls[0][1];
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(actions.submit).toHaveBeenCalledTimes(2);
    expect(actions.submit.mock.calls[1][1]).toBe(requestId);
  });
});
