import Link from "next/link";
import { Input, Select, Textarea } from "@/components/ui/forms";
import { ActionForm } from "@/features/community/action-form";
import { PreviewNotice } from "@/features/community/views";
import type { Privacy, CaseView, Audit } from "./contracts";
export function PrivacyView({
  p,
  blocked,
}: {
  p: Privacy;
  blocked: { id: string; displayName: string }[];
}) {
  return (
    <>
      <h1>Privacy dashboard</h1>
      <PreviewNotice />
      <section className="card">
        <h2>Audience and discoverability</h2>
        <ActionForm
          trust
          base={{ operation: "privacy", ...p }}
          label="Save privacy settings"
        >
          <Select
            label="Profile audience"
            name="audience"
            defaultValue={p.audience}
          >
            <option value="public">Public</option>
            <option value="friends">Friends</option>
            <option value="private">Private</option>
          </Select>
          <label>
            <input
              name="discoverable"
              type="checkbox"
              defaultChecked={p.discoverable}
            />{" "}
            Appear in people search
          </label>
          <h3>Security preferences</h3>
          <p className="muted">
            Preferences only. Notification delivery is unavailable.
          </p>
          <label>
            <input
              name="loginAlerts"
              type="checkbox"
              defaultChecked={p.loginAlerts}
            />{" "}
            Login alerts preference
          </label>
          <label>
            <input
              name="sessionReviewReminder"
              type="checkbox"
              defaultChecked={p.sessionReviewReminder}
            />{" "}
            Session review reminders
          </label>
        </ActionForm>
        <Link href="/account">Review active sessions and security</Link>
      </section>
      <section className="card">
        <h2>Blocked accounts</h2>
        {blocked.length ? (
          blocked.map((b) => <p key={b.id}>{b.displayName}</p>)
        ) : (
          <p>No blocked accounts.</p>
        )}
        <Link href="/connections">Manage blocks and connections</Link>
      </section>
      <Link href="/reports">Reports and appeals</Link>
    </>
  );
}
export function ReportForm({ kind, target }: { kind: string; target: string }) {
  return (
    <section className="card">
      <h2>Report a concern</h2>
      <p>
        No media uploads are accepted here. Use synthetic identifiers only. This
        preview cannot provide urgent assistance or submit a real abuse report.
      </p>
      <ActionForm
        trust
        base={{ operation: "report" }}
        label="Submit simulated report"
      >
        <Select
          label="Report target"
          name="targetKind"
          defaultValue={
            ["content", "user", "message", "community"].includes(kind)
              ? kind
              : "content"
          }
        >
          <option value="content">Content</option>
          <option value="user">User</option>
          <option value="message">Message</option>
          <option value="community">Community</option>
        </Select>
        <Input
          label="Synthetic target identifier"
          name="targetId"
          defaultValue={target}
          required
          maxLength={100}
        />
        <Select label="Report category" name="category">
          <option value="harassment">Harassment</option>
          <option value="deepfake">Deepfake or deceptive impersonation</option>
          <option value="intimate-image-abuse">
            Intimate-image abuse / lack of consent
          </option>
          <option value="spam">Spam</option>
          <option value="other">Other</option>
        </Select>
      </ActionForm>
    </section>
  );
}
export function CaseList({
  cases,
  moderator = false,
}: {
  cases: CaseView[];
  moderator?: boolean;
}) {
  return (
    <>
      {!cases.length && <p>No cases yet.</p>}
      {cases.map((c) => (
        <article className="card" key={c.id}>
          <p className="eyebrow">
            {c.priority} ·{" "}
            {c.overdue
              ? "Review deadline expired — review still required"
              : `Review due ${new Date(c.deadline).toISOString()}`}
          </p>
          <h2>{c.category}</h2>
          <p>Case {c.id}</p>
          <p>
            {c.targetKind} · {c.targetId}
          </p>
          <p>
            Status: {c.status} · revision {c.version}
          </p>
          <h3>Decision details</h3>
          <p>{c.reason}</p>
          <p>
            Classifier assessment: uncertain. AI-detection scores are not
            conclusive proof. No classifier service is connected.
          </p>
          <p>
            Restricted evidence: unavailable. Sensitive media is not included in
            this view.
          </p>
          {c.appeal && (
            <>
              <h3>Appeal tracking</h3>
              <p>{c.appeal.status}</p>
              <p>{c.appeal.text}</p>
            </>
          )}
          {c.canAppeal && (
            <ActionForm
              trust
              base={{ operation: "appeal", id: c.id, version: c.version }}
              label="Submit simulated appeal"
            >
              <Textarea
                label="Appeal explanation (synthetic only)"
                name="text"
                required
                minLength={10}
                maxLength={1000}
              />
            </ActionForm>
          )}
          {moderator && (
            <ActionForm
              trust
              base={{ operation: "decision", id: c.id, version: c.version }}
              label="Record simulated decision"
            >
              <Select label="Decision" name="decision">
                {(c.appeal?.status === "pending"
                  ? ["uphold", "reverse"]
                  : ["restrict", "dismiss"]
                ).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
              <Select label="Decision reason" name="reason">
                <option value="policy-violation">Policy violation</option>
                <option value="insufficient-evidence">
                  Insufficient evidence
                </option>
                <option value="successful-appeal">Successful appeal</option>
              </Select>
            </ActionForm>
          )}
        </article>
      ))}
    </>
  );
}
export function AuditView({ entries }: { entries: Audit[] }) {
  return (
    <section className="card">
      <h2>Administrative audit</h2>
      <p>
        Identifiers and transitions only; no evidence, appeal text, or media.
      </p>
      {!entries.length && <p>No audit events.</p>}
      {entries.map((e) => (
        <p key={e.id}>
          {e.at} · {e.action} · case {e.caseId} · actor {e.actorId}
        </p>
      ))}
    </section>
  );
}
