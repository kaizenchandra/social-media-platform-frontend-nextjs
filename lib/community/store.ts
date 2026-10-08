import "server-only";
import type {
  Community,
  CommunityCard,
  CommunityDetail,
  BusinessPage,
  SearchHit,
  Outcome,
} from "@/features/community/contracts";
import type { CommunityCommand } from "@/features/community/validation";
export class CommunityStore {
  private communities = new Map<string, Community>();
  private pages = new Map<string, BusinessPage>();
  private locks = new Map<string, Promise<Outcome>>();
  private receipts = new Map<
    string,
    { fingerprint: string; result: Outcome }
  >();
  constructor(
    private accessible: (
      actor: string,
      owner: string,
    ) => Promise<boolean> = async () => true,
  ) {
    this.communities.set("makers", {
      id: "makers",
      name: "Neighborhood makers",
      description:
        "A synthetic community for thoughtful projects and local ideas.",
      visibility: "public",
      ownerId: "demo-noah",
      version: 0,
      members: { "demo-noah": "admin" },
      topics: ["Projects", "Introductions"],
      posts: [
        {
          id: "welcome",
          authorId: "demo-noah",
          text: "Welcome! Share an idea for our next workshop.",
          topic: "Introductions",
          announcement: true,
        },
      ],
      events: [
        {
          id: "workshop",
          authorId: "demo-noah",
          title: "Weekend idea workshop",
          date: "2026-12-12T10:00:00.000Z",
          going: [],
          discussions: [],
        },
      ],
    });
    this.communities.set("studio", {
      id: "studio",
      name: "Private studio",
      description:
        "Membership requires approval. Content is visible only to members.",
      visibility: "private",
      ownerId: "demo-ava",
      version: 0,
      members: { "demo-ava": "admin" },
      topics: ["Private plans"],
      posts: [
        {
          id: "private-note",
          authorId: "demo-ava",
          text: "Private studio planning notes",
          topic: "Private plans",
          announcement: false,
        },
      ],
      events: [],
    });
    this.pages.set("common-studio", {
      id: "common-studio",
      name: "Common studio",
      description:
        "Synthetic business page · independent makers and workshops.",
      ownerId: "demo-noah",
      version: 0,
    });
  }
  private member(c: Community, actor: string) {
    return c.members[actor] ?? "none";
  }
  private readable(c: Community, actor: string) {
    return (
      c.visibility === "public" ||
      ["member", "admin"].includes(this.member(c, actor))
    );
  }
  private card(c: Community, actor: string): CommunityCard {
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      visibility: c.visibility,
      version: c.version,
      membership: this.member(c, actor),
    };
  }
  async list(actor: string) {
    const out: CommunityCard[] = [];
    for (const c of this.communities.values())
      if (await this.accessible(actor, c.ownerId))
        out.push(this.card(c, actor));
    return out;
  }
  async detail(actor: string, id: string): Promise<CommunityDetail | null> {
    const c = this.communities.get(id);
    if (!c || !(await this.accessible(actor, c.ownerId))) return null;
    const snapshotVersion = c.version;
    const canRead = this.readable(c, actor),
      canManage = this.member(c, actor) === "admin";
    const posts = [];
    if (canRead)
      for (const p of c.posts)
        if (await this.accessible(actor, p.authorId)) posts.push({ ...p });
    const events = [];
    if (canRead)
      for (const e of c.events) {
        if (!(await this.accessible(actor, e.authorId))) continue;
        const discussions = [];
        for (const d of e.discussions)
          if (await this.accessible(actor, d.authorId))
            discussions.push({ ...d });
        events.push({
          ...e,
          going: e.going.filter((id) => id === actor),
          discussions,
        });
      }
    if (snapshotVersion !== c.version) return null;
    return {
      ...this.card(c, actor),
      canRead,
      canManage,
      posts,
      topics: canRead ? [...c.topics] : [],
      events,
      members: canManage
        ? Object.entries(c.members).map(([id, role]) => ({ id, role }))
        : [],
    };
  }
  async businessPages(actor: string) {
    const out = [];
    for (const p of this.pages.values())
      if (await this.accessible(actor, p.ownerId))
        out.push({ ...p, canManage: p.ownerId === actor });
    return out;
  }
  async search(
    actor: string,
    query: string,
    filter = "all",
  ): Promise<SearchHit[]> {
    const hits: SearchHit[] = [];
    for (const card of await this.list(actor)) {
      const c = await this.detail(actor, card.id);
      if (!c) continue;
      hits.push({
        id: c.id,
        kind: "community",
        title: c.name,
        excerpt: c.description,
        href: `/communities/${c.id}`,
      });
      for (const p of c.posts)
        hits.push({
          id: p.id,
          kind: "post",
          title: p.topic,
          excerpt: p.text,
          href: `/communities/${c.id}#${p.id}`,
        });
      for (const e of c.events)
        hits.push({
          id: e.id,
          kind: "event",
          title: e.title,
          excerpt: e.date,
          href: `/communities/${c.id}#${e.id}`,
        });
    }
    for (const p of await this.businessPages(actor))
      hits.push({
        id: p.id,
        kind: "page",
        title: p.name,
        excerpt: p.description,
        href: `/pages#${p.id}`,
      });
    const q = query.trim().toLowerCase();
    return hits
      .filter(
        (h) =>
          (filter === "all" || filter === h.kind) &&
          `${h.title} ${h.excerpt}`.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }
  execute(
    actor: string,
    cmd: CommunityCommand,
    requestId: string = crypto.randomUUID(),
  ): Promise<Outcome> {
    // One process-local write queue keeps receipts atomic even across different communities.
    const resource = "preview-writes";
    const tail = this.locks.get(resource) ?? Promise.resolve();
    const current = tail
      .catch(() => undefined)
      .then(async () => {
        const key = `${actor}:${requestId}`,
          fingerprint = JSON.stringify(cmd),
          previous = this.receipts.get(key);
        if (previous)
          return previous.fingerprint === fingerprint
            ? { ...previous.result }
            : {
                ok: false,
                message: "Request identity was reused for different input.",
              };
        const result = await this.apply(actor, cmd);
        if (result.ok) {
          if (this.receipts.size >= 500)
            this.receipts.delete(this.receipts.keys().next().value!);
          this.receipts.set(key, { fingerprint, result: { ...result } });
        }
        return result;
      });
    this.locks.set(resource, current);
    void current
      .finally(() => {
        if (this.locks.get(resource) === current) this.locks.delete(resource);
      })
      .catch(() => undefined);
    return current;
  }
  private async apply(actor: string, cmd: CommunityCommand): Promise<Outcome> {
    if (cmd.operation === "create") {
      const id = crypto.randomUUID();
      this.communities.set(id, {
        id,
        name: cmd.name,
        description: cmd.description,
        visibility: cmd.visibility,
        ownerId: actor,
        version: 0,
        members: { [actor]: "admin" },
        posts: [],
        topics: ["General"],
        events: [],
      });
      return { ok: true, message: "Community created in development preview." };
    }
    if (cmd.operation === "page") {
      const p = cmd.id ? this.pages.get(cmd.id) : undefined;
      if (cmd.id && (!p || p.ownerId !== actor))
        return {
          ok: false,
          message: "Page management is restricted to its owner.",
        };
      if (p && p.version !== cmd.version)
        return { ok: false, message: "Page changed. Reload before editing." };
      const id = p?.id ?? crypto.randomUUID();
      this.pages.set(id, {
        id,
        name: cmd.name,
        description: cmd.description,
        ownerId: actor,
        version: (p?.version ?? -1) + 1,
      });
      return { ok: true, message: "Preview page saved." };
    }
    const c = this.communities.get(cmd.id);
    if (!c || !(await this.accessible(actor, c.ownerId)))
      return { ok: false, message: "Community unavailable." };
    if (c.version !== cmd.version)
      return {
        ok: false,
        message: "Membership or content changed. Reload and try again.",
      };
    const role = this.member(c, actor),
      admin = role === "admin",
      member = admin || role === "member";
    if (cmd.operation === "join") {
      if (role !== "none")
        return {
          ok: false,
          message: "You already joined or requested membership.",
        };
      c.members[actor] = c.visibility === "public" ? "member" : "requested";
    } else if (cmd.operation === "leave") {
      if (actor === c.ownerId)
        return { ok: false, message: "The owner must retain membership." };
      delete c.members[actor];
    } else if (cmd.operation === "member") {
      if (!admin || cmd.targetId === c.ownerId || !c.members[cmd.targetId])
        return {
          ok: false,
          message: "This membership action is not permitted.",
        };
      if (cmd.role === "none") delete c.members[cmd.targetId];
      else c.members[cmd.targetId] = cmd.role;
    } else if (cmd.operation === "post") {
      if (!member || (cmd.announcement && !admin))
        return {
          ok: false,
          message:
            "Posting requires membership; announcements require an admin.",
        };
      if (!c.topics.includes(cmd.topic))
        return { ok: false, message: "Select an existing topic." };
      c.posts.push({
        id: crypto.randomUUID(),
        authorId: actor,
        text: cmd.text,
        topic: cmd.topic,
        announcement: cmd.announcement,
      });
    } else if (cmd.operation === "topic") {
      if (!admin) return { ok: false, message: "Only admins manage topics." };
      if (!c.topics.includes(cmd.text)) c.topics.push(cmd.text);
    } else if (cmd.operation === "event") {
      if (!admin) return { ok: false, message: "Only admins create events." };
      if (Date.parse(cmd.date) <= Date.now())
        return { ok: false, message: "Choose a future event date." };
      c.events.push({
        id: crypto.randomUUID(),
        authorId: actor,
        title: cmd.text,
        date: cmd.date,
        going: [],
        discussions: [],
      });
    } else if (cmd.operation === "rsvp" || cmd.operation === "discussion") {
      if (!member)
        return {
          ok: false,
          message: "Event participation requires active membership.",
        };
      const e = c.events.find((e) => e.id === cmd.eventId);
      if (!e || !(await this.accessible(actor, e.authorId)))
        return { ok: false, message: "Event unavailable." };
      if (cmd.operation === "discussion")
        e.discussions.push({ authorId: actor, text: cmd.text });
      else
        e.going = cmd.going
          ? [...new Set([...e.going, actor])]
          : e.going.filter((id) => id !== actor);
    }
    c.version++;
    return { ok: true, message: "Development preview updated." };
  }
}
