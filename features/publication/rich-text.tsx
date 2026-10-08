"use client";
import { useRef } from "react";
import { Button } from "@/components/ui/primitives";
import { Textarea } from "@/components/ui/forms";
export function RichTextInput({
  value,
  onChange,
  error,
  label = "Post text",
}: {
  value: string;
  onChange: (text: string) => void;
  error?: string;
  label?: string;
}) {
  const region = useRef<HTMLDivElement>(null);
  function format(before: string, after = before) {
    const textarea = region.current?.querySelector("textarea");
    if (!textarea) return;
    const start = textarea.selectionStart,
      end = textarea.selectionEnd;
    const selection = value.slice(start, end) || "text";
    if (
      value.length + before.length + after.length + (end === start ? 4 : 0) >
      5000
    )
      return;
    onChange(
      value.slice(0, start) + before + selection + after + value.slice(end),
    );
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selection.length,
      );
    });
  }
  return (
    <div ref={region}>
      <div
        className="composer-toolbar"
        role="group"
        aria-label="Post formatting"
      >
        <Button variant="secondary" onClick={() => format("**")}>
          Bold
        </Button>
        <Button variant="secondary" onClick={() => format("*")}>
          Italic
        </Button>
        <Button variant="secondary" onClick={() => format("\n- ", "")}>
          List item
        </Button>
      </div>
      <Textarea
        name="text"
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        maxLength={5000}
        rows={7}
        hint="Use **bold**, *italic* and lines starting with - for lists. Links and HTML remain literal text. Synthetic text only."
      />
      <p className="field-hint">{value.length} / 5,000 characters</p>
    </div>
  );
}
function Inline({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g)
        .map((part, i) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={i}>{part.slice(2, -2)}</strong>
          ) : part.startsWith("*") && part.endsWith("*") ? (
            <em key={i}>{part.slice(1, -1)}</em>
          ) : (
            part
          ),
        )}
    </>
  );
}
export function RichTextPreview({ text }: { text: string }) {
  const groups: { list: boolean; lines: string[] }[] = [];
  for (const line of text.split("\n")) {
    const list = line.startsWith("- ");
    if (groups.at(-1)?.list !== list) groups.push({ list, lines: [] });
    groups.at(-1)!.lines.push(list ? line.slice(2) : line);
  }
  return (
    <div className="rich-text-preview">
      {groups.map((group, i) =>
        group.list ? (
          <ul key={i}>
            {group.lines.map((line, j) => (
              <li key={j}>
                <Inline text={line} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <Inline text={group.lines.join("\n")} />
          </p>
        ),
      )}
    </div>
  );
}
