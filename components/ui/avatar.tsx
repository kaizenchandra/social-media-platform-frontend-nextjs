"use client";
import { useState } from "react";

export function Avatar({
  name,
  src,
  size = "medium",
}: {
  name: string;
  src?: string;
  size?: "small" | "medium" | "large";
}) {
  const [failedSource, setFailedSource] = useState<string>();
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join("") || "?";
  return (
    <span className={`avatar avatar-${size}`} role="img" aria-label={name}>
      {src && failedSource !== src ? (
        // Generic avatar sources are caller-approved; no external fixture media is requested.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedSource(src)}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
