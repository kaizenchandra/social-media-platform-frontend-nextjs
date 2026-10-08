"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { Select, Textarea } from "@/components/ui/forms";
import { AdvancedNavigation, AdvancedNotice } from "./views";
import { AdvancedForm } from "./action-form";
import { requestAssistance } from "./actions";
import { assistantTasks, type AssistantTask } from "./contracts";
export function AssistantView({
  sources,
}: {
  sources: { id: string; title: string }[];
}) {
  const [task, setTask] = useState<AssistantTask>("writing"),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false),
    generation = useRef(0);
  const publicTask = task === "translation" || task === "summary";
  const reset = () => {
    generation.current++;
    setPending(false);
    setMessage("");
  };
  return (
    <>
      <AdvancedNavigation />
      <p className="eyebrow">YOUR WORDS, YOUR CHOICE</p>
      <h1>Writing and AI tools</h1>
      <AdvancedNotice />
      <section className="card">
        <h2>Request assistance</h2>
        <p>
          AI provider unavailable. These controls prepare a consented request;
          no generated suggestions or translations will be shown until a real
          provider is connected. No private messages, communities or media
          evidence can be selected.
        </p>
        <form
          method="post"
          className="discovery-form"
          onChange={reset}
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget),
              current = ++generation.current;
            setPending(true);
            setMessage("");
            try {
              const result = await requestAssistance({
                task,
                text: String(data.get("text") ?? ""),
                sourceId: publicTask
                  ? String(data.get("sourceId") ?? "")
                  : undefined,
                language: data.get("language"),
                consent: data.has("consent"),
                syntheticOnly: data.has("syntheticOnly"),
              });
              if (generation.current !== current) return;
              setMessage(
                result.ok
                  ? "Output requires a reviewed provider integration before it can be applied."
                  : result.error.message,
              );
            } catch {
              if (generation.current === current)
                setMessage(
                  "Request failed. No output was generated. Retry manually when connected.",
                );
            } finally {
              if (generation.current === current) setPending(false);
            }
          }}
        >
          <Select
            label="Assistance task"
            value={task}
            onChange={(e) => {
              setTask(e.target.value as AssistantTask);
              reset();
            }}
          >
            {assistantTasks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          {publicTask ? (
            <Select label="Eligible public source" name="sourceId" required>
              <option value="">Choose an accessible public post</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
          ) : (
            <Textarea
              label={
                task === "accessibility"
                  ? "Describe the image context (no media upload)"
                  : "Synthetic draft or caption context"
              }
              name="text"
              required
              maxLength={5000}
            />
          )}
          <Select label="Target language" name="language">
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="hi">Hindi</option>
          </Select>
          <label>
            <input type="checkbox" name="consent" required /> I consent to this
            assistance request.
          </label>
          <label>
            <input type="checkbox" name="syntheticOnly" required /> I am using
            synthetic text only.
          </label>
          <Button
            type="submit"
            disabled={pending || (publicTask && !sources.length)}
          >
            {pending ? "Requesting…" : "Request assistance"}
          </Button>
          {pending && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                reset();
                setMessage(
                  "Request dismissed. Late results will be ignored; there is no connected provider job to cancel.",
                );
              }}
            >
              Dismiss request
            </Button>
          )}
          <p role="status">{message}</p>
        </form>
      </section>
      <section className="card">
        <h2>Manual draft workspace</h2>
        <p>
          Write your own text here. This is human-authored text, not an AI
          suggestion. Review and explicitly confirm before saving privately.
          Captions and accessibility descriptions can be copied manually into
          the ordinary composer; publication still requires its safety workflow.
        </p>
        <AdvancedForm
          review
          base={{ operation: "assistant-draft", syntheticOnly: true }}
          label="Save private draft"
        >
          <Textarea
            label="Reviewed manual text"
            name="text"
            required
            maxLength={5000}
          />
          <label>
            <input type="checkbox" name="syntheticOnly" required /> This draft
            contains synthetic details only.
          </label>
        </AdvancedForm>
      </section>
    </>
  );
}
