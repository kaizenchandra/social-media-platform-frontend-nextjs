"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/primitives";
export function FeedRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const refresh = () => startTransition(() => router.refresh());
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", restored);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", restored);
    };
  }, [router]);
  return (
    <Button
      variant="ghost"
      pending={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw size={17} aria-hidden="true" />
      Refresh feed
    </Button>
  );
}
