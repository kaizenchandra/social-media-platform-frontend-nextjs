"use client";
import { useState } from "react";
import Link from "next/link";
import { Input, Select } from "@/components/ui/forms";
import { Button } from "@/components/ui/primitives";
import { useFeedOperation } from "@/features/feed/use-feed-operation";
import type { FeedPreferences } from "@/features/feed/contracts";
import { AdvancedForm } from "./action-form";
import { AdvancedNavigation, AdvancedNotice } from "./views";
import type { WellbeingPreferences } from "./contracts";
export function WellbeingView({
  p,
  feed,
}: {
  p: WellbeingPreferences;
  feed: FeedPreferences | null;
}) {
  const [message, setMessage] = useState("");
  const operation = useFeedOperation(false);
  return (
    <>
      <AdvancedNavigation />
      <p className="eyebrow">MAKE ROOM FOR YOUR DAY</p>
      <h1>Digital well-being</h1>
      <AdvancedNotice />
      <section className="card">
        <h2>Time and notification boundaries</h2>
        <p>
          Screen-time reminders count active time in this document only, while
          you opt in. Reloading or changing accounts resets the timer. No usage
          history is collected.
        </p>
        <AdvancedForm
          base={{ operation: "wellbeing", ...p }}
          label="Save well-being preferences"
        >
          <Input
            label="Screen-time reminder (minutes; 0 disables)"
            name="screenTimeReminder"
            type="number"
            min={0}
            max={240}
            defaultValue={p.screenTimeReminder}
          />
          <label>
            <input
              type="checkbox"
              name="quietEnabled"
              defaultChecked={p.quietEnabled}
            />{" "}
            Enable quiet hours
          </label>
          <Input
            label="Quiet hours start"
            name="quietStart"
            type="time"
            defaultValue={p.quietStart}
            required
          />
          <Input
            label="Quiet hours end"
            name="quietEnd"
            type="time"
            defaultValue={p.quietEnd}
            required
          />
          <Input
            label="Quiet hours time zone"
            name="timeZone"
            defaultValue={p.timeZone}
            required
            hint="IANA zone, such as Asia/Kolkata or Europe/London. Overnight intervals and daylight-saving offsets follow this zone."
          />
          <label>
            <input
              type="checkbox"
              name="autoplay"
              defaultChecked={p.autoplay}
            />{" "}
            Allow automatic next-story navigation
          </label>
          <p className="field-hint">
            Videos always begin paused. Turning this off also stops stories from
            automatically advancing when their playback ends.
          </p>
          <h3>Notification channel preferences</h3>
          <p>
            Saved intentions only; push, email and in-app notification providers
            are unavailable. Quiet hours suppress nonessential notifications
            when a provider is connected; essential security boundaries require
            its contract.
          </p>
          <label>
            <input
              type="checkbox"
              name="inAppNotifications"
              defaultChecked={p.inAppNotifications}
            />{" "}
            Allow nonessential in-app notifications
          </label>
          <label>
            <input
              type="checkbox"
              name="pushNotifications"
              defaultChecked={p.pushNotifications}
            />{" "}
            Allow nonessential push notifications
          </label>
          <label>
            <input
              type="checkbox"
              name="emailNotifications"
              defaultChecked={p.emailNotifications}
            />{" "}
            Allow nonessential email notifications
          </label>
        </AdvancedForm>
      </section>
      <section className="card">
        <h2>Recommendation controls</h2>
        <p>
          Use deterministic feed controls. No AI ranking service is connected.
        </p>
        {feed ? (
          <form
            method="post"
            className="discovery-form"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              operation.run(
                {
                  operation: "preferences",
                  version: feed.version,
                  defaultMode: data.get("defaultMode"),
                  includeRecommendations: data.has("includeRecommendations"),
                  prioritizeFavorites: feed.prioritizeFavorites,
                  mediaOnly: feed.mediaOnly,
                },
                (result) =>
                  setMessage(result.ok ? result.message : result.error.message),
              );
            }}
          >
            <Select
              label="Default feed"
              name="defaultMode"
              defaultValue={feed.defaultMode}
            >
              {[
                "home",
                "friends",
                "following",
                "chronological",
                "recommended",
              ].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
            <label>
              <input
                type="checkbox"
                name="includeRecommendations"
                defaultChecked={feed.includeRecommendations}
              />{" "}
              Include public discovery in Home
            </label>
            <Button
              type="submit"
              disabled={!operation.ready || operation.pending}
            >
              {operation.pending ? "Saving…" : "Save recommendation controls"}
            </Button>
            <p role="status">{message}</p>
          </form>
        ) : (
          <p>
            Feed preferences unavailable. <Link href="/wellbeing">Retry</Link>
          </p>
        )}
        <Link href="/">Return to your feed</Link>
      </section>
    </>
  );
}
