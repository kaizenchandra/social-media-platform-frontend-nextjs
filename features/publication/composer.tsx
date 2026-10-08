"use client";
import Link from "next/link";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { Alert, Button, Badge } from "@/components/ui/primitives";
import { Input, Select } from "@/components/ui/forms";
import { Dialog } from "@/components/ui/overlays";
import { usePublicationOperation } from "./use-publication-operation";
import { RichTextInput, RichTextPreview } from "./rich-text";
import { PublicationStatus } from "./status";
import { mediaInput } from "./validation";
import {
  scenarios,
  type Publication,
  type PostDraft,
  type MediaInput,
} from "./contracts";
type Selection = { file: File; url: string };
export function Composer({
  initial,
  copy,
  format = "post",
}: {
  initial?: Publication;
  copy?: PostDraft;
  format?: NonNullable<PostDraft["format"]>;
}) {
  const source = initial?.draft ?? copy;
  const contentFormat = source?.format ?? format;
  const [saved, setSaved] = useState(initial);
  const [workflow, setWorkflow] = useState<Publication>();
  const [text, setText] = useState(source?.text ?? "");
  const [audience, setAudience] = useState<PostDraft["audience"]>(
    source?.audience ?? "private",
  );
  const [disclosure, setDisclosure] = useState<PostDraft["disclosure"]>(
    source?.disclosure ?? "not-declared",
  );
  const [scenario, setScenario] = useState<PostDraft["scenario"]>(
    source?.scenario ?? "low-risk",
  );
  const [media, setMedia] = useState<MediaInput[]>(source?.media ?? []);
  const [selection, setSelection] = useState<Selection[]>([]);
  const [syntheticOnly, setSyntheticOnly] = useState(false);
  const [fileError, setFileError] = useState("");
  const [intent, setIntent] = useState<"save" | "begin">("save");
  const beginAttempt = useRef<{
    operation: "begin";
    id: string;
    version: number;
  } | null>(null);
  const [unconfirmedStart, setUnconfirmedStart] = useState(false);
  const [working, setWorking] = useState(false);
  const operation = usePublicationOperation();
  const urls = useRef(new Set<string>()),
    busy = useRef(false),
    form = useRef<HTMLFormElement>(null),
    summary = useRef<HTMLDivElement>(null);
  const releaseUrls = () => {
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current.clear();
    setSelection([]);
  };
  useEffect(() => {
    const current = urls.current;
    return () => {
      for (const url of current) URL.revokeObjectURL(url);
      current.clear();
      setSelection([]);
    };
  }, []);
  useEffect(() => {
    if (
      !working &&
      !operation.pending &&
      operation.outcome &&
      !operation.outcome.ok
    )
      (
        form.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
        summary.current
      )?.focus();
  }, [operation.outcome, working, operation.pending]);
  function attach(files: FileList | null) {
    if (!files) return;
    setFileError("");
    // A restored draft has metadata but no retained browser files. Reselecting replaces its unavailable attachments.
    const existing = selection.length === media.length ? media : [];
    const raw = [...files].map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      alt: "",
    }));
    if (
      existing.length + raw.length > 6 ||
      [...existing, ...raw].reduce((sum, entry) => sum + entry.size, 0) >
        100 * 1024 * 1024
    ) {
      setFileError("Attach at most six files, within 100 MB total.");
      return;
    }
    const added: MediaInput[] = [];
    for (const entry of raw) {
      const valid = mediaInput.safeParse({
        ...entry,
        alt: "Pending description",
      });
      if (!valid.success) {
        setFileError(valid.error.issues[0].message);
        return;
      }
      added.push({ ...valid.data, alt: "" });
    }
    try {
      const next = [...files].map((file) => {
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        return { file, url };
      });
      setMedia([...existing, ...added]);
      setSelection([...selection, ...next]);
    } catch {
      setFileError(
        "Local previews are unavailable in this browser. No file was transferred.",
      );
    }
  }
  function remove(index: number) {
    const url = selection[index]?.url;
    if (url) {
      URL.revokeObjectURL(url);
      urls.current.delete(url);
    }
    setMedia((current) => current.filter((_, i) => i !== index));
    setSelection((current) => current.filter((_, i) => i !== index));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const selectedIntent =
      submitter instanceof HTMLButtonElement && submitter.value
        ? submitter.value
        : intent;
    if (busy.current || !operation.ready) return;
    setFileError("");
    if (selectedIntent === "begin" && media.length !== selection.length) {
      setFileError(
        "Reselect the draft's files or remove unavailable attachments before starting this simulation.",
      );
      form.current
        ?.querySelector<HTMLInputElement>('input[type="file"]')
        ?.focus();
      return;
    }
    busy.current = true;
    setWorking(true);
    const draft = {
      ...((source?.format ?? format) !== "post"
        ? { format: source?.format ?? format }
        : {}),
      text,
      audience,
      disclosure,
      scenario,
      media,
      syntheticOnly,
    };
    try {
      if (beginAttempt.current) {
        const start = await operation.run(beginAttempt.current);
        if (start?.ok) {
          releaseUrls();
          beginAttempt.current = null;
          setUnconfirmedStart(false);
          setWorkflow(start.item);
        }
        return;
      }
      const result = await operation.run({
        operation: "save",
        ...(saved ? { id: saved.id, version: saved.version } : {}),
        draft,
      });
      if (!result?.ok) return;
      setSaved(result.item);
      if (selectedIntent === "begin") {
        beginAttempt.current = {
          operation: "begin",
          id: result.item.id,
          version: result.item.version,
        };
        const start = await operation.run(beginAttempt.current);
        if (!start?.ok) setUnconfirmedStart(true);
        if (start?.ok) {
          releaseUrls();
          beginAttempt.current = null;
          setWorkflow(start.item);
        }
      }
    } finally {
      busy.current = false;
      setWorking(false);
    }
  }
  const busyControls = !operation.ready || operation.pending || working;
  const disabled = busyControls || unconfirmedStart;
  if (workflow)
    return (
      <div className="composer-layout">
        <PublicationStatus initial={workflow} continuePreview />
        <Link className="button button-secondary" href="/drafts">
          View drafts and workflows
        </Link>
      </div>
    );
  return (
    <div className="composer-layout">
      <Alert title="Private development simulation" tone="warning">
        Use benign synthetic files only. File bytes stay on your device. Only
        text and declared file metadata go to the process-local preview store.
        Transfer, processing and screening results are simulated; nothing can be
        publicly distributed.
      </Alert>
      <form
        ref={form}
        method="post"
        noValidate
        onSubmit={(event) => void submit(event)}
        aria-label={`${contentFormat === "post" ? "Post" : contentFormat} composer`}
        aria-busy={working}
      >
        <fieldset className="auth-fieldset" disabled={disabled}>
          <RichTextInput
            label={
              contentFormat === "post"
                ? "Post text"
                : `${contentFormat[0].toUpperCase()}${contentFormat.slice(1)} text`
            }
            value={text}
            onChange={setText}
            error={operation.fields["draft.text"]}
          />
          <div className="composer-options">
            <Select
              label="Intended audience"
              value={audience}
              onChange={(event) =>
                setAudience(event.target.value as PostDraft["audience"])
              }
              error={operation.fields["draft.audience"]}
            >
              <option value="private">Only me</option>
              <option value="friends">Friends</option>
              <option value="public">Public (distribution disabled)</option>
            </Select>
            <Select
              label="AI-generated media disclosure"
              value={disclosure}
              onChange={(event) =>
                setDisclosure(event.target.value as PostDraft["disclosure"])
              }
            >
              <option value="not-declared">No AI use declared</option>
              <option value="ai-generated">AI-generated</option>
              <option value="ai-edited">AI-edited</option>
              <option value="unknown">Unknown origin</option>
            </Select>
          </div>
          <Input
            label="Image or video attachments"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            error={fileError || operation.fields["draft.media"]}
            hint="Up to six files, 10 MB per image / 50 MB per video, 100 MB total. Declared type/size checks are not server byte validation."
            onChange={(event) => {
              attach(event.target.files);
              event.target.value = "";
            }}
          />
          {media.length && selection.length !== media.length ? (
            <Alert title="Reselect draft attachments">
              This draft stores metadata only. Original files are not retained
              after leaving the composer. Reselect them to replace the
              unavailable attachments, or remove them.
            </Alert>
          ) : null}
          <ul className="composer-attachments" aria-label="Draft attachments">
            {media.map((entry, index) => (
              <li
                className="card attachment-card"
                key={`${index}-${entry.name}`}
              >
                <p>
                  <strong>{entry.name}</strong> ·{" "}
                  {entry.type.startsWith("image/") ? "Image" : "Video"} ·{" "}
                  {(entry.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                {selection[index]?.url ? (
                  entry.type.startsWith("image/") ? (
                    <LocalImage
                      key={selection[index].url}
                      url={selection[index].url}
                      alt={entry.alt || "Undescribed local draft image"}
                    />
                  ) : (
                    <LocalVideo
                      key={selection[index].url}
                      url={selection[index].url}
                      name={entry.name}
                    />
                  )
                ) : (
                  <p className="field-hint">Local file unavailable</p>
                )}
                <Input
                  label={
                    entry.type.startsWith("image/")
                      ? `Image description ${index + 1}`
                      : `Video description ${index + 1}`
                  }
                  value={entry.alt}
                  maxLength={300}
                  required={entry.type.startsWith("image/")}
                  error={operation.fields[`draft.media.${index}.alt`]}
                  hint="Describe the visual content; do not include private information."
                  onChange={(event) =>
                    setMedia((current) =>
                      current.map((value, i) =>
                        i === index
                          ? { ...value, alt: event.target.value }
                          : value,
                      ),
                    )
                  }
                />
                <Button variant="secondary" onClick={() => remove(index)}>
                  Remove attachment {index + 1}
                </Button>
              </li>
            ))}
          </ul>
          <Select
            label="Simulated workflow scenario"
            value={scenario}
            onChange={(event) =>
              setScenario(event.target.value as PostDraft["scenario"])
            }
            hint="Scripted fixture outcomes do not assess your files."
          >
            {scenarios.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={syntheticOnly}
              onChange={(event) => setSyntheticOnly(event.target.checked)}
              aria-invalid={!!operation.fields["draft.syntheticOnly"]}
              aria-describedby={
                operation.fields["draft.syntheticOnly"]
                  ? "synthetic-error"
                  : undefined
              }
            />
            I am using only benign synthetic text and media.
          </label>
          {operation.fields["draft.syntheticOnly"] ? (
            <p className="field-error" id="synthetic-error">
              {operation.fields["draft.syntheticOnly"]}
            </p>
          ) : null}
          <div className="publication-actions">
            <Button
              type="submit"
              name="intent"
              value="save"
              variant="secondary"
              onClick={() => setIntent("save")}
            >
              Save private draft
            </Button>
            <Button
              type="submit"
              name="intent"
              value="begin"
              onClick={() => setIntent("begin")}
            >
              Start simulated upload
            </Button>
            <Dialog
              title={`Private ${contentFormat} preview`}
              description="Owner-only local draft preview. This is not published content."
              trigger={
                <Button variant="secondary">Preview {contentFormat}</Button>
              }
            >
              <Badge>Draft · {audience}</Badge>
              <RichTextPreview text={text} />
              <p>
                AI disclosure: {disclosure}. Self-declared; no verified
                provenance.
              </p>
              <ul>
                {media.map((entry, index) => (
                  <li key={index}>
                    {entry.name} — {entry.alt || "Description pending"}
                  </li>
                ))}
              </ul>
              <p className="field-hint">
                Media stays in the local attachment previews; no media URL or
                approval is published.
              </p>
            </Dialog>
          </div>
        </fieldset>
      </form>
      {operation.outcome ? (
        <div ref={summary} tabIndex={-1}>
          <Alert
            title={
              operation.outcome.ok
                ? "Draft saved privately"
                : "Draft not confirmed"
            }
            tone={operation.outcome.ok ? "success" : "danger"}
          >
            {operation.outcome.ok
              ? operation.outcome.item.explanation
              : operation.outcome.error.message}
            {!operation.outcome.ok && operation.outcome.error.retryable ? (
              <Button
                variant="secondary"
                disabled={busyControls}
                onClick={() => form.current?.requestSubmit()}
              >
                Retry draft action
              </Button>
            ) : null}
            {!operation.outcome.ok &&
            operation.outcome.error.code === "conflict" ? (
              <Button
                variant="secondary"
                onClick={() => window.location.reload()}
              >
                Reload draft
              </Button>
            ) : null}
          </Alert>
        </div>
      ) : null}
      {unconfirmedStart && saved ? (
        <Alert title="Workflow start not confirmed" tone="warning">
          The saved draft may already have started. Retry the same request or
          inspect its latest status before editing.
          <Link href={`/content/${saved.id}`}>Check saved workflow status</Link>
        </Alert>
      ) : null}
      <div className="publication-actions">
        <Link href="/drafts">View drafts and workflows</Link>
        <Link href="/safety">
          Media consent, authenticity and reporting support
        </Link>
      </div>
    </div>
  );
}
function PreviewFailure() {
  return (
    <Alert title="Local preview unavailable" tone="danger">
      This browser could not decode the selected file. Remove it and choose a
      supported file. Nothing was transferred or screened.
    </Alert>
  );
}
function LocalImage({ url, alt }: { url: string; alt: string }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  if (state === "failed") return <PreviewFailure />;
  return (
    <>
      {state === "loading" ? (
        <p role="status">Loading local image preview…</p>
      ) : null}
      {/* Browser-local Blob URLs must not pass through the Next.js image proxy. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className="local-draft-image"
        onLoad={() => setState("ready")}
        onError={() => setState("failed")}
      />
    </>
  );
}
function LocalVideo({ url, name }: { url: string; name: string }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  if (state === "failed") return <PreviewFailure />;
  return (
    <>
      {state === "loading" ? (
        <p role="status">Loading local video preview…</p>
      ) : null}
      <video
        src={url}
        controls
        preload="metadata"
        aria-label={`Local draft video ${name}`}
        onLoadedMetadata={() => setState("ready")}
        onError={() => setState("failed")}
      />
    </>
  );
}
