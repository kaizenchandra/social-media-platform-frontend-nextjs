"use client";
import { useState } from "react";
import {
  ArrowRight,
  Heart,
  MoreHorizontal,
  Inbox,
  Check,
  RotateCcw,
} from "lucide-react";
import {
  Button,
  IconButton,
  Badge,
  Card,
  Alert,
  Skeleton,
  EmptyState,
  ErrorState,
  Progress,
} from "@/components/ui/primitives";
import { Input, Textarea, Select, Switch } from "@/components/ui/forms";
import { Avatar } from "@/components/ui/avatar";
import {
  Dialog,
  Sheet,
  Tabs,
  DropdownMenu,
  Toast,
} from "@/components/ui/overlays";

export function ComponentLibrary() {
  const [toastOpen, setToastOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [recovered, setRecovered] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const notify = () => setToastOpen(true);
  return (
    <div className="page-content library">
      <div className="page-heading">
        <p className="eyebrow">THE COMMON LANGUAGE</p>
        <Badge>Interactive preview</Badge>
      </div>
      <h1>
        Small details.
        <br />
        <span className="muted">One coherent experience.</span>
      </h1>
      <p className="page-intro">
        A working library of the elements that make Common feel familiar. Try
        them with your mouse, your keyboard, or your preferred theme.
      </p>
      <Alert title="A preview, with clear boundaries">
        These examples use local state only. No account, preferences, or content
        is sent to a service.
      </Alert>
      <section id="tokens" className="library-section">
        <div className="section-heading">
          <h2>01 / Foundations</h2>
          <Badge tone="primary">Theme aware</Badge>
        </div>
        <Card className="token-card">
          <div className="swatches">
            {[
              "background",
              "surface",
              "primary",
              "text",
              "success",
              "danger",
            ].map((token) => (
              <div key={token}>
                <div className={`swatch swatch-${token}`} />
                <span>{token}</span>
              </div>
            ))}
          </div>
          <div className="token-details">
            <div>
              <span className="eyebrow">TYPE</span>
              <p className="type-preview">Clarity comes first.</p>
              <p className="muted">System sans · 14 / 16 / 20 / 28</p>
            </div>
            <div>
              <span className="eyebrow">RHYTHM</span>
              <p>4 · 8 · 12 · 16 · 24 · 32 · 48</p>
              <p className="muted">Space to breathe. Room to read.</p>
            </div>
          </div>
        </Card>
      </section>
      <section className="library-section">
        <h2>02 / Actions & identity</h2>
        <Card className="sample-card">
          <h3>Buttons</h3>
          <div className="sample-row">
            <Button onClick={notify}>
              Primary action <ArrowRight size={16} aria-hidden="true" />
            </Button>
            <Button variant="secondary" onClick={notify}>
              Secondary
            </Button>
            <Button variant="ghost" onClick={notify}>
              Quiet action
            </Button>
            <Button variant="danger" onClick={notify}>
              Destructive
            </Button>
            <Button disabled>Unavailable</Button>
            <Button pending>Working…</Button>
            <IconButton
              label="Show appreciation"
              variant="secondary"
              onClick={notify}
            >
              <Heart size={19} aria-hidden="true" />
            </IconButton>
          </div>
          <div className="sample-row sample-separator">
            <Avatar name="Alex Morgan" size="large" />
            <Avatar name="Sam Rivera" />
            <Avatar name="Common preview" size="small" />
            <Badge>Neutral</Badge>
            <Badge tone="success">Ready</Badge>
            <Badge tone="warning">Pending</Badge>
            <Badge tone="danger">Needs attention</Badge>
          </div>
        </Card>
      </section>
      <section className="library-section">
        <h2>03 / Inputs & choices</h2>
        <Card className="sample-card">
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) {
                setError("Enter a name to continue.");
                document.getElementById("preview-name")?.focus();
              } else {
                setError(undefined);
                notify();
              }
            }}
          >
            <Input
              id="preview-name"
              label="Display name example"
              placeholder="How would you like to be called?"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError(undefined);
              }}
              error={error}
              hint="Example only. This won’t create or update a profile."
              required
            />
            <Textarea
              label="A few words"
              placeholder="There’s room for your thoughts."
              hint="Text stays in this page’s memory."
            />
            <Select label="Example selection" defaultValue="comfortable">
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </Select>
            <Switch
              label="Example preference"
              hint="Try a keyboard toggle. This changes the preview only."
              checked={enabled}
              onCheckedChange={setEnabled}
            />
            <Button type="submit" variant="secondary">
              Validate example <Check size={17} aria-hidden="true" />
            </Button>
          </form>
        </Card>
      </section>
      <section className="library-section">
        <h2>04 / Navigation & overlays</h2>
        <Card className="sample-card">
          <Tabs
            label="Component examples"
            tabs={[
              {
                value: "details",
                label: "Details",
                content: (
                  <p className="muted">
                    Arrow keys move between tabs. Each tab has its own
                    associated panel.
                  </p>
                ),
              },
              {
                value: "principles",
                label: "Principles",
                content: (
                  <p className="muted">
                    Clear labels. Predictable focus. No action hidden behind a
                    gesture.
                  </p>
                ),
              },
            ]}
          />
          <div className="sample-row">
            <Dialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              trigger={<Button variant="secondary">Open dialog</Button>}
              title="A moment of focus"
              description="An accessible dialog keeps keyboard focus here until you close it."
            >
              <p className="muted">
                Use Escape or the close button to return to the trigger.
              </p>
              <div className="dialog-actions">
                <Button onClick={() => setDialogOpen(false)}>Done</Button>
              </div>
            </Dialog>
            <Sheet
              trigger={<Button variant="secondary">Open sheet</Button>}
              title="A little more room"
              description="A side panel on larger screens, with a comfortable fit on mobile."
            >
              <Input label="Example note" placeholder="Nothing here is saved" />
              <p className="muted">Use the close button or Escape to return.</p>
            </Sheet>
            <DropdownMenu
              label="Example actions"
              trigger={
                <IconButton label="More example actions" variant="secondary">
                  <MoreHorizontal size={20} aria-hidden="true" />
                </IconButton>
              }
              items={[
                { label: "Show notification", onSelect: notify },
                {
                  label: "Unavailable action",
                  disabled: true,
                  onSelect: () => {},
                },
              ]}
            />
          </div>
        </Card>
      </section>
      <section className="library-section">
        <h2>05 / Feedback & states</h2>
        <Card className="sample-card">
          <Alert tone="success" title="You’re all set">
            Clear feedback, without taking over the screen.
          </Alert>
          <Alert tone="warning" title="Needs a little attention">
            Explain what happens next, in plain language.
          </Alert>
          <Progress label="Example progress" value={64} />
          <Progress label="Waiting for an example response" />
          <div
            role="status"
            aria-label="Loading example"
            className="loading-example"
          >
            <span className="sr-only">Loading example…</span>
            <Skeleton className="skeleton-avatar" />
            <div>
              <Skeleton className="skeleton-line" />
              <Skeleton className="skeleton-line short" />
            </div>
          </div>
          <EmptyState
            title="A fresh start"
            description="An empty state gives people a clear next step."
            icon={<Inbox size={26} />}
            action={
              <Button variant="secondary" onClick={notify}>
                Try an action
              </Button>
            }
          />
          {recovered ? (
            <Alert tone="success" title="Example recovered">
              The retry replaced the error state.
            </Alert>
          ) : (
            <ErrorState
              title="Example connection interrupted"
              description="A recoverable error preserves your context and offers a next step."
              onRetry={() => setRecovered(true)}
            />
          )}
          {recovered ? (
            <Button variant="ghost" onClick={() => setRecovered(false)}>
              <RotateCcw size={16} aria-hidden="true" />
              Reset error example
            </Button>
          ) : null}
          <Button variant="secondary" onClick={notify}>
            Show toast
          </Button>
        </Card>
      </section>
      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        title="Example action complete"
        description="Local preview only. Nothing was sent or saved."
      />
      <footer className="page-footer">
        <span>common. / A shared language</span>
        <span>Design system · v0.1</span>
      </footer>
    </div>
  );
}
