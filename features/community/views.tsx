import Link from "next/link";
import { Input, Textarea, Select } from "@/components/ui/forms";
import { ActionForm } from "./action-form";
import type { CommunityCard, CommunityDetail, BusinessPage } from "./contracts";
export function PreviewNotice() {
  return (
    <p className="discovery-notice">
      Development simulation · synthetic text only · changes are process-local.
      No connected community, notification, or moderation service. Do not enter
      personal or sensitive information.
    </p>
  );
}
export function CommunityListing({ cards }: { cards: CommunityCard[] }) {
  return (
    <>
      <h1>Find your people</h1>
      <p className="muted">Communities built around shared interests.</p>
      <PreviewNotice />
      <form action="/search">
        <Input label="Search communities" name="q" />
        <input type="hidden" name="filter" value="community" />
        <button className="button button-secondary">Search</button>
      </form>
      <div className="discovery-grid">
        {cards.map((c) => (
          <article className="card" key={c.id}>
            <p className="eyebrow">
              {c.visibility} · {c.membership}
            </p>
            <h2>
              <Link href={`/communities/${c.id}`}>{c.name}</Link>
            </h2>
            <p>{c.description}</p>
          </article>
        ))}
      </div>
      {!cards.length && <p>No communities are available.</p>}
      <section className="card">
        <h2>Create community</h2>
        <ActionForm base={{ operation: "create" }} label="Create community">
          <Input label="Community name" name="name" required maxLength={80} />
          <Textarea
            label="Description"
            name="description"
            required
            maxLength={280}
          />
          <Select label="Membership" name="visibility">
            <option value="public">Public · anyone can join</option>
            <option value="private">Private · approval required</option>
          </Select>
        </ActionForm>
      </section>
    </>
  );
}
export function CommunityView({ c }: { c: CommunityDetail }) {
  const base = { id: c.id, version: c.version };
  return (
    <>
      <Link href="/communities">All communities</Link>
      <h1>{c.name}</h1>
      <p>{c.description}</p>
      <PreviewNotice />
      <p>
        {c.visibility} community · {c.membership}
      </p>
      {c.membership === "none" ? (
        <ActionForm
          base={{ ...base, operation: "join" }}
          label={
            c.visibility === "private" ? "Request to join" : "Join community"
          }
        />
      ) : (
        <ActionForm
          base={{ ...base, operation: "leave" }}
          label={
            c.membership === "requested" ? "Cancel request" : "Leave community"
          }
        />
      )}
      <Link href={`/reports?kind=community&target=${c.id}`}>
        Report community
      </Link>
      {!c.canRead ? (
        <section className="card">
          <h2>Members only</h2>
          <p>
            Posts, topics, events, and discussions require approved membership.
          </p>
        </section>
      ) : (
        <>
          <section className="card">
            <h2>Topics</h2>
            <p>{c.topics.join(" · ")}</p>
            {c.canManage && (
              <ActionForm
                base={{ ...base, operation: "topic" }}
                label="Add topic"
              >
                <Input label="New topic" name="text" required maxLength={80} />
              </ActionForm>
            )}
          </section>
          <section className="card">
            <h2>Community posts</h2>
            {c.posts.map((p) => (
              <article key={p.id} id={p.id}>
                <p className="eyebrow">
                  {p.announcement ? "Announcement" : "Post"} · {p.topic}
                </p>
                <p>{p.text}</p>
                <Link href={`/reports?kind=content&target=${p.id}`}>
                  Report post
                </Link>
              </article>
            ))}
            {!c.posts.length && <p>No posts yet.</p>}
            {["member", "admin"].includes(c.membership) && (
              <ActionForm
                base={{ ...base, operation: "post", announcement: false }}
                label="Publish synthetic text"
              >
                <Textarea
                  label="Post text"
                  name="text"
                  required
                  maxLength={1200}
                />
                <Select label="Topic" name="topic">
                  {c.topics.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
                {c.canManage && (
                  <label>
                    <input type="checkbox" name="announcement" /> Announcement
                  </label>
                )}
              </ActionForm>
            )}
          </section>
          <section className="card">
            <h2>Events</h2>
            {c.events.map((e) => (
              <article key={e.id} id={e.id}>
                <h3>{e.title}</h3>
                <p>
                  {new Date(e.date).toLocaleString("en-GB", {
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </p>
                {["member", "admin"].includes(c.membership) && (
                  <>
                    <ActionForm
                      base={{
                        ...base,
                        operation: "rsvp",
                        eventId: e.id,
                        going: !e.going.length,
                      }}
                      label={e.going.length ? "Cancel RSVP" : "RSVP going"}
                    />
                    <h4>Event discussion</h4>
                    {e.discussions.map((d, i) => (
                      <p key={i}>{d.text}</p>
                    ))}
                    <ActionForm
                      base={{ ...base, operation: "discussion", eventId: e.id }}
                      label="Add discussion"
                    >
                      <Textarea
                        label="Discussion text"
                        name="text"
                        required
                        maxLength={1200}
                      />
                    </ActionForm>
                  </>
                )}
              </article>
            ))}
            {!c.events.length && <p>No events yet.</p>}
            {c.canManage && (
              <ActionForm
                base={{ ...base, operation: "event" }}
                label="Create event"
              >
                <Input label="Event title" name="text" required />
                <Input
                  label="Event date (ISO UTC)"
                  name="date"
                  placeholder="2026-12-12T10:00:00.000Z"
                  required
                />
              </ActionForm>
            )}
          </section>
        </>
      )}
      {c.canManage && (
        <section className="card">
          <h2>Member administration</h2>
          {c.members.map((m) => (
            <div key={m.id}>
              <p>
                {m.id} · {m.role}
              </p>
              {(["member", "admin", "none"] as const).map((role) => (
                <ActionForm
                  key={role}
                  base={{ ...base, operation: "member", targetId: m.id, role }}
                  label={
                    role === "none"
                      ? "Remove / reject"
                      : role === "admin"
                        ? "Make admin"
                        : "Approve / make member"
                  }
                />
              ))}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
export function BusinessPages({
  pages,
}: {
  pages: (BusinessPage & { canManage: boolean })[];
}) {
  return (
    <>
      <h1>Business pages</h1>
      <PreviewNotice />
      <div className="discovery-grid">
        {pages.map((p) => (
          <section key={p.id} id={p.id} className="card">
            <h2>{p.name}</h2>
            <p>{p.description}</p>
            {p.canManage && (
              <ActionForm
                base={{ operation: "page", id: p.id, version: p.version }}
                label="Save page"
              >
                <Input
                  label="Page name"
                  name="name"
                  defaultValue={p.name}
                  required
                />
                <Textarea
                  label="Page description"
                  name="description"
                  defaultValue={p.description}
                  required
                />
              </ActionForm>
            )}
          </section>
        ))}
      </div>
      <section className="card">
        <h2>Create a page</h2>
        <ActionForm
          base={{ operation: "page", version: 0 }}
          label="Create business page"
        >
          <Input label="Page name" name="name" required maxLength={80} />
          <Textarea
            label="Page description"
            name="description"
            required
            maxLength={280}
          />
        </ActionForm>
      </section>
    </>
  );
}
