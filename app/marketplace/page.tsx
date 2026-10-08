import { Suspense } from "react";
import Link from "next/link";
import { Input, Select } from "@/components/ui/forms";
import { communityAccount, Session } from "@/features/community/route";
import { AccessWatch } from "@/features/community/access-watch";
import { getAdvancedAdapter } from "@/lib/advanced/server";
import { marketplaceQuery } from "@/features/advanced/validation";
import {
  AdvancedNavigation,
  AdvancedNotice,
  ListingCard,
  ListingFields,
} from "@/features/advanced/views";
import { AdvancedForm } from "@/features/advanced/action-form";
async function Content({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const a = await communityAccount("/marketplace"),
    raw = await searchParams,
    parsed = marketplaceQuery.safeParse({
      q: raw.q ?? "",
      category: raw.category ?? "all",
      condition: raw.condition ?? "all",
      collection: raw.collection ?? "discover",
    });
  const result = parsed.success
    ? await getAdvancedAdapter().marketplace(a.profile, parsed.data)
    : null;
  return (
    <AccessWatch>
      <div className="page-content discovery-page">
        <Session expiresAt={a.expiresAt} />
        <AdvancedNavigation />
        <p className="eyebrow">A THOUGHTFUL EXCHANGE</p>
        <h1>Marketplace</h1>
        <AdvancedNotice />
        <form action="/marketplace" className="card discovery-form">
          <Input
            label="Search listings"
            name="q"
            defaultValue={parsed.success ? parsed.data.q : ""}
            maxLength={120}
          />
          <div className="discovery-grid">
            <Select
              label="Category filter"
              name="category"
              defaultValue={parsed.success ? parsed.data.category : "all"}
            >
              {["all", "home", "creative", "outdoors"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select
              label="Condition filter"
              name="condition"
              defaultValue={parsed.success ? parsed.data.condition : "all"}
            >
              {["all", "new", "used"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select
              label="Listing collection"
              name="collection"
              defaultValue={
                parsed.success ? parsed.data.collection : "discover"
              }
            >
              <option value="discover">Discover synthetic fixtures</option>
              <option value="mine">My private listings</option>
            </Select>
          </div>
          <button className="button button-primary">Search marketplace</button>
        </form>
        {!result ? (
          <section className="card">
            <h2>Invalid search filters</h2>
            <Link href="/marketplace">Clear filters</Link>
          </section>
        ) : !result.ok ? (
          <section className="card">
            <h2>Marketplace unavailable</h2>
            <p>{result.error.message}</p>
            <Link href="/marketplace">Retry discovery</Link>
          </section>
        ) : !result.data.length ? (
          <section className="card">
            <h2>No matching listings</h2>
            <p>
              Try another phrase or clear your filters. Private listing drafts
              are visible only in your own collection.
            </p>
            <Link href="/marketplace">Clear filters</Link>
          </section>
        ) : (
          <div className="discovery-grid">
            {result.data.map((item) => (
              <ListingCard key={item.id} item={item} />
            ))}
          </div>
        )}
        <section className="card">
          <h2>Create a private listing</h2>
          <p>
            Only synthetic text is accepted. Listing publication and media
            screening are unavailable; drafts never enter discovery.
          </p>
          <AdvancedForm
            review
            base={{ operation: "listing", version: 0, syntheticOnly: true }}
            label="Save listing draft"
          >
            <ListingFields />
          </AdvancedForm>
        </section>
      </div>
    </AccessWatch>
  );
}
export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <>
          <p>Loading marketplace…</p>
          <p>JavaScript is required to submit this private preview form.</p>
        </>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
