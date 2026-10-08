import { AccessWatch } from "@/features/community/access-watch";
import { Suspense } from "react";
import Link from "next/link";
import { communityAccount, Session } from "@/features/community/route";
import { getCommunityStore } from "@/lib/community/server";
import { getProfilesAdapter } from "@/lib/profiles/server";
import { getMediaAdapter } from "@/lib/media/server";
import { getTrustStore } from "@/lib/trust/server";
import { Input, Select } from "@/components/ui/forms";
import { PreviewNotice } from "@/features/community/views";
async function Content({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const a = await communityAccount("/search"),
    params = await searchParams,
    q = typeof params.q === "string" ? params.q.slice(0, 120) : "",
    filter = typeof params.filter === "string" ? params.filter : "all",
    store = getCommunityStore();
  const hits = await store.search(a.profile.id, q, filter),
    profiles = getProfilesAdapter(),
    connections = await profiles.connections(a.profile),
    people = [
      ...connections.friends,
      ...connections.followers,
      ...connections.following,
      ...connections.suggestions,
    ];
  if (filter === "all" || filter === "profile")
    for (const p of people) {
      if (
        !getTrustStore().discoverable(p.id) ||
        hits.some((h) => h.kind === "profile" && h.id === p.id)
      )
        continue;
      const person = await profiles.person(a.profile, p.id);
      if (
        person &&
        `${person.displayName} ${person.username}`
          .toLowerCase()
          .includes(q.toLowerCase())
      )
        hits.push({
          id: p.id,
          kind: "profile",
          title: person.displayName,
          excerpt: `@${person.username}`,
          href: `/profile/${person.username}`,
        });
    }
  if (filter === "all" || filter === "post") {
    for (const source of await profiles.content(a.profile)) {
      if (!source.post.text.toLowerCase().includes(q.toLowerCase())) continue;
      hits.push({
        id: source.post.id,
        kind: "post",
        title: `Post by ${source.author.displayName}`,
        excerpt: source.post.text,
        href: `/posts/${source.post.id}`,
      });
    }
  }
  if (filter === "all" || filter === "video") {
    const catalog = await getMediaAdapter().catalog(a.profile);
    if (catalog.ok)
      for (const item of catalog.catalog.items) {
        if (
          item.kind === "story" ||
          !`${item.title} ${item.description}`
            .toLowerCase()
            .includes(q.toLowerCase())
        )
          continue;
        hits.push({
          id: item.id,
          kind: "video",
          title: item.title,
          excerpt: item.description,
          href: item.kind === "video" ? `/videos/${item.id}` : "/reels",
        });
      }
  }
  const suggestions = (await store.search(a.profile.id, "", "community"))
    .map((h) => h.title)
    .slice(0, 5);
  return (
    <AccessWatch>
      <div className="page-content discovery-page">
        <Session expiresAt={a.expiresAt} />
        <h1>Search Common</h1>
        <PreviewNotice />
        <form action="/search" className="card discovery-form">
          <Input
            label="Search"
            name="q"
            defaultValue={q}
            list="search-suggestions"
            maxLength={120}
          />
          <datalist id="search-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <Select label="Search filter" name="filter" defaultValue={filter}>
            {[
              "all",
              "community",
              "post",
              "event",
              "page",
              "profile",
              "video",
            ].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
          <button className="button button-primary">Search</button>
        </form>
        <h2>{q ? `Results for “${q}”` : "Discover"}</h2>
        {!hits.length ? (
          <section className="card">
            <h3>No results</h3>
            <p>
              Try a different phrase or filter. Only content you can access
              appears here.
            </p>
            <Link href="/search">Clear search</Link>
          </section>
        ) : (
          <div className="discovery-grid">
            {hits.map((h) => (
              <article key={`${h.kind}:${h.id}`} className="card">
                <p className="eyebrow">{h.kind}</p>
                <h3>
                  <Link href={h.href}>{h.title}</Link>
                </h3>
                <p>{h.excerpt}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </AccessWatch>
  );
}
export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p>Searching…</p>}>
      <Content {...props} />
    </Suspense>
  );
}
