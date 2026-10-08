"use client";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/primitives";
import { defaultWellbeing, type WellbeingPreferences } from "./contracts";
import { activeDelta, isQuiet } from "./wellbeing-policy";
import { readWellbeing } from "./actions";
import { wellbeingContext as context } from "./wellbeing-context";
type Snapshot = { actorId: string | null; preferences: WellbeingPreferences };
// This leaf can suspend without withholding or duplicating the page's server-rendered forms.
function PreferenceSync({ onRead }: { onRead: (snapshot: Snapshot) => void }) {
  const pathname = usePathname();
  useEffect(() => {
    let alive = true,
      generation = 0;
    const check = async () => {
      const current = ++generation;
      try {
        const result = await readWellbeing();
        if (alive && current === generation)
          onRead({
            actorId: result.actorId,
            preferences: result.preferences ?? defaultWellbeing,
          });
      } catch {
        if (alive && current === generation)
          onRead({ actorId: null, preferences: defaultWellbeing });
      }
    };
    void check();
    window.addEventListener("focus", check);
    window.addEventListener("common:wellbeing-change", check);
    return () => {
      alive = false;
      window.removeEventListener("focus", check);
      window.removeEventListener("common:wellbeing-change", check);
    };
  }, [pathname, onRead]);
  return null;
}
function SessionReminder({
  actorId,
  p,
}: {
  actorId: string | null;
  p: WellbeingPreferences;
}) {
  const [reminder, setReminder] = useState(false),
    [clock, setClock] = useState<Date | null>(null),
    total = useRef(0),
    last = useRef(0),
    reminded = useRef(false);
  useEffect(() => {
    if (!actorId || (!p.quietEnabled && p.screenTimeReminder === 0)) return;
    last.current = performance.now();
    const timer = setInterval(() => {
      const current = performance.now();
      if (p.screenTimeReminder > 0) {
        total.current += activeDelta(
          last.current,
          current,
          !document.hidden && document.hasFocus(),
        );
        if (
          total.current >= p.screenTimeReminder * 60000 &&
          !reminded.current
        ) {
          reminded.current = true;
          setReminder(true);
        }
      }
      last.current = current;
      setClock(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [actorId, p.screenTimeReminder, p.quietEnabled]);
  return (
    <>
      {actorId && clock && isQuiet(p, clock) && (
        <p className="wellbeing-banner">
          Quiet hours · notification delivery is not connected.{" "}
          <Link href="/wellbeing">Review your boundaries</Link>
        </p>
      )}
      {reminder && actorId && p.screenTimeReminder > 0 && (
        <section className="wellbeing-banner" aria-label="Screen-time reminder">
          <p>
            You reached your chosen active time in this document. Take a break
            whenever you are ready. This local timer is not account-wide usage
            analytics.
          </p>
          <Button variant="secondary" onClick={() => setReminder(false)}>
            Dismiss reminder
          </Button>
          <Link href="/wellbeing">Change screen-time preference</Link>
        </section>
      )}
    </>
  );
}
export function WellbeingProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    actorId: null,
    preferences: defaultWellbeing,
  });
  const receive = useCallback(
    (next: Snapshot) =>
      setSnapshot((previous) =>
        previous.actorId === next.actorId &&
        previous.preferences.version > next.preferences.version
          ? previous
          : next,
      ),
    [],
  );
  return (
    <context.Provider value={snapshot.preferences}>
      <Suspense fallback={null}>
        <PreferenceSync onRead={receive} />
      </Suspense>
      <SessionReminder
        key={snapshot.actorId ?? "guest"}
        actorId={snapshot.actorId}
        p={snapshot.preferences}
      />
      {children}
    </context.Provider>
  );
}
