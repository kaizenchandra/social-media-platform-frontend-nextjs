import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, Progress, ErrorState } from "@/components/ui/primitives";
import { Input, Select, Switch } from "@/components/ui/forms";
import { Avatar } from "@/components/ui/avatar";
import { Tabs } from "@/components/ui/overlays";
import { ComponentLibrary } from "@/components/design-system/component-library";
import { ThemeControl } from "@/components/shell/theme-control";

describe("Design system behavior", () => {
  it("prevents a pending button from activating", async () => {
    const action = vi.fn();
    render(
      <Button pending onClick={action}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });
  it("links labels, hints and errors to form controls", () => {
    render(
      <>
        <Input label="Name" hint="A helpful hint" error="Name is required" />
        <Select label="Density">
          <option>Comfortable</option>
        </Select>
      </>,
    );
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAccessibleDescription(
      "A helpful hint Name is required",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("combobox")).toHaveAccessibleName("Density");
  });
  it("supports keyboard switching with an accessible label", async () => {
    const action = vi.fn();
    render(<Switch label="Example switch" onCheckedChange={action} />);
    await userEvent.tab();
    await userEvent.keyboard(" ");
    expect(action).toHaveBeenCalledWith(true);
  });
  it("connects tabs to their panels and supports arrow navigation", async () => {
    render(
      <Tabs
        label="Sections"
        tabs={[
          { value: "one", label: "One", content: "First panel" },
          { value: "two", label: "Two", content: "Second panel" },
        ]}
      />,
    );
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Two");
  });
  it("retains accessible initials if an avatar image fails", () => {
    render(<Avatar name="Alex Morgan" src="/missing-avatar.png" />);
    fireEvent.error(document.querySelector("img")!);
    expect(screen.getByRole("img", { name: "Alex Morgan" })).toHaveTextContent(
      "AM",
    );
  });
  it("clamps progress and leaves pending progress indeterminate", () => {
    render(
      <>
        <Progress label="Transfer" value={140} />
        <Progress label="Pending" />
      </>,
    );
    expect(
      screen.getByRole("progressbar", { name: "Transfer" }),
    ).toHaveAttribute("value", "100");
    expect(
      screen.getByRole("progressbar", { name: "Pending" }),
    ).not.toHaveAttribute("value");
  });
  it("offers a named retry for recoverable errors", async () => {
    const retry = vi.fn();
    render(<ErrorState onRetry={retry} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it("validates the example without losing input and replaces its error state on retry", async () => {
    render(<ComponentLibrary />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Validate example" }));
    const input = screen.getByLabelText("Display name example");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-invalid", "true");
    await user.type(input, "Alex");
    await user.click(screen.getByRole("button", { name: "Validate example" }));
    expect(input).toHaveValue("Alex");
    expect(input).not.toHaveAttribute("aria-invalid", "true");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Example recovered")).toBeInTheDocument();
  });
  it("updates the theme from another tab and when storage is cleared", () => {
    render(<ThemeControl />);
    fireEvent(
      window,
      new StorageEvent("storage", { key: "common.theme", newValue: "dark" }),
    );
    expect(
      screen.getByRole("button", { name: "Appearance: dark" }),
    ).toBeInTheDocument();
    fireEvent(
      window,
      new StorageEvent("storage", { key: null, newValue: null }),
    );
    expect(
      screen.getByRole("button", { name: "Appearance: system" }),
    ).toBeInTheDocument();
  });
});
