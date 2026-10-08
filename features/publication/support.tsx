"use client";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { Alert, Button } from "@/components/ui/primitives";
import { Textarea, Select } from "@/components/ui/forms";
export function AppealEntry() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(timer);
  }, []);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [prepared, setPrepared] = useState(false);
  const region = useRef<HTMLFormElement>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (note.trim().length < 10) {
      setError("Explain the concern in at least 10 characters.");
      region.current?.querySelector("textarea")?.focus();
      return;
    }
    setError("");
    setPrepared(true);
  }
  return (
    <>
      <Alert title="Appeal service unavailable" tone="warning">
        This is a local preview note only. No case is created, no reviewer
        receives it, and no decision or publication permission changes.
      </Alert>
      <form
        ref={region}
        method="post"
        noValidate
        onSubmit={submit}
        aria-label="Appeal preview note"
      >
        <fieldset className="auth-fieldset" disabled={!ready}>
          <Textarea
            label="Why would you appeal?"
            value={note}
            maxLength={1000}
            onChange={(event) => {
              setNote(event.target.value);
              setPrepared(false);
            }}
            error={error}
            hint="Synthetic text only. Do not add sensitive evidence or personal details."
          />
          <div className="publication-actions">
            <Button type="submit">Prepare local appeal note</Button>
            <Button disabled>Send appeal (service unavailable)</Button>
          </div>
        </fieldset>
      </form>
      {prepared ? (
        <p role="status">
          Local appeal note prepared. Nothing was sent. It stays only in this
          browser document and is cleared by a full reload.
        </p>
      ) : null}
    </>
  );
}
export function SafetySupport() {
  const [concern, setConcern] = useState("consent");
  return (
    <div className="composer-layout">
      <Alert title="Reporting service unavailable" tone="warning">
        No report or sensitive evidence can be sent here. Do not upload
        intimate, abusive or specialist safety material to this development
        preview.
      </Alert>
      <Select
        label="Media safety concern"
        value={concern}
        onChange={(event) => setConcern(event.target.value)}
      >
        <option value="consent">Non-consensual intimate imagery</option>
        <option value="sexual">Sexual-content restriction</option>
        <option value="deepfake">Deepfake or likeness misuse</option>
      </Select>
      <section className="card safety-detail" aria-live="polite">
        <h2>
          {concern === "consent"
            ? "Consent and intimate imagery"
            : concern === "sexual"
              ? "Sexual-content restrictions"
              : "Synthetic media and authenticity"}
        </h2>
        <p>
          {concern === "consent"
            ? "Intimate imagery distributed without consent requires a privacy-preserving reporting and removal service. This preview has no evidence intake, preservation or removal authority. Avoid copying or redistributing the material."
            : concern === "sexual"
              ? "Restricted or rejected content cannot be distributed. A declared fixture outcome does not analyze a file or determine real policy compliance. Actual age, policy and specialist escalation rules require an authoritative service."
              : "AI-generated or edited disclosures are self-declarations. Missing provenance is not proof of manipulation, and a synthetic label is not proof of abuse. No detector or authenticity verifier is connected."}
        </p>
        <Button disabled>Submit private report (service unavailable)</Button>
      </section>
      <p className="field-hint">
        There is no upload or evidence attachment control on this reporting
        page. Real reporting needs scope selection, consent, confidential
        reporter handling and an authoritative receipt.
      </p>
    </div>
  );
}
