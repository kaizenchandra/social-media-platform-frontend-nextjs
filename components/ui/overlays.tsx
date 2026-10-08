"use client";
import type { ReactNode, ReactElement } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { cx, IconButton } from "./primitives";

export function Dialog({
  trigger,
  title,
  description,
  children,
  open,
  onOpenChange,
  variant = "dialog",
  onCloseAutoFocus,
}: {
  trigger: ReactElement;
  title: string;
  description: string;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: "dialog" | "sheet";
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="overlay" />
        <DialogPrimitive.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className={cx(
            "dialog-content",
            variant === "sheet" && "sheet-content",
          )}
        >
          <div className="dialog-heading">
            <DialogPrimitive.Title className="section-title">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton label="Close dialog">
                <X size={20} aria-hidden="true" />
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="muted dialog-description">
            {description}
          </DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function Sheet(props: Omit<Parameters<typeof Dialog>[0], "variant">) {
  return <Dialog {...props} variant="sheet" />;
}
export function DropdownMenu({
  trigger,
  label,
  items,
}: {
  trigger: ReactElement;
  label: string;
  items: { label: string; onSelect: () => void; disabled?: boolean }[];
}) {
  return (
    <DropdownPrimitive.Root>
      <DropdownPrimitive.Trigger asChild>{trigger}</DropdownPrimitive.Trigger>
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content
          className="dropdown"
          sideOffset={8}
          aria-label={label}
        >
          {items.map((item) => (
            <DropdownPrimitive.Item
              key={item.label}
              className="dropdown-item"
              onSelect={item.onSelect}
              disabled={item.disabled}
            >
              {item.label}
            </DropdownPrimitive.Item>
          ))}
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  );
}
export function Tabs({
  label,
  tabs,
  defaultValue,
}: {
  label: string;
  tabs: { value: string; label: string; content: ReactNode }[];
  defaultValue?: string;
}) {
  return (
    <TabsPrimitive.Root defaultValue={defaultValue ?? tabs[0]?.value}>
      <TabsPrimitive.List className="tabs-list" aria-label={label}>
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            className="tab"
            key={tab.value}
            value={tab.value}
          >
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tabs.map((tab) => (
        <TabsPrimitive.Content
          className="tab-panel"
          key={tab.value}
          value={tab.value}
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
export function Toast({
  open,
  onOpenChange,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <ToastPrimitive.Provider duration={7000} label="Update">
      <ToastPrimitive.Root
        open={open}
        onOpenChange={onOpenChange}
        className="toast"
      >
        <div>
          <ToastPrimitive.Title className="toast-title">
            {title}
          </ToastPrimitive.Title>
          <ToastPrimitive.Description className="muted">
            {description}
          </ToastPrimitive.Description>
        </div>
        <ToastPrimitive.Close asChild>
          <IconButton label="Dismiss notification">
            <X size={18} aria-hidden="true" />
          </IconButton>
        </ToastPrimitive.Close>
      </ToastPrimitive.Root>
      <ToastPrimitive.Viewport className="toast-viewport" />
    </ToastPrimitive.Provider>
  );
}
