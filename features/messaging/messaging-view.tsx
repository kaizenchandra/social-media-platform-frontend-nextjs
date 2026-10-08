"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import { MessageCircle, Send, Paperclip, Search } from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";
import {
  canSend,
  createPreviewState,
  MAX_ATTEMPTS,
  messagingReducer,
} from "./state";
import type { Attachment } from "./contracts";

export function MessagingView() {
  const [state, dispatch] = useReducer(
    messagingReducer,
    undefined,
    createPreviewState,
  );
  const [selected, setSelected] = useState("maya");
  const [inboxSearch, setInboxSearch] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [tab, setTab] = useState("inbox");
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [reply, setReply] = useState<string>();
  const [editing, setEditing] = useState<string>();
  const [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState("");
  const [fail, setFail] = useState(false);
  const [typing, setTyping] = useState(false);
  const [receipt, setReceipt] = useState<"sent" | "delivered" | "read">(
    "delivered",
  );
  const urls = useRef(new Set<string>());
  const sequence = useRef(6);
  const locked = useRef(false);
  const conversation = state.conversations.find((c) => c.id === selected)!;
  const allowed = canSend(state, selected);
  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  useEffect(() => {
    const offline = () =>
      dispatch({ type: "connection", connection: "offline" });
    const online = () =>
      dispatch({ type: "connection", connection: "connected" });
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    if (!navigator.onLine) offline();
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);
  // Only queued messages drain on reconnect. Failed sends require an explicit retry.
  useEffect(() => {
    if (state.connection !== "connected") return;
    const queued = state.messages.filter(
      (m) =>
        m.delivery === "queued" &&
        m.lifecycle === "active" &&
        canSend(state, m.conversationId),
    );
    const timer = setTimeout(
      () => queued.forEach((m) => dispatch({ type: "attempt", id: m.id })),
      0,
    );
    return () => clearTimeout(timer);
  }, [state]);
  useEffect(() => {
    if (state.connection !== "connected") return;
    const timers = state.messages
      .filter(
        (m) =>
          m.delivery === "sending" &&
          m.lifecycle === "active" &&
          canSend(state, m.conversationId),
      )
      .map((m) =>
        setTimeout(() => {
          dispatch({
            type: "ack",
            id: m.id,
            attempt: m.attempts,
            delivery: fail ? "failed" : receipt,
            serverId: `preview-${m.id}`,
          });
        }, 650),
      );
    return () => timers.forEach(clearTimeout);
  }, [state, fail, receipt]);
  useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(() => setTyping(false), 4000);
    return () => clearTimeout(timer);
  }, [typing]);
  function choose(id: string) {
    attachments.forEach((a) => {
      URL.revokeObjectURL(a.url);
      urls.current.delete(a.url);
    });
    setSelected(id);
    setDraft("");
    setAttachments([]);
    setReply(undefined);
    setEditing(undefined);
    setChatSearch("");
    setFilter("all");
    setTyping(false);
    setNotice("");
    dispatch({
      type: "conversation",
      conversationId: id,
      change: { unread: 0 },
    });
  }
  function send() {
    if (
      locked.current ||
      !allowed ||
      (!draft.trim() && !attachments.length) ||
      draft.length > 4000
    )
      return;
    locked.current = true;
    if (editing) dispatch({ type: "edit", id: editing, text: draft });
    else
      dispatch({
        type: "enqueue",
        message: {
          id: crypto.randomUUID(),
          conversationId: selected,
          sender: "self",
          sequence: sequence.current++,
          createdAt: new Date().toISOString(),
          text: draft.trim(),
          delivery: "queued",
          attempts: 0,
          retried: false,
          revision: 1,
          edited: false,
          lifecycle: "active",
          replyTo: reply,
          attachments,
          reactions: [],
          saved: false,
          pinned: false,
        },
      });
    setDraft("");
    setAttachments([]);
    setReply(undefined);
    setEditing(undefined);
    queueMicrotask(() => {
      locked.current = false;
    });
  }
  function attach(files: FileList | null) {
    if (!files || !allowed) return;
    const accepted: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (
        attachments.length + accepted.length >= 4 ||
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
        setNotice(
          "Use up to four PNG, JPEG, WebP, audio, PDF or text files, each under 10 MB.",
        );
        continue;
      }
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      accepted.push({
        id: crypto.randomUUID(),
        name: file.name,
        url,
        size: file.size,
        kind: file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("audio/")
            ? "audio"
            : "file",
      });
    }
    setAttachments((previous) => [...previous, ...accepted]);
  }
  const messages = state.messages.filter(
    (m) =>
      m.conversationId === selected &&
      (filter === "all" || (filter === "saved" ? m.saved : m.pinned)) &&
      (!chatSearch ||
        (m.lifecycle === "active" &&
          m.text.toLowerCase().includes(chatSearch.toLowerCase()))),
  );
  const replyMessage = state.messages.find((m) => m.id === reply);
  function preview(a: Attachment) {
    return (
      <div className="chat-attachment" key={a.id}>
        {a.kind === "image" ? (
          // Local object URLs must not go through a remote image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.url} alt={a.name} />
        ) : a.kind === "audio" ? (
          <audio controls src={a.url} aria-label={`Voice message: ${a.name}`} />
        ) : (
          <span>
            <Paperclip size={16} /> {a.name}
          </span>
        )}
        <small>
          {a.name} · {Math.ceil(a.size / 1024)} KB · local preview
        </small>
      </div>
    );
  }
  return (
    <>
      <div className="messages-title">
        <div>
          <p className="eyebrow">YOUR CONVERSATIONS</p>
          <h1>Messages</h1>
        </div>
        <MessageCircle aria-hidden="true" size={32} />
      </div>
      <p className="alert alert-warning">
        Development preview · Synthetic conversations, local to this tab. No
        messages or reports are sent. Unencrypted; no E2EE. Reload clears
        changes. Use synthetic content only.
      </p>
      <details className="messaging-simulation">
        <summary>Preview delivery and permission controls</summary>
        <div className="chat-tools">
          <label>
            Connection
            <select
              aria-label="Connection"
              value={state.connection}
              onChange={(e) =>
                dispatch({
                  type: "connection",
                  connection: e.target.value as typeof state.connection,
                })
              }
            >
              <option value="connected">Connected</option>
              <option value="offline">Offline</option>
              <option value="disconnected">Disconnected</option>
            </select>
          </label>
          <label>
            Simulated receipt
            <select
              aria-label="Simulated receipt"
              value={receipt}
              onChange={(e) => setReceipt(e.target.value as typeof receipt)}
            >
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="read">Read</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={fail}
              onChange={(e) => setFail(e.target.checked)}
            />{" "}
            Fail simulated sends
          </label>
          <Button
            variant="secondary"
            onClick={() =>
              dispatch({
                type: "permission",
                conversationId: selected,
                permitted: !conversation.permitted,
              })
            }
          >
            {conversation.permitted
              ? "Revoke permission"
              : "Restore permission"}
          </Button>
          <Button
            variant="secondary"
            disabled={!allowed}
            onClick={() => setTyping(true)}
          >
            Simulate peer typing
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              state.messages
                .filter(
                  (m) => m.conversationId === selected && m.sender === "self",
                )
                .forEach((m) =>
                  dispatch({
                    type: "ack",
                    id: m.id,
                    attempt: m.attempts,
                    delivery: receipt,
                    serverId: `preview-${m.id}`,
                  }),
                )
            }
          >
            Repeat acknowledgment
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const m = state.messages.findLast(
                (m) =>
                  m.conversationId === selected && m.lifecycle === "active",
              );
              if (m)
                dispatch({ type: "lifecycle", id: m.id, lifecycle: "expired" });
            }}
          >
            Expire latest message
          </Button>
        </div>
      </details>
      {state.connection !== "connected" && (
        <p role="status" className="alert alert-warning">
          {state.connection === "offline"
            ? "You’re offline"
            : "Connection lost"}
          . New messages stay queued. Reconnect to resume queued sends; failed
          messages need manual retry.
        </p>
      )}
      {notice && (
        <p role="status" className="alert">
          {notice}
        </p>
      )}
      <div className="messaging-layout">
        <aside className="conversation-inbox" aria-label="Conversation inbox">
          <label className="chat-search">
            <Search size={17} />
            <input
              aria-label="Search conversations"
              placeholder="Search people"
              value={inboxSearch}
              onChange={(e) => setInboxSearch(e.target.value)}
            />
          </label>
          <div className="chat-tools">
            {["inbox", "requests"].map((t) => (
              <Button
                key={t}
                variant={tab === t ? "primary" : "ghost"}
                onClick={() => setTab(t)}
              >
                {t === "inbox" ? "Inbox" : "Requests"}
              </Button>
            ))}
          </div>
          {state.conversations
            .filter(
              (c) =>
                c.request === (tab === "requests") &&
                c.name.toLowerCase().includes(inboxSearch.toLowerCase()),
            )
            .map((c) => (
              <button
                key={c.id}
                className={`conversation-row ${c.id === selected ? "selected" : ""}`}
                onClick={() => choose(c.id)}
                aria-pressed={c.id === selected}
              >
                <span className="chat-avatar">{c.initials}</span>
                <span>
                  <strong>{c.name}</strong>
                  <small>{c.blocked ? "Blocked" : c.subtitle}</small>
                </span>
                {c.unread > 0 && <Badge>{c.unread} unread</Badge>}
              </button>
            ))}
          {!state.conversations.some(
            (c) =>
              c.request === (tab === "requests") &&
              c.name.toLowerCase().includes(inboxSearch.toLowerCase()),
          ) && <p className="muted">No conversations found.</p>}
        </aside>
        <section
          className="chat-panel"
          aria-label={`Conversation with ${conversation.name}`}
        >
          <header className="chat-header">
            <span className="chat-avatar">{conversation.initials}</span>
            <div>
              <h2>{conversation.name}</h2>
              <small className="muted">
                One-to-one · local preview{conversation.muted ? " · muted" : ""}
              </small>
            </div>
            <Button
              variant="ghost"
              onClick={() => setSettings(!settings)}
              aria-expanded={settings}
            >
              Settings
            </Button>
          </header>
          {settings && (
            <div className="chat-settings">
              <h3>Conversation settings</h3>
              <div className="chat-tools">
                <Button
                  variant="secondary"
                  onClick={() =>
                    dispatch({
                      type: "conversation",
                      conversationId: selected,
                      change: { muted: !conversation.muted },
                    })
                  }
                >
                  {conversation.muted ? "Unmute" : "Mute"}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    dispatch({
                      type: "conversation",
                      conversationId: selected,
                      change: { blocked: !conversation.blocked },
                    });
                    setTyping(false);
                  }}
                >
                  {conversation.blocked ? "Unblock locally" : "Block locally"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    setNotice(
                      "Report service unavailable. No report has been submitted. For immediate danger, contact local emergency services.",
                    )
                  }
                >
                  Report
                </Button>
              </div>
              <p className="muted">
                Blocking affects only this local preview. No account enforcement
                or real report service is connected.
              </p>
            </div>
          )}
          <div className="chat-toolbar">
            <label className="chat-search">
              <Search size={16} />
              <input
                aria-label="Search this chat"
                placeholder="Search this chat"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
              />
            </label>
            <select
              aria-label="Message collection"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All messages</option>
              <option value="saved">Saved messages</option>
              <option value="pinned">Pinned messages</option>
            </select>
          </div>
          {conversation.request && (
            <div className="alert">
              <strong>Message request</strong>
              <p>Accept this synthetic request before replying.</p>
              <Button
                onClick={() =>
                  dispatch({
                    type: "conversation",
                    conversationId: selected,
                    change: { request: false, unread: 0 },
                  })
                }
                disabled={conversation.blocked || !conversation.permitted}
              >
                Accept request
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  dispatch({
                    type: "conversation",
                    conversationId: selected,
                    change: { blocked: true },
                  })
                }
              >
                Block request locally
              </Button>
            </div>
          )}
          {(!conversation.permitted || conversation.blocked) && (
            <p role="status" className="alert alert-warning">
              {conversation.blocked
                ? "This conversation is blocked locally."
                : "Messaging permission was revoked."}{" "}
              Sends, retries and message changes are paused.
            </p>
          )}
          <div
            className="message-history"
            role="log"
            aria-label="Message history"
            aria-live="polite"
          >
            <p className="chat-date">Synthetic conversation · October 9</p>
            {!messages.length && (
              <p className="empty-state">No messages in this view.</p>
            )}
            {messages.map((m) => {
              const original = state.messages.find(
                (item) => item.id === m.replyTo,
              );
              return (
                <article
                  key={m.id}
                  className={`message-row ${m.sender === "self" ? "outgoing" : "incoming"}`}
                  aria-label={`${m.sender === "self" ? "You" : conversation.name}: ${m.lifecycle === "active" ? m.text || "Attachment" : m.lifecycle}`}
                >
                  <div className="message-bubble">
                    {m.lifecycle !== "active" ? (
                      <em>Message {m.lifecycle}</em>
                    ) : (
                      <>
                        {original && (
                          <blockquote>
                            {original.lifecycle === "active"
                              ? original.text || "Attachment"
                              : "Original message unavailable"}
                          </blockquote>
                        )}
                        {m.text && <p>{m.text}</p>}
                        {m.attachments.map(preview)}
                        {m.reactions.length > 0 && (
                          <span className="message-reactions">
                            {m.reactions.join(" ")}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <small className="message-meta">
                    {new Date(m.createdAt).toLocaleTimeString("en", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "UTC",
                    })}{" "}
                    UTC {m.edited && "· Edited"} {m.retried && "· Retried"}{" "}
                    {m.saved && "· Saved"} {m.pinned && "· Pinned"}{" "}
                    {m.sender === "self" &&
                      `· ${m.delivery === "read" ? "Read (simulated)" : m.delivery}`}
                  </small>
                  {m.lifecycle === "active" && (
                    <div className="message-actions">
                      <Button
                        variant="ghost"
                        disabled={!allowed || !!editing}
                        onClick={() => setReply(m.id)}
                      >
                        Reply
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={!allowed}
                        aria-label={`React to message ${m.id}`}
                        onClick={() =>
                          dispatch({ type: "reaction", id: m.id, emoji: "❤️" })
                        }
                      >
                        ♡
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={!allowed}
                        onClick={() =>
                          dispatch({ type: "toggle", id: m.id, field: "saved" })
                        }
                      >
                        {m.saved ? "Unsave" : "Save"}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={!allowed}
                        onClick={() =>
                          dispatch({
                            type: "toggle",
                            id: m.id,
                            field: "pinned",
                          })
                        }
                      >
                        {m.pinned ? "Unpin" : "Pin"}
                      </Button>
                      {m.sender === "self" && (
                        <>
                          <Button
                            variant="ghost"
                            disabled={
                              !allowed ||
                              !["sent", "delivered", "read"].includes(
                                m.delivery,
                              )
                            }
                            onClick={() => {
                              setEditing(m.id);
                              setDraft(m.text);
                              setReply(undefined);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={!allowed}
                            onClick={() => {
                              dispatch({
                                type: "lifecycle",
                                id: m.id,
                                lifecycle: "deleted",
                              });
                              if (editing === m.id) {
                                setEditing(undefined);
                                setDraft("");
                              }
                              m.attachments.forEach((a) => {
                                URL.revokeObjectURL(a.url);
                                urls.current.delete(a.url);
                              });
                            }}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                      {m.delivery === "failed" && m.sender === "self" && (
                        <Button
                          variant="secondary"
                          disabled={
                            !allowed ||
                            state.connection !== "connected" ||
                            m.attempts >= MAX_ATTEMPTS
                          }
                          onClick={() =>
                            dispatch({ type: "attempt", id: m.id })
                          }
                        >
                          {m.attempts >= MAX_ATTEMPTS
                            ? "Retry limit reached"
                            : `Retry (${m.attempts}/${MAX_ATTEMPTS})`}
                        </Button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <div className="chat-typing" role="status">
            {typing && allowed
              ? `${conversation.name} is typing… (simulated)`
              : ""}
          </div>
          <form
            method="post"
            className="message-composer"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            {(replyMessage || editing) && (
              <div className="reply-preview">
                <span>
                  {editing
                    ? "Editing message"
                    : `Replying to: ${replyMessage?.lifecycle === "active" ? replyMessage.text || "Attachment" : "Unavailable message"}`}
                </span>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setReply(undefined);
                    setEditing(undefined);
                    setDraft("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
            <div className="composer-attachments">
              {attachments.map((a) => (
                <div key={a.id}>
                  {preview(a)}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setAttachments((items) =>
                        items.filter((item) => item.id !== a.id),
                      );
                      URL.revokeObjectURL(a.url);
                      urls.current.delete(a.url);
                    }}
                  >
                    Remove {a.name}
                  </Button>
                </div>
              ))}
            </div>
            <label className="sr-only" htmlFor="message-text">
              Message
            </label>
            <textarea
              id="message-text"
              placeholder={
                allowed ? "Write a message…" : "Messaging unavailable"
              }
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={4000}
              disabled={!allowed}
              rows={2}
            />
            <div className="chat-tools">
              <label className="attachment-picker">
                <Paperclip size={17} /> Attach / voice audio
                <input
                  aria-label="Message attachments or voice audio"
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/wav,audio/webm,application/pdf,text/plain"
                  disabled={!allowed || !!editing}
                  onChange={(e) => {
                    attach(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <small className="muted">
                {draft.length}/4000 · Audio files stay local; recording
                unavailable
              </small>
              <Button
                type="submit"
                disabled={!allowed || (!draft.trim() && !attachments.length)}
              >
                <Send size={16} />{" "}
                {editing
                  ? "Save edit"
                  : state.connection === "connected"
                    ? "Send locally"
                    : "Queue locally"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
