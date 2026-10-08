"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Users, Plus, Search } from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";
import type { Attachment } from "@/features/messaging/contracts";
import type { Group, GroupCommand, GroupOperation } from "./contracts";
import { people } from "./contracts";
import {
  createGroupPreview,
  executeGroup,
  isAdmin,
  member,
  permitted,
  projectGroup,
} from "./state";
type Run = (operation: GroupOperation, id?: string) => boolean;
const personName = (id: string) => people.find((p) => p.id === id)?.name ?? id;
export function GroupView() {
  const [state, setState] = useState(createGroupPreview);
  const store = useRef(state);
  const [actor, setActor] = useState("self");
  const [selected, setSelected] = useState("garden");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const registry = urls.current;
    return () => registry.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  const group = state.groups.find((g) => g.id === selected);
  const visible = group ? projectGroup(group, actor) : null;
  const membership = group ? member(group, actor) : undefined;
  function apply(command: GroupCommand) {
    const result = executeGroup(store.current, command);
    store.current = result.state;
    setState(result.state);
    setNotice(
      result.ok
        ? command.operation.type === "invite" && command.operation.fail
          ? "Simulated invitation failed. No membership granted. Retry from Members."
          : "Local preview updated."
        : result.message,
    );
    return result.ok;
  }
  const run: Run = (operation, id = crypto.randomUUID()) =>
    apply({
      id,
      actor,
      groupId: selected,
      revision: group?.revision ?? 0,
      operation,
    });
  return (
    <>
      <div className="messages-title">
        <div>
          <p className="eyebrow">MAKE ROOM FOR EVERYONE</p>
          <h1>Group conversations</h1>
        </div>
        <Users aria-hidden="true" size={32} />
      </div>
      <p className="alert alert-warning">
        Development preview · Synthetic groups and content stay in this tab;
        reload clears changes. No invitations, messages, reminders or reports
        are sent. No encryption implementation is connected. Use synthetic
        content only.
      </p>
      <div className="group-topbar">
        <Link href="/messages">Personal messages</Link>
        <Button onClick={() => setCreating(!creating)} aria-expanded={creating}>
          <Plus size={16} /> Create group
        </Button>
      </div>
      <details className="messaging-simulation">
        <summary>Preview membership controls</summary>
        <div className="chat-tools">
          <label>
            View as synthetic participant
            <select
              aria-label="Preview participant"
              value={actor}
              onChange={(e) => {
                setActor(e.target.value);
                setNotice("");
              }}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="danger"
            disabled={
              !group ||
              !isAdmin(group, "maya") ||
              actor === "maya" ||
              membership?.status !== "active"
            }
            onClick={() =>
              apply({
                id: crypto.randomUUID(),
                actor: "maya",
                groupId: selected,
                revision: store.current.groups.find((g) => g.id === selected)!
                  .revision,
                operation: { type: "remove", userId: actor },
              })
            }
          >
            Simulate removal by Maya
          </Button>
        </div>
        <p className="muted">
          This changes local membership while the conversation is open. These
          controls do not impersonate real accounts.
        </p>
      </details>
      {notice && (
        <p className="alert" role="status">
          {notice}
        </p>
      )}
      {creating && (
        <form
          method="post"
          className="card group-create"
          onSubmit={(e) => {
            e.preventDefault();
            const id = crypto.randomUUID();
            if (
              apply({
                id: crypto.randomUUID(),
                actor,
                groupId: id,
                revision: 0,
                operation: { type: "create", name, description },
              })
            ) {
              setSelected(id);
              setCreating(false);
              setName("");
              setDescription("");
            }
          }}
        >
          <h2>Start a private group preview</h2>
          <label>
            Group name
            <input
              aria-label="New group name"
              value={name}
              maxLength={80}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Description
            <textarea
              aria-label="New group description"
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <p className="muted">
            You start as administrator. Invitees must accept before accessing
            new content.
          </p>
          <Button type="submit">Create locally</Button>
        </form>
      )}
      <div className="messaging-layout group-layout">
        <aside className="conversation-inbox" aria-label="Group inbox">
          <label className="chat-search">
            <Search size={16} />
            <input
              aria-label="Find groups"
              placeholder="Find your groups"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {state.groups
            .filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
            .map((g) => (
              <button
                key={g.id}
                className={`conversation-row ${g.id === selected ? "selected" : ""}`}
                aria-pressed={g.id === selected}
                onClick={() => {
                  setSelected(g.id);
                  setNotice("");
                }}
              >
                <span className="chat-avatar">
                  <Users size={20} />
                </span>
                <span>
                  <strong>{g.name}</strong>
                  <small>
                    {member(g, actor)?.status ?? "Not a member"} ·{" "}
                    {g.members.filter((m) => m.status === "active").length}{" "}
                    members
                  </small>
                </span>
              </button>
            ))}
          {!state.groups.some((g) =>
            g.name.toLowerCase().includes(search.toLowerCase()),
          ) && <p>No groups found.</p>}
        </aside>
        {group && visible ? (
          <GroupWorkspace
            key={`${group.id}:${actor}`}
            group={visible}
            actor={actor}
            run={run}
            registerUrl={(url) => urls.current.add(url)}
          />
        ) : (
          <section
            className="group-access"
            key={`${selected}:${actor}:restricted`}
          >
            <h2>{group?.name ?? "Group unavailable"}</h2>
            <p role="status">
              {membership?.status === "removed"
                ? "You were removed. Group messages, files, polls and collaboration are no longer accessible."
                : membership?.status === "left"
                  ? "You left this group. Its content is no longer accessible."
                  : membership?.status === "invited"
                    ? "You have a local invitation. Accept to see content shared from the time you join."
                    : membership?.status === "requested"
                      ? "Your membership request is awaiting administrator approval."
                      : "Membership is required to access this group."}
            </p>
            {membership?.status === "invited" ? (
              <Button onClick={() => run({ type: "accept" })}>
                Accept local invitation
              </Button>
            ) : (
              !["removed", "requested"].includes(membership?.status ?? "") && (
                <Button onClick={() => run({ type: "request" })}>
                  Request membership locally
                </Button>
              )
            )}
          </section>
        )}
      </div>
    </>
  );
}
function GroupWorkspace({
  group,
  actor,
  run,
  registerUrl,
}: {
  group: Group;
  actor: string;
  run: Run;
  registerUrl: (url: string) => void;
}) {
  const [tab, setTab] = useState("chat");
  const [channel, setChannel] = useState("general");
  const [search, setSearch] = useState("");
  const [pinned, setPinned] = useState(false);
  const [thread, setThread] = useState<string>();
  const admin = isAdmin(group, actor);
  const own = member(group, actor)!;
  const currentChannel = group.channels.find((c) => c.id === channel)!;
  const matchesSearch = (m: Group["messages"][number]) =>
    m.text.toLowerCase().includes(search.toLowerCase()) ||
    m.attachments.some((a) =>
      a.name.toLowerCase().includes(search.toLowerCase()),
    );
  const roots = group.messages.filter((m) => {
    const replies = group.messages.filter((r) => r.parentId === m.id);
    return (
      !m.parentId &&
      (search || pinned || m.channelId === channel) &&
      (!pinned || m.pinned || replies.some((r) => r.pinned)) &&
      (!search || matchesSearch(m) || replies.some(matchesSearch))
    );
  });
  const parent = group.messages.find((m) => m.id === thread);
  return (
    <section
      className="chat-panel"
      aria-label={`Group workspace: ${group.name}`}
    >
      <header className="chat-header">
        <span className="chat-avatar">
          <Users size={20} />
        </span>
        <div>
          <h2>{group.name}</h2>
          <small>
            {own.role} ·{" "}
            {group.members.filter((m) => m.status === "active").length} members
          </small>
        </div>
        <label>
          Notifications
          <select
            aria-label="Group notifications"
            value={own.notifications}
            onChange={(e) =>
              run({
                type: "notifications",
                value: e.target.value as typeof own.notifications,
              })
            }
          >
            <option value="all">All activity</option>
            <option value="mentions">Mentions only</option>
            <option value="none">Muted</option>
          </select>
        </label>
      </header>
      <nav className="group-tabs" aria-label="Group sections">
        {[
          "chat",
          "members",
          "details",
          "polls",
          "files",
          "media",
          "collaboration",
        ].map((t) => (
          <Button
            key={t}
            variant={t === tab ? "primary" : "ghost"}
            aria-pressed={t === tab}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </nav>
      {tab === "chat" && (
        <>
          <div className="chat-toolbar">
            <label>
              Topic
              <select
                aria-label="Conversation topic"
                value={channel}
                onChange={(e) => {
                  setChannel(e.target.value);
                  setThread(undefined);
                }}
              >
                {group.channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.kind === "announcements" ? " · admin announcements" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="chat-search">
              <Search size={16} />
              <input
                aria-label="Search group content"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages and file names"
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />{" "}
              Pinned only
            </label>
          </div>
          {currentChannel.kind === "announcements" && (
            <p className="group-hint">
              Announcement channel · only administrators may post or reply.
            </p>
          )}
          <div
            className="message-history group-history"
            role="log"
            aria-label="Group message history"
            aria-live="polite"
          >
            {!roots.length && (
              <p className="empty-state">
                No accessible messages in this view.
              </p>
            )}
            {roots.map((m) => (
              <article
                className={`message-row ${m.senderId === actor ? "outgoing" : "incoming"}`}
                key={m.id}
              >
                <small>
                  {personName(m.senderId)} · #{m.sequence}
                  {m.pinned ? " · Pinned" : ""}
                </small>
                <div className="message-bubble">
                  <p>{m.text}</p>
                  {m.mentions.length > 0 && (
                    <p className="group-mentions">
                      Mentions: {m.mentions.map(personName).join(", ")}
                    </p>
                  )}
                  {m.attachments.map((a) => (
                    <FilePreview key={a.id} attachment={a} />
                  ))}
                </div>
                <div className="message-actions">
                  <Button variant="ghost" onClick={() => setThread(m.id)}>
                    Thread (
                    {group.messages.filter((r) => r.parentId === m.id).length})
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={!admin}
                    onClick={() => run({ type: "pin", messageId: m.id })}
                  >
                    {m.pinned ? "Unpin" : "Pin"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
          {parent ? (
            <section className="group-thread" aria-label="Reply thread">
              <div className="chat-tools">
                <h3>Thread</h3>
                <Button variant="ghost" onClick={() => setThread(undefined)}>
                  Close thread
                </Button>
              </div>
              <blockquote>{parent.text || "Attachment"}</blockquote>
              {group.messages
                .filter((m) => m.parentId === parent.id)
                .map((m) => (
                  <div className="thread-reply" key={m.id}>
                    <strong>{personName(m.senderId)}</strong>
                    <p>{m.text}</p>
                    {m.attachments.map((a) => (
                      <FilePreview key={a.id} attachment={a} />
                    ))}
                  </div>
                ))}
              <GroupComposer
                key={`${channel}:${thread}`}
                group={group}
                actor={actor}
                channelId={parent.channelId}
                parentId={thread}
                run={run}
                registerUrl={registerUrl}
              />
            </section>
          ) : (
            <GroupComposer
              key={channel}
              group={group}
              actor={actor}
              channelId={channel}
              run={run}
              registerUrl={registerUrl}
            />
          )}
        </>
      )}
      {tab === "members" && (
        <MemberPanel group={group} actor={actor} run={run} />
      )}
      {tab === "details" && (
        <DetailsPanel
          key={group.revision}
          group={group}
          actor={actor}
          run={run}
        />
      )}
      {tab === "polls" && <PollPanel group={group} actor={actor} run={run} />}
      {(tab === "files" || tab === "media") && (
        <div className="group-content">
          <h3>Shared {tab}</h3>
          <p className="muted">
            Only content in your permitted history is shown. Previews stay
            local.
          </p>
          <div className="group-file-grid">
            {group.messages.flatMap((m) =>
              m.attachments
                .filter((a) =>
                  tab === "media" ? a.kind !== "file" : a.kind === "file",
                )
                .map((a) => (
                  <div className="card group-file" key={a.id}>
                    <FilePreview attachment={a} />
                    <small>
                      Shared by {personName(m.senderId)} · #{m.sequence}
                    </small>
                  </div>
                )),
            )}
          </div>
          {!group.messages.some((m) =>
            m.attachments.some((a) =>
              tab === "media" ? a.kind !== "file" : a.kind === "file",
            ),
          ) && <p className="empty-state">No accessible shared {tab}.</p>}
        </div>
      )}
      {tab === "collaboration" && (
        <CollaborationPanel group={group} actor={actor} run={run} />
      )}
    </section>
  );
}
function FilePreview({ attachment: a }: { attachment: Attachment }) {
  return (
    <div className="chat-attachment">
      {a.kind === "image" ? (
        // Blob URLs remain local and must not be passed to an image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.url} alt={a.name} />
      ) : a.kind === "audio" ? (
        <audio aria-label={`Local audio: ${a.name}`} controls src={a.url} />
      ) : (
        <a href={a.url} download={a.name}>
          Download local file: {a.name}
        </a>
      )}
      <small>
        {a.name} · {Math.ceil(a.size / 1024)} KB · local preview
      </small>
    </div>
  );
}
function GroupComposer({
  group,
  actor,
  channelId,
  parentId,
  run,
  registerUrl,
}: {
  group: Group;
  actor: string;
  channelId: string;
  parentId?: string;
  run: Run;
  registerUrl: (url: string) => void;
}) {
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [fail, setFail] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<string | undefined>(undefined);
  const unsentUrls = useRef(new Set<string>());
  useEffect(() => {
    const registry = unsentUrls.current;
    return () => registry.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  const allowed =
    permitted(group, actor, "post") &&
    (group.channels.find((c) => c.id === channelId)?.kind !== "announcements" ||
      isAdmin(group, actor));
  return (
    <form
      method="post"
      className="message-composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        request.current ??= crypto.randomUUID();
        if (
          run(
            {
              type: "send",
              channelId,
              parentId,
              text,
              mentions,
              attachments,
              fail,
            },
            request.current,
          )
        ) {
          unsentUrls.current.clear();
          setText("");
          setMentions([]);
          setAttachments([]);
          request.current = undefined;
        }
      }}
    >
      <label>
        {parentId ? "Thread reply" : "Group message"}
        <textarea
          aria-label={parentId ? "Thread reply" : "Group message"}
          rows={2}
          disabled={!allowed}
          value={text}
          maxLength={4000}
          placeholder={
            allowed ? "Share a thought…" : "Only administrators may post here"
          }
          onChange={(e) => {
            setText(e.target.value);
            request.current = undefined;
          }}
        />
      </label>
      <div className="chat-tools">
        <label>
          Mention
          <select
            aria-label="Mention member"
            disabled={!allowed}
            value=""
            onChange={(e) => {
              if (e.target.value) {
                setMentions((ids) => [...new Set([...ids, e.target.value])]);
                setText(
                  (t) => `${t}${t ? " " : ""}@${personName(e.target.value)} `,
                );
                request.current = undefined;
              }
            }}
          >
            <option value="">Choose a member</option>
            {group.members
              .filter((m) => m.status === "active" && m.userId !== actor)
              .map((m) => (
                <option key={m.userId} value={m.userId}>
                  {personName(m.userId)}
                </option>
              ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={fail}
            onChange={(e) => setFail(e.target.checked)}
          />{" "}
          Simulate failed send
        </label>
        <small>{text.length}/4000</small>
      </div>
      <div className="composer-attachments">
        {attachments.map((a) => (
          <div key={a.id}>
            <FilePreview attachment={a} />
            <Button
              variant="ghost"
              onClick={() => {
                setAttachments((items) => items.filter((i) => i.id !== a.id));
                URL.revokeObjectURL(a.url);
                unsentUrls.current.delete(a.url);
                request.current = undefined;
              }}
            >
              Remove {a.name}
            </Button>
          </div>
        ))}
      </div>
      <label className="attachment-picker">
        Shared files / media
        <input
          aria-label="Group attachments"
          type="file"
          multiple
          disabled={!allowed || !group.permissions.attachments}
          accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/wav,audio/webm,application/pdf,text/plain"
          onChange={(e) => {
            const additions: Attachment[] = [];
            for (const file of Array.from(e.target.files ?? [])) {
              if (
                attachments.length + additions.length >= 4 ||
                file.size > 10 * 1024 * 1024 ||
                ![
                  "image/png",
                  "image/jpeg",
                  "image/webp",
                  "audio/mpeg",
                  "audio/wav",
                  "audio/webm",
                  "application/pdf",
                  "text/plain",
                ].includes(file.type)
              ) {
                setError(
                  "Choose at most four supported image, audio, PDF or text files under 10 MB each.",
                );
                continue;
              }
              const url = URL.createObjectURL(file);
              registerUrl(url);
              unsentUrls.current.add(url);
              additions.push({
                id: crypto.randomUUID(),
                name: file.name,
                size: file.size,
                url,
                kind: file.type.startsWith("image/")
                  ? "image"
                  : file.type.startsWith("audio/")
                    ? "audio"
                    : "file",
              });
            }
            setAttachments((items) => [...items, ...additions]);
            request.current = undefined;
            e.target.value = "";
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <p className="muted">
        Local preview only. Failed drafts remain here for manual retry; no
        automatic send loop.
      </p>
      <Button
        type="submit"
        disabled={!allowed || (!text.trim() && !attachments.length)}
      >
        {parentId ? "Reply locally" : "Send to group locally"}
      </Button>
    </form>
  );
}
function MemberPanel({
  group,
  actor,
  run,
}: {
  group: Group;
  actor: string;
  run: Run;
}) {
  const admin = isAdmin(group, actor);
  const [target, setTarget] = useState("noah");
  const [fail, setFail] = useState(false);
  return (
    <div className="group-content">
      <h3>Members and requests</h3>
      <p className="muted">
        New and rejoining members see content shared after their join. Removed
        members lose the complete group view immediately.
      </p>
      <form
        method="post"
        className="group-form"
        onSubmit={(e) => {
          e.preventDefault();
          run({ type: "invite", userId: target, fail });
        }}
      >
        <label>
          Invite participant
          <select
            aria-label="Invite participant"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={!permitted(group, actor, "invite")}
          >
            {people
              .filter((p) => p.id !== actor)
              .map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={fail}
            onChange={(e) => setFail(e.target.checked)}
          />{" "}
          Simulate failed invitation
        </label>
        <Button type="submit" disabled={!permitted(group, actor, "invite")}>
          Invite locally
        </Button>
      </form>
      <ul className="group-members">
        {group.members.map((m) => (
          <li key={m.userId}>
            <div>
              <strong>{personName(m.userId)}</strong> <Badge>{m.status}</Badge>
              {m.status === "active" && <small> · {m.role}</small>}
            </div>
            <div className="chat-tools">
              {m.status === "active" && (
                <>
                  <Button
                    variant="secondary"
                    disabled={!admin}
                    onClick={() =>
                      run({
                        type: "role",
                        userId: m.userId,
                        role: m.role === "admin" ? "member" : "admin",
                      })
                    }
                  >
                    {m.role === "admin" ? "Make member" : "Make admin"}
                  </Button>
                  <Button
                    variant="danger"
                    disabled={!admin}
                    onClick={() => run({ type: "remove", userId: m.userId })}
                  >
                    Remove {personName(m.userId)}
                  </Button>
                </>
              )}
              {m.status === "requested" && (
                <>
                  <Button
                    disabled={!admin}
                    onClick={() => run({ type: "approve", userId: m.userId })}
                  >
                    Approve {personName(m.userId)}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!admin}
                    onClick={() => run({ type: "reject", userId: m.userId })}
                  >
                    Reject {personName(m.userId)}
                  </Button>
                </>
              )}
              {m.status === "failed" && (
                <Button
                  disabled={!permitted(group, actor, "invite")}
                  onClick={() =>
                    run({ type: "invite", userId: m.userId, fail: false })
                  }
                >
                  Retry invitation to {personName(m.userId)}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Button variant="danger" onClick={() => run({ type: "leave" })}>
        Leave group locally
      </Button>
      <h4>Membership history</h4>
      {group.audit.length ? (
        group.audit.map((a) => <p key={a.sequence}>{a.text}</p>)
      ) : (
        <p className="muted">No changes since your join.</p>
      )}
    </div>
  );
}
function DetailsPanel({
  group,
  actor,
  run,
}: {
  group: Group;
  actor: string;
  run: Run;
}) {
  const admin = isAdmin(group, actor);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [permissions, setPermissions] = useState(group.permissions);
  const [topic, setTopic] = useState("");
  const [kind, setKind] = useState<"topic" | "announcements">("topic");
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState("");
  const [prepared, setPrepared] = useState(false);
  return (
    <div className="group-content">
      <h3>Group details</h3>
      <form
        method="post"
        className="group-form"
        onSubmit={(e) => {
          e.preventDefault();
          run({ type: "details", name, description });
        }}
      >
        <label>
          Name
          <input
            aria-label="Group display name"
            value={name}
            disabled={!admin}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label>
          Description
          <textarea
            aria-label="Group description"
            value={description}
            maxLength={500}
            disabled={!admin}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <Button type="submit" disabled={!admin}>
          Save details locally
        </Button>
      </form>
      <h3>Group permissions</h3>
      <form
        method="post"
        className="group-form"
        onSubmit={(e) => {
          e.preventDefault();
          run({ type: "permissions", permissions });
        }}
      >
        {(["invite", "post", "collaborate"] as const).map((key) => (
          <label key={key}>
            Who can {key}?
            <select
              aria-label={`Permission to ${key}`}
              disabled={!admin}
              value={permissions[key]}
              onChange={(e) =>
                setPermissions((p) => ({
                  ...p,
                  [key]: e.target.value as "admin" | "everyone",
                }))
              }
            >
              <option value="admin">Administrators</option>
              <option value="everyone">All active members</option>
            </select>
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={permissions.attachments}
            disabled={!admin}
            onChange={(e) =>
              setPermissions((p) => ({ ...p, attachments: e.target.checked }))
            }
          />{" "}
          Allow shared files and media
        </label>
        <Button type="submit" disabled={!admin}>
          Save permissions locally
        </Button>
      </form>
      <h3>Topics and announcements</h3>
      <form
        method="post"
        className="group-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (run({ type: "channel", name: topic, kind })) setTopic("");
        }}
      >
        <label>
          Channel name
          <input
            aria-label="New channel name"
            value={topic}
            maxLength={60}
            required
            disabled={!admin}
            onChange={(e) => setTopic(e.target.value)}
          />
        </label>
        <label>
          Channel type
          <select
            aria-label="New channel type"
            disabled={!admin}
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="topic">Topic conversation</option>
            <option value="announcements">Administrator announcements</option>
          </select>
        </label>
        <Button type="submit" disabled={!admin}>
          Create channel locally
        </Button>
      </form>
      <h3>Group reporting</h3>
      <Button
        variant="secondary"
        onClick={() => setReport(!report)}
        aria-expanded={report}
      >
        Prepare report note
      </Button>
      {report && (
        <form
          method="post"
          className="group-form"
          onSubmit={(e) => {
            e.preventDefault();
            setPrepared(true);
          }}
        >
          <label>
            Report reason
            <textarea
              aria-label="Group report reason"
              value={reason}
              required
              maxLength={1000}
              onChange={(e) => {
                setReason(e.target.value);
                setPrepared(false);
              }}
            />
          </label>
          <Button type="submit" disabled={!reason.trim()}>
            Prepare unsent note
          </Button>
          {prepared && (
            <p role="status">
              Local report note prepared. No report was submitted; reporting
              service unavailable.
            </p>
          )}
          <Button disabled>Submit report (service unavailable)</Button>
        </form>
      )}
    </div>
  );
}
function PollPanel({
  group,
  actor,
  run,
}: {
  group: Group;
  actor: string;
  run: Run;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState("");
  return (
    <div className="group-content">
      <h3>Polls and decisions</h3>
      {group.polls.map((p) => (
        <section className="card group-poll" aria-label={p.question} key={p.id}>
          <h4>{p.question}</h4>
          <p className="muted">
            {p.closed ? "Closed" : "Open"} · One vote per active participant;
            you can change yours.
          </p>
          {p.options.map((option, index) => (
            <Button
              key={index}
              variant={p.votes[actor] === index ? "primary" : "secondary"}
              disabled={p.closed}
              aria-pressed={p.votes[actor] === index}
              onClick={() => run({ type: "vote", pollId: p.id, option: index })}
            >
              {option} ·{" "}
              {
                Object.entries(p.votes).filter(
                  ([id, v]) =>
                    v === index && member(group, id)?.status === "active",
                ).length
              }{" "}
              votes
            </Button>
          ))}
          <Button
            variant="ghost"
            disabled={!isAdmin(group, actor) || p.closed}
            onClick={() => run({ type: "close-poll", pollId: p.id })}
          >
            Close poll
          </Button>
        </section>
      ))}
      {!group.polls.length && <p>No accessible polls.</p>}
      <form
        method="post"
        className="group-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (run({ type: "poll", question, options: options.split("\n") })) {
            setQuestion("");
            setOptions("");
          }
        }}
      >
        <h4>Create a poll</h4>
        <label>
          Question
          <input
            aria-label="Poll question"
            value={question}
            maxLength={200}
            required
            disabled={!permitted(group, actor, "collaborate")}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>
        <label>
          Options, one per line
          <textarea
            aria-label="Poll options"
            value={options}
            required
            disabled={!permitted(group, actor, "collaborate")}
            onChange={(e) => setOptions(e.target.value)}
          />
        </label>
        <Button
          type="submit"
          disabled={!permitted(group, actor, "collaborate")}
        >
          Create poll locally
        </Button>
      </form>
    </div>
  );
}
function CollaborationPanel({
  group,
  actor,
  run,
}: {
  group: Group;
  actor: string;
  run: Run;
}) {
  const [kind, setKind] = useState<"note" | "task" | "reminder" | "event">(
    "note",
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const [editing, setEditing] = useState<{ id: string; revision: number }>();
  const allowed = permitted(group, actor, "collaborate");
  function reset() {
    setTitle("");
    setBody("");
    setAssignee("");
    setDue("");
    setEditing(undefined);
  }
  return (
    <div className="group-content">
      <h3>Plan together</h3>
      <p className="muted">
        Notes, assigned tasks, shared reminders and events are local planning
        items. Reminders do not trigger notifications or run in the background.
      </p>
      <div className="group-collaboration">
        {group.collaboration.map((item) => (
          <article className="card group-item" key={item.id}>
            <Badge>{item.kind}</Badge>
            <h4>{item.title}</h4>
            <p className="shared-note-body">{item.body}</p>
            {item.assignee && <p>Assigned to {personName(item.assignee)}</p>}
            {item.due && <p>Planned for {item.due.replace("T", " ")}</p>}
            <div className="chat-tools">
              {["task", "reminder"].includes(item.kind) && (
                <Button
                  variant="secondary"
                  disabled={!allowed}
                  onClick={() => run({ type: "complete", itemId: item.id })}
                >
                  {item.completed ? "Mark incomplete" : "Mark complete"}
                </Button>
              )}
              {item.kind === "event" && (
                <>
                  <span>
                    {
                      item.attendees.filter(
                        (id) => member(group, id)?.status === "active",
                      ).length
                    }{" "}
                    attending
                  </span>
                  <Button
                    variant="secondary"
                    disabled={!allowed}
                    onClick={() => run({ type: "rsvp", itemId: item.id })}
                  >
                    {item.attendees.includes(actor)
                      ? "Cancel RSVP"
                      : "RSVP locally"}
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                disabled={!allowed}
                onClick={() => {
                  setEditing({ id: item.id, revision: item.revision });
                  setKind(item.kind);
                  setTitle(item.title);
                  setBody(item.body);
                  setAssignee(item.assignee ?? "");
                  setDue(item.due ?? "");
                }}
              >
                Edit shared item
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!group.collaboration.length && <p>No accessible shared items yet.</p>}
      <form
        method="post"
        className="group-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            run({
              type: "collaboration",
              itemId: editing?.id,
              itemRevision: editing?.revision,
              kind,
              title,
              body,
              assignee: assignee || undefined,
              due: due || undefined,
            })
          )
            reset();
        }}
      >
        <h4>{editing ? "Edit shared item" : "Add a shared item"}</h4>
        <label>
          Item type
          <select
            aria-label="Shared item type"
            value={kind}
            disabled={!allowed || !!editing}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="note">Shared note</option>
            <option value="task">Task</option>
            <option value="reminder">Reminder</option>
            <option value="event">Group event</option>
          </select>
        </label>
        <label>
          Title
          <input
            aria-label="Shared item title"
            value={title}
            required
            maxLength={120}
            disabled={!allowed}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Details
          <textarea
            aria-label="Shared item details"
            value={body}
            maxLength={4000}
            disabled={!allowed}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        {kind === "task" && (
          <label>
            Assign to
            <select
              aria-label="Task assignee"
              disabled={!allowed}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Unassigned</option>
              {group.members
                .filter((m) => m.status === "active")
                .map((m) => (
                  <option value={m.userId} key={m.userId}>
                    {personName(m.userId)}
                  </option>
                ))}
            </select>
          </label>
        )}
        {kind !== "note" && (
          <label>
            Planned date and time (local)
            <input
              aria-label="Shared item date"
              type="datetime-local"
              required={kind !== "task"}
              value={due}
              disabled={!allowed}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
        )}
        <Button type="submit" disabled={!allowed}>
          {editing ? "Save shared item locally" : "Add shared item locally"}
        </Button>
        {editing && (
          <Button variant="ghost" onClick={reset}>
            Cancel shared edit
          </Button>
        )}
      </form>
    </div>
  );
}
