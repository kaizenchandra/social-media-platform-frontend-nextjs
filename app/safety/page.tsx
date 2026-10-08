import Link from "next/link";
import { SafetySupport } from "@/features/publication/support";
export default function Page() {
  return (
    <div className="page-content composer-page">
      <h1>Safety center</h1>
      <p className="muted">Clear disclosures. Private reporting boundaries.</p>
      <section className="card">
        <h2>Your safety tools</h2>
        <p>
          Review your audience, search visibility, blocked accounts, reports,
          and appeals. Preview reports do not reach a real moderation team.
        </p>
        <p>
          <Link href="/privacy">Privacy dashboard</Link> ·{" "}
          <Link href="/reports">Reports and appeals</Link> ·{" "}
          <Link href="/moderation">Moderator workspace</Link>
        </p>
      </section>
      <SafetySupport />
      <Link href="/create">Back to composer</Link>
    </div>
  );
}
