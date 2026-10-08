"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { Alert, Badge, Button, Progress } from "@/components/ui/primitives";
import { readPublication } from "./actions";
import { usePublicationOperation } from "./use-publication-operation";
import {
  activeStates,
  cancellableStates,
  type Publication,
  type PublicationResult,
} from "./contracts";
export function PublicationStatus({
  initial,
  continuePreview = false,
}: {
  initial: Publication;
  continuePreview?: boolean;
}) {
  const [item, setItem] = useState(initial);
  const [running, setRunning] = useState(continuePreview);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const operation = usePublicationOperation(),
    cancellation = usePublicationOperation();
  const cancelled = useRef(false),
    checkingRef = useRef(false);
  function receive(result: PublicationResult | null) {
    if (result?.ok)
      setItem((current) =>
        result.item.version >= current.version ? result.item : current,
      );
    else if (result) setRunning(false);
  }
  useEffect(() => {
    if (
      !running ||
      !operation.ready ||
      operation.pending ||
      cancelled.current ||
      !activeStates.includes(item.state)
    )
      return;
    const timer = setTimeout(() => {
      void operation
        .run({ operation: "advance", id: item.id, version: item.version })
        .then(receive);
    }, 200);
    return () => clearTimeout(timer);
    // Each confirmed snapshot schedules one bounded next step. No failure retries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, running, operation.ready, operation.pending]);
  async function refresh() {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    setCheckError("");
    try {
      const result = await readPublication(item.id);
      receive(result);
      if (!result.ok) {
        setCheckError(result.error.message);
        if (result.error.code === "unauthorized")
          window.location.replace("/login?reason=expired");
      }
    } catch {
      setCheckError("Status check interrupted. Try again.");
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }
  const failed =
    operation.outcome && !operation.outcome.ok ? operation.outcome.error : null;
  const cancelError =
    cancellation.outcome && !cancellation.outcome.ok
      ? cancellation.outcome.error
      : null;
  return (
    <section
      className="card publication-status"
      aria-labelledby="publication-status-heading"
    >
      <h2 id="publication-status-heading">Publication status</h2>
      <div role="status" aria-live="polite" className="publication-summary">
        <Badge>
          {item.mode === "simulated" ? "Simulated" : "Service status"}{" "}
          {item.state}
        </Badge>
        <p>{item.explanation}</p>
      </div>
      <Alert title="Public distribution disabled" tone="warning">
        This preview never publishes content. Successful transfer and simulated
        approval do not grant publication permission.
      </Alert>
      {item.state === "UPLOADING" || item.progress ? (
        <Progress
          label="Simulated upload progress — no bytes transferred"
          value={item.progress}
        />
      ) : null}
      <p className="field-hint">
        Attempt {item.attempt} · Revision {item.version} · Intended audience:{" "}
        {item.draft.audience}
      </p>
      {item.targetAt ? (
        <Alert title="Simulated review target" tone="warning">
          <time dateTime={item.targetAt}>{item.targetAt}</time>
          <p>
            A missed 24-hour target keeps content held. No automatic approval
            and no actual reviewer escalation.
          </p>
        </Alert>
      ) : null}
      {item.decision ? (
        <p className="field-hint">
          {item.decision.source === "simulation"
            ? "Scripted fixture reason"
            : "Service decision reason"}
          : {item.decision.reason}. No verified provenance or detector
          confidence is available.
        </p>
      ) : null}
      <div className="publication-actions">
        <Button
          variant="secondary"
          disabled={!operation.ready}
          pending={checking}
          onClick={() => void refresh()}
        >
          Refresh status
        </Button>
        {activeStates.includes(item.state) && !running ? (
          <Button
            disabled={!operation.ready || operation.pending}
            onClick={() => {
              cancelled.current = false;
              setRunning(true);
            }}
          >
            Continue simulation
          </Button>
        ) : null}
        {cancellableStates.includes(item.state) ? (
          <Button
            variant="secondary"
            disabled={!cancellation.ready}
            pending={cancellation.pending}
            onClick={() => {
              cancelled.current = true;
              setRunning(false);
              void cancellation
                .run({ operation: "cancel", id: item.id })
                .then(receive);
            }}
          >
            Cancel workflow
          </Button>
        ) : null}
        {item.state === "FAILED" && item.retryable && item.attempt < 3 ? (
          <Button
            disabled={!operation.ready || operation.pending}
            onClick={() => {
              cancelled.current = false;
              void operation
                .run({ operation: "retry", id: item.id, version: item.version })
                .then((result) => {
                  receive(result);
                  if (result?.ok) setRunning(true);
                });
            }}
          >
            Retry simulated upload
          </Button>
        ) : null}
        <Button disabled aria-describedby="publish-disabled-reason">
          Publish (backend unavailable)
        </Button>
      </div>
      <p id="publish-disabled-reason" className="field-hint">
        Only an authoritative backend decision and distribution grant may enable
        publication.
      </p>
      {failed || cancelError || checkError ? (
        <Alert title="Update not confirmed" tone="danger">
          {failed?.message ?? cancelError?.message ?? checkError}
          <p>
            Refresh the latest status before continuing. No state is
            optimistically approved.
          </p>
          {failed?.retryable ? (
            <Button
              variant="secondary"
              disabled={operation.pending}
              onClick={() =>
                void operation
                  .run({
                    operation: "advance",
                    id: item.id,
                    version: item.version,
                  })
                  .then((result) => {
                    receive(result);
                    if (result?.ok) setRunning(true);
                  })
              }
            >
              Retry unconfirmed step
            </Button>
          ) : null}
        </Alert>
      ) : null}
      <div className="publication-actions">
        <Link className="button button-secondary" href={`/content/${item.id}`}>
          Open status page
        </Link>
        {item.decision?.appealEligible ? (
          <Link
            className="button button-secondary"
            href={`/content/${item.id}/appeal`}
          >
            Review appeal options
          </Link>
        ) : null}
        {!activeStates.includes(item.state) ? (
          <Link href={`/create?copy=${item.id}`}>
            Create a new draft revision
          </Link>
        ) : null}
        <Link href="/safety">Consent, authenticity and reporting support</Link>
      </div>
    </section>
  );
}
