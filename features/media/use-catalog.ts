"use client";
import { useEffect, useRef, useState } from "react";
import { refreshMedia } from "./actions";
import type { Catalog } from "./contracts";
export function useMediaCatalog(initial: Catalog) {
  const [catalog, setCatalog] = useState<Catalog | null>(initial);
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(initial.generatedAt);
  const busy = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  async function refresh() {
    if (busy.current) return;
    busy.current = true;
    const attempt = ++generation.current;
    setChecking(true);
    setCatalog(null);
    setNotice("");
    try {
      const result = await refreshMedia();
      if (!mounted.current || attempt !== generation.current) return;
      if (result.ok) {
        setCatalog(result.catalog);
        setNow(result.catalog.generatedAt);
      } else {
        setNotice(result.error.message);
        if (result.error.code === "unauthorized")
          window.location.replace("/login?reason=expired");
      }
    } catch {
      if (mounted.current && attempt === generation.current)
        setNotice(
          "Media permissions could not be checked. Playback stays stopped; retry manually.",
        );
    } finally {
      if (mounted.current && attempt === generation.current) {
        busy.current = false;
        setChecking(false);
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const focus = () => void refresh();
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    const pageshow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("pageshow", pageshow);
    return () => {
      mounted.current = false;
      clearInterval(tick);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("pageshow", pageshow);
    };
    // Keep one document listener; reads obtain current service authority rather than captured catalog data.
  }, []);
  const items =
    catalog?.items.filter(
      (item) =>
        item.source === "fixture" &&
        item.publication === "FIXTURE" &&
        !item.distributionEnabled &&
        (item.kind !== "story" ||
          item.expiresAt === null ||
          item.expiresAt > now ||
          item.highlighted),
    ) ?? [];
  function update(item: Catalog["items"][number]) {
    setCatalog((current) =>
      current
        ? {
            ...current,
            items: current.items.map((m) => (m.id === item.id ? item : m)),
          }
        : null,
    );
  }
  function deny(message: string) {
    setCatalog(null);
    setNotice(message);
  }
  return { items, now, notice, checking, refresh, update, deny };
}
