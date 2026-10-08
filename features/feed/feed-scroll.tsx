"use client";
import { useEffect } from "react";

// Document-lifetime numbers only: no post bodies, identity or browser persistence.
const positions = new Map<string, number>();
export function FeedScroll() {
  useEffect(() => {
    const key = window.location.pathname + window.location.search;
    let leaving = false;
    let restoring = positions.has(key);
    const record = () => {
      if (leaving || restoring) return;
      if (positions.size >= 30 && !positions.has(key))
        positions.delete(positions.keys().next().value!);
      positions.set(key, window.scrollY);
    };
    const navigate = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (
        event.target as Element | null
      )?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const target = new URL(anchor.href, window.location.href);
      if (
        target.origin === window.location.origin &&
        target.pathname + target.search !== key
      ) {
        record();
        leaving = true;
      }
    };
    let secondFrame = 0;
    const frame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (restoring)
          window.scrollTo({ top: positions.get(key)!, behavior: "instant" });
        restoring = false;
      });
    });
    window.addEventListener("scroll", record, { passive: true });
    document.addEventListener("click", navigate, true);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(secondFrame);
      window.removeEventListener("scroll", record);
      document.removeEventListener("click", navigate, true);
    };
  }, []);
  return null;
}
