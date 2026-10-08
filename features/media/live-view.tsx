"use client";
import { useState } from "react";
import Link from "next/link";
import { Radio, VideoOff, ShieldAlert } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { Input, Select, Textarea } from "@/components/ui/forms";
import { MediaNavigation } from "./chrome";
import { liveReady } from "./policy";
import type { LiveCapabilities, LivePreviewState } from "./contracts";
export function LiveView({ capabilities }: { capabilities: LiveCapabilities }) {
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("private");
  const [description, setDescription] = useState("");
  const [prepared, setPrepared] = useState(false);
  const [state, setState] = useState<LivePreviewState>("unavailable");
  const ready = liveReady(capabilities);
  return (
    <>
      <MediaNavigation active="live" />
      <div className="messages-title">
        <div>
          <p className="eyebrow">A SPACE TO BE PRESENT</p>
          <h1>Live studio</h1>
        </div>
        <Radio size={32} aria-hidden="true" />
      </div>
      <p className="alert alert-warning">
        Live provider unavailable · This is a planning interface. No camera,
        microphone, ingest, audience session or broadcast is connected.
      </p>
      <div className="live-studio-layout">
        <section className="card live-stage">
          <div className="live-placeholder">
            <VideoOff size={48} aria-hidden="true" />
            <h2>No live connection</h2>
            <p role="status">
              {state === "connecting-preview"
                ? "Simulated connecting state — no provider connection is attempted."
                : state === "disconnected-preview"
                  ? "Simulated connection loss — no stream is running."
                  : state === "interrupted-preview"
                    ? "Simulated safety interruption — no media is being transmitted."
                    : "Provider integration is required before a broadcast or viewer stream can start."}
            </p>
            <Badge tone="warning">
              {state === "unavailable" ? "Unavailable" : "UI simulation"}
            </Badge>
          </div>
          <div className="chat-tools">
            <Button disabled={!ready}>
              Start broadcast (provider unavailable)
            </Button>
            <Button variant="danger" disabled>
              Stop broadcast (no session)
            </Button>
          </div>
          <details className="messaging-simulation">
            <summary>Preview live connection states</summary>
            <Select
              label="Live UI state"
              value={state}
              onChange={(e) => setState(e.target.value as LivePreviewState)}
            >
              <option value="unavailable">Unavailable</option>
              <option value="connecting-preview">Connecting preview</option>
              <option value="disconnected-preview">Disconnected preview</option>
              <option value="interrupted-preview">
                Safety interruption preview
              </option>
            </Select>
          </details>
          <h3>Viewer interactions</h3>
          <p className="muted">
            Live comments, reactions, captions, participant moderation and
            reports require the provider and safety services. Nothing is
            submitted here.
          </p>
          <Textarea label="Live comment (unavailable)" disabled value="" />
          <div className="chat-tools">
            <Button disabled>Send live comment</Button>
            <Button variant="secondary" disabled>
              React to stream
            </Button>
            <Button variant="secondary" disabled>
              Live captions unavailable
            </Button>
            <Button variant="danger" disabled>
              Report stream (service unavailable)
            </Button>
          </div>
        </section>
        <aside className="card live-plan">
          <h2>Prepare a local broadcast plan</h2>
          <form
            method="post"
            onSubmit={(e) => {
              e.preventDefault();
              setPrepared(true);
            }}
          >
            <Input
              label="Broadcast title"
              required
              maxLength={100}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setPrepared(false);
              }}
            />
            <Textarea
              label="Broadcast description"
              maxLength={1000}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setPrepared(false);
              }}
            />
            <Select
              label="Intended live audience"
              value={audience}
              onChange={(e) => {
                setAudience(e.target.value);
                setPrepared(false);
              }}
            >
              <option value="private">Private</option>
              <option value="friends">Friends</option>
              <option value="public">Public</option>
            </Select>
            <Button type="submit" disabled={!title.trim()}>
              Prepare unsent plan
            </Button>
            {prepared && (
              <p role="status">
                Local plan prepared for {audience}. No eligibility check,
                schedule or broadcast was created.
              </p>
            )}
          </form>
          <h3>
            <ShieldAlert size={19} aria-hidden="true" /> Live safety boundary
          </h3>
          <p>
            Future video frames do not exist yet and cannot be prescreened.
            Recorded-media approval never authorizes a live broadcast.
          </p>
          <ul className="live-checklist">
            {[
              {
                key: "eligibility",
                label: "Server eligibility and audience authorization",
              },
              { key: "ingest", label: "Authenticated ingest and playback" },
              {
                key: "continuousMonitoring",
                label: "Continuous safety monitoring and human escalation",
              },
              {
                key: "emergencyInterruption",
                label: "Emergency interruption and restriction",
              },
              {
                key: "reporting",
                label: "Reporting and moderator intervention",
              },
            ].map((requirement) => (
              <li key={requirement.key}>
                {requirement.label}
                <Badge tone="warning">
                  {capabilities[requirement.key as keyof LiveCapabilities] ===
                  true
                    ? "Contract requirement"
                    : "Not connected"}
                </Badge>
              </li>
            ))}
          </ul>
          <h3>Completed recordings</h3>
          <p>
            Any replay must enter private processing, screening and required
            review before authorized publication. Stopping a stream or reaching
            upload 100% is never approval.
          </p>
          <Link href="/videos/create">Prepare a private recording draft</Link>
        </aside>
      </div>
    </>
  );
}
