"use client";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
export function AccessWatch({ children }: { children: ReactNode }) {
  const router = useRouter(),
    [hidden, setHidden] = useState(false),
    [pending, start] = useTransition();
  useEffect(() => {
    const hide = () => setHidden(true),
      check = () => {
        start(() => {
          router.refresh();
          setHidden(false);
        });
      },
      visibility = () => {
        if (document.hidden) hide();
        else check();
      };
    window.addEventListener("blur", hide);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", visibility);
    const pageshow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", pageshow);
    return () => {
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pageshow", pageshow);
    };
  }, [router]);
  return hidden || pending ? (
    <p role="status">Checking current access…</p>
  ) : (
    children
  );
}
