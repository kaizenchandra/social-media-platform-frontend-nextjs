"use client";
import {
  useId,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
  type ComponentProps,
} from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cx } from "./primitives";

type FieldProps = { label: string; hint?: string; error?: string; id?: string };
function Field({
  id,
  label,
  hint,
  error,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
function descriptions(
  id: string,
  hint?: string,
  error?: string,
  external?: string,
) {
  return (
    [hint && `${id}-hint`, error && `${id}-error`, external]
      .filter(Boolean)
      .join(" ") || undefined
  );
}
export function Input({
  label,
  hint,
  error,
  id: suppliedId,
  className,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <Field {...{ id, label, hint, error }}>
      <input
        {...props}
        id={id}
        aria-invalid={!!error || props["aria-invalid"]}
        aria-describedby={descriptions(
          id,
          hint,
          error,
          props["aria-describedby"],
        )}
        className={cx("input", className)}
      />
    </Field>
  );
}
export function Textarea({
  label,
  hint,
  error,
  id: suppliedId,
  className,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <Field {...{ id, label, hint, error }}>
      <textarea
        rows={4}
        {...props}
        id={id}
        aria-invalid={!!error || props["aria-invalid"]}
        aria-describedby={descriptions(
          id,
          hint,
          error,
          props["aria-describedby"],
        )}
        className={cx("input", className)}
      />
    </Field>
  );
}
export function Select({
  label,
  hint,
  error,
  id: suppliedId,
  className,
  children,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <Field {...{ id, label, hint, error }}>
      <select
        {...props}
        id={id}
        aria-invalid={!!error || props["aria-invalid"]}
        aria-describedby={descriptions(
          id,
          hint,
          error,
          props["aria-describedby"],
        )}
        className={cx("input", className)}
      >
        {children}
      </select>
    </Field>
  );
}
export function Switch({
  label,
  hint,
  id: suppliedId,
  className,
  ...props
}: FieldProps & ComponentProps<typeof SwitchPrimitive.Root>) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <div className="switch-row">
      <div>
        <label htmlFor={id}>{label}</label>
        {hint ? (
          <p id={`${id}-hint`} className="field-hint">
            {hint}
          </p>
        ) : null}
      </div>
      <SwitchPrimitive.Root
        {...props}
        id={id}
        aria-describedby={descriptions(
          id,
          hint,
          undefined,
          props["aria-describedby"],
        )}
        className={cx("switch", className)}
      >
        <SwitchPrimitive.Thumb className="switch-thumb" />
      </SwitchPrimitive.Root>
    </div>
  );
}
