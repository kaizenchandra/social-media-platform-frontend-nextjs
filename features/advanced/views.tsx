import Link from "next/link";
import {
  CalendarClock,
  ChartNoAxesCombined,
  Store,
  Sparkles,
  Leaf,
} from "lucide-react";
import { Input, Textarea, Select } from "@/components/ui/forms";
import { AdvancedForm } from "./action-form";
import type { CreatorSnapshot, ListingView } from "./contracts";
export function AdvancedNotice() {
  return (
    <p className="discovery-notice">
      Development preview · synthetic details only · process-local storage. No
      real sales, analytics, monetization, AI generation, notification delivery,
      or automatic publication.
    </p>
  );
}
export function AdvancedNavigation() {
  return (
    <nav aria-label="Advanced platform" className="advanced-nav">
      <Link href="/creator">
        <CalendarClock size={17} aria-hidden="true" />
        Creator studio
      </Link>
      <Link href="/marketplace">
        <Store size={17} aria-hidden="true" />
        Marketplace
      </Link>
      <Link href="/assistant">
        <Sparkles size={17} aria-hidden="true" />
        Writing & AI tools
      </Link>
      <Link href="/wellbeing">
        <Leaf size={17} aria-hidden="true" />
        Well-being
      </Link>
    </nav>
  );
}
export function CreatorView({ snapshot }: { snapshot: CreatorSnapshot }) {
  return (
    <>
      <AdvancedNavigation />
      <p className="eyebrow">YOUR CREATIVE SPACE</p>
      <h1>Creator studio</h1>
      <p className="muted">
        Manage your work, plan deliberately, and review what is connected.
      </p>
      <AdvancedNotice />
      <div className="discovery-grid">
        <section className="card">
          <ChartNoAxesCombined aria-hidden="true" />
          <h2>Analytics unavailable</h2>
          <p>
            No analytics provider is connected. Views, reach, engagement and
            earnings have not been measured.
          </p>
          <p className="field-hint">No sample metrics are shown.</p>
        </section>
        <section className="card">
          <h2>Monetization status</h2>
          <p>Unavailable · eligibility has not been assessed.</p>
          <p>
            Subscriptions, payouts and financial transactions are not connected.
            No balance or monetization events exist.
          </p>
        </section>
      </div>
      <section className="card">
        <h2>Content management</h2>
        <div className="publication-actions">
          <Link className="button button-primary" href="/create">
            Create private content
          </Link>
          <Link href="/assistant">Prepare a draft</Link>
        </div>
        {!snapshot.content.length && (
          <p>
            No owned drafts yet. Create a private draft to manage its workflow
            or plan a date.
          </p>
        )}
        {snapshot.content.map((item) => (
          <article key={item.id}>
            <p className="eyebrow">
              {item.draft.format ?? "post"} · {item.state} · revision{" "}
              {item.version}
            </p>
            <p>
              {["RESTRICTED", "REJECTED"].includes(item.state)
                ? "Content withheld by safety status."
                : item.draft.text.slice(0, 160) || "Media draft"}
            </p>
            <p>
              Intended audience: {item.draft.audience} · Distribution disabled
            </p>
            <div className="publication-actions">
              <Link
                href={
                  item.state === "DRAFT"
                    ? `/create?draft=${item.id}`
                    : `/content/${item.id}`
                }
              >
                {item.state === "DRAFT" ? "Edit draft" : "Review status"}
              </Link>
              <Link href={`/create?copy=${item.id}`}>
                Copy into a new private revision
              </Link>
            </div>
            {["DRAFT", "APPROVED"].includes(item.state) && (
              <AdvancedForm
                review
                base={{
                  operation: "schedule",
                  publicationId: item.id,
                  publicationVersion: item.version,
                }}
                label="Save schedule plan"
              >
                <Input
                  label="Planned publication time (ISO UTC)"
                  name="at"
                  required
                  placeholder="2026-12-20T10:00:00.000Z"
                  hint="Private planning only. Mandatory screening and backend approval are still required; no job is queued."
                />
              </AdvancedForm>
            )}
          </article>
        ))}
      </section>
      <section className="card">
        <h2>Schedule plans</h2>
        <p>
          Dates are intentions, not scheduled publishing jobs. Plans for older
          revisions remain held until reviewed.
        </p>
        {!snapshot.plans.length && <p>No schedule plans.</p>}
        {snapshot.plans.map((p) => (
          <article key={p.id}>
            <p>
              {p.at} · {p.status}
            </p>
            <p>
              Content revision {p.publicationVersion} ·{" "}
              {snapshot.content.find((c) => c.id === p.publicationId)
                ?.version !== p.publicationVersion
                ? "Content changed — plan stale"
                : "Private plan, publication service unavailable"}
            </p>
            {p.status === "planned" && (
              <AdvancedForm
                review
                base={{
                  operation: "cancel-schedule",
                  id: p.id,
                  version: p.version,
                }}
                label="Cancel schedule plan"
              />
            )}
          </article>
        ))}
      </section>
    </>
  );
}
export function ListingCard({ item }: { item: ListingView }) {
  return (
    <article className="card listing-card">
      {item.artwork && (
        <div
          className={`listing-art listing-art-${item.artwork}`}
          role="img"
          aria-label={`Synthetic ${item.category} listing artwork`}
        />
      )}
      <p className="eyebrow">
        {item.category} · {item.condition} · {item.status}
      </p>
      <h2>
        <Link href={`/marketplace/${item.id}`}>{item.title}</Link>
      </h2>
      <p>{item.description}</p>
      <Link href={`/marketplace/sellers/${item.seller.id}`}>
        {item.seller.displayName}
      </Link>
      <p className="field-hint">
        Not offered for sale · transactions unavailable
      </p>
    </article>
  );
}
export function ListingFields({ item }: { item?: ListingView }) {
  return (
    <>
      <Input
        label="Listing title"
        name="title"
        defaultValue={item?.title}
        required
        maxLength={80}
      />
      <Textarea
        label="Listing description"
        name="description"
        defaultValue={item?.description}
        required
        maxLength={1200}
      />
      <Select
        label="Listing category"
        name="category"
        defaultValue={item?.category ?? "creative"}
      >
        <option value="home">Home</option>
        <option value="creative">Creative</option>
        <option value="outdoors">Outdoors</option>
      </Select>
      <Select
        label="Listing condition"
        name="condition"
        defaultValue={item?.condition ?? "used"}
      >
        <option value="new">New</option>
        <option value="used">Used</option>
      </Select>
      <label>
        <input type="checkbox" name="syntheticOnly" required /> I am using
        synthetic listing details.
      </label>
    </>
  );
}
export function ListingDetail({ item }: { item: ListingView }) {
  return (
    <>
      <AdvancedNavigation />
      <Link href="/marketplace">All listings</Link>
      <h1>{item.title}</h1>
      <AdvancedNotice />
      {item.artwork && (
        <div
          className={`listing-art listing-art-${item.artwork}`}
          role="img"
          aria-label={`Synthetic ${item.category} listing artwork`}
        />
      )}
      <section className="card">
        <h2>Listing details</h2>
        <p>{item.description}</p>
        <p>
          {item.category} · {item.condition} · {item.status}
        </p>
        <p>
          No asking price, checkout, inventory guarantee or transaction service
          is available.
        </p>
        <h3>Seller</h3>
        <Link href={`/marketplace/sellers/${item.seller.id}`}>
          {item.seller.displayName} · @{item.seller.username}
        </Link>
        <p>Seller verification and transaction reputation unavailable.</p>
        <div className="publication-actions">
          {item.canContact && (
            <Link
              className="button button-primary"
              href={`/messages?listing=${item.id}`}
            >
              Prepare a buyer message
            </Link>
          )}
          <Link href={`/reports?kind=content&target=${item.id}`}>
            Report listing
          </Link>
        </div>
      </section>
      {item.canManage && item.status === "draft" && (
        <section className="card">
          <h2>Manage private listing</h2>
          <AdvancedForm
            review
            base={{
              operation: "listing",
              id: item.id,
              version: item.version,
              syntheticOnly: true,
            }}
            label="Save listing draft"
          >
            <ListingFields item={item} />
          </AdvancedForm>
          <AdvancedForm
            review
            base={{
              operation: "withdraw-listing",
              id: item.id,
              version: item.version,
            }}
            label="Withdraw listing"
          />
        </section>
      )}
      {item.canManage && item.status === "withdrawn" && (
        <p>
          Withdrawn private listing. It cannot appear in discovery or accept
          buyer messages.
        </p>
      )}
    </>
  );
}
