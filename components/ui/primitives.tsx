import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  pending?: boolean;
};
export function Button({
  variant = "primary",
  pending,
  disabled,
  children,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cx("button", `button-${variant}`, className)}
    >
      {pending ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
export function IconButton({
  label,
  children,
  className,
  ...props
}: Omit<ButtonProps, "children"> & { label: string; children: ReactNode }) {
  return (
    <Button
      {...props}
      variant={props.variant ?? "ghost"}
      aria-label={label}
      className={cx("icon-button", className)}
    >
      {children}
    </Button>
  );
}
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cx("card", className)} />;
}
export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
}) {
  return <span {...props} className={cx("badge", `tone-${tone}`, className)} />;
}
export function Alert({
  title,
  children,
  tone = "info",
}: {
  title: string;
  children: ReactNode;
  tone?: "info" | "success" | "warning" | "danger";
}) {
  return (
    <div
      className={cx("alert", `alert-${tone}`)}
      role={tone === "danger" ? "alert" : "status"}
    >
      <strong>{title}</strong>
      <div>{children}</div>
    </div>
  );
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden="true" />;
}
export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon ? (
        <span className="state-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {action}
    </div>
  );
}
export function ErrorState({
  title = "Something went wrong",
  description = "Please try again. Your work has not been changed.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="empty-state error-state" role="alert">
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
export function Progress({
  label,
  value,
  max = 100,
}: {
  label: string;
  value?: number;
  max?: number;
}) {
  const limit = Number.isFinite(max) && max > 0 ? max : 100;
  const amount =
    value !== undefined && Number.isFinite(value)
      ? Math.min(limit, Math.max(0, value))
      : undefined;
  return (
    <div className="progress-group">
      <span>{label}</span>
      <progress aria-label={label} value={amount} max={limit} />
    </div>
  );
}
