import "server-only";
import { createHash } from "node:crypto";
import type { ProfilesAdapter, IdentitySave } from "./adapter";
import type {
  Audience,
  ArtworkKey,
  ProfileIdentity,
  Person,
  Relationship,
  ProfilePost,
  ProfileView,
  ConnectionsView,
  ProfileOutcome,
  ConnectionPerson,
} from "@/features/profiles/contracts";
import {
  profileCommand,
  type ProfileCommand,
} from "@/features/profiles/validation";
type RecordProfile = {
  identity: ProfileIdentity;
  external: boolean;
  avatar: ArtworkKey;
  cover: ArtworkKey;
  location: string;
  work: string;
  website: string;
  visibility: Audience;
  detailsAudience: Audience;
  connectionsAudience: Audience;
  version: number;
  featured: Set<string>;
  posts: (ProfilePost & {
    publication: "published" | "pending" | "restricted";
  })[];
};
export const failure = (
  code: import("@/features/auth/contracts").AuthErrorCode,
  message: string,
  retryable = false,
): ProfileOutcome => ({ ok: false, error: { code, message, retryable } });
const success = (message: string): ProfileOutcome => ({ ok: true, message });
const key = (a: string, b: string) => [a, b].sort().join(":");
const directed = (a: string, b: string) => `${a}:${b}`;
export function createDevelopmentProfilesAdapter(
  environment: { nodeEnv: string; mode: string },
  resolveIdentity: (id: string) => Promise<ProfileIdentity | null>,
  now = () => Date.now(),
): ProfilesAdapter {
  if (
    process.env.NODE_ENV === "production" ||
    environment.nodeEnv !== "development" ||
    environment.mode !== "mock"
  )
    throw new Error("Profile preview is disabled.");
  const profiles = new Map<string, RecordProfile>();
  const friends = new Set<string>();
  const requests = new Set<string>();
  const follows = new Set<string>();
  const favorites = new Set<string>();
  const blocks = new Set<string>();
  const restrictions = new Set<string>();
  const versions = new Map<string, number>();
  const editing = new Set<string>();
  const replays = new Map<
    string,
    { fingerprint: string; result: ProfileOutcome; expires: number }
  >();
  function create(identity: ProfileIdentity, external: boolean, index = 0) {
    const assets: ArtworkKey[] = ["coast", "garden", "studio"];
    const posts: RecordProfile["posts"] = [
      {
        id: `${identity.id}-public`,
        title: "Small moments, shared",
        text: `Synthetic preview post from ${identity.displayName}: a little time outdoors brings a fresh perspective.`,
        audience: "public",
        date: "2026-10-01",
        media: index === 1 || index === 4 ? undefined : assets[index % 3],
        publication: "published",
      },
      {
        id: `${identity.id}-friends`,
        title: "A weekend with friends",
        text: "Synthetic friends-only post. A slower afternoon, good conversation, and new ideas.",
        audience: "friends",
        date: "2026-09-28",
        media: "garden",
        publication: "published",
      },
      {
        id: `${identity.id}-private`,
        title: "Notes for myself",
        text: "Synthetic private post: some thoughts stay just for me.",
        audience: "private",
        date: "2026-09-24",
        media: "studio",
        publication: "published",
      },
      {
        id: `${identity.id}-pending`,
        title: "Awaiting screening",
        text: "This pending fixture must never be returned in a published profile.",
        audience: "public",
        date: "2026-10-02",
        media: "studio",
        publication: "pending",
      },
    ];
    posts.push({
      id: `${identity.id}-restricted`,
      title: "Restricted media fixture",
      text: "Restricted content must never appear published.",
      audience: "public",
      date: "2026-10-03",
      media: "studio",
      publication: "restricted",
    });
    const entry: RecordProfile = {
      identity: { ...identity },
      external,
      avatar: assets[index % 3],
      cover: assets[(index + 1) % 3],
      location: external ? "" : "Common creative neighborhood",
      work: external ? "" : "Community projects",
      website: "",
      visibility: "public",
      detailsAudience: "friends",
      connectionsAudience: identity.username === "leila" ? "public" : "friends",
      version: 1,
      featured: new Set([posts[0].id]),
      posts,
    };
    profiles.set(identity.id, entry);
    return entry;
  }
  [
    [
      "ava",
      "Ava Reed",
      "Collecting small moments. Making room for good conversations.",
    ],
    ["milo", "Milo Chen", "Gardens, books, and shared tables."],
    ["noah", "Noah Ellis", "Building things with a thoughtful community."],
    ["leila", "Leila Morgan", "Finding inspiration in everyday places."],
    ["quinn", "Quinn Park", "Art, learning, and a little curiosity."],
  ].forEach(([username, displayName, bio], index) =>
    create(
      { id: `demo-${username}`, username, displayName, bio, version: 1 },
      false,
      index,
    ),
  );
  friends.add(key("demo-ava", "demo-noah"));
  friends.add(key("demo-leila", "demo-noah"));
  function ensure(actor: ProfileIdentity) {
    let own = profiles.get(actor.id);
    if (!own) {
      if (profiles.size >= 105) return null;
      own = create(actor, true);
      // Every new account receives explicitly labeled, deterministic sample relationships.
      friends.add(key(actor.id, "demo-noah"));
      requests.add(directed("demo-milo", actor.id));
      requests.add(directed(actor.id, "demo-quinn"));
      follows.add(directed(actor.id, "demo-ava"));
      follows.add(directed("demo-leila", actor.id));
    }
    own.identity = { ...actor };
    return own;
  }
  async function identity(p: RecordProfile) {
    if (!p.external) return p.identity;
    const fresh = await resolveIdentity(p.identity.id);
    if (fresh) p.identity = fresh;
    return fresh;
  }
  const blocked = (a: string, b: string) =>
    blocks.has(directed(a, b)) || blocks.has(directed(b, a));
  const permits = (audience: Audience, owner: string, viewer?: string) =>
    viewer === owner ||
    audience === "public" ||
    (!!viewer &&
      audience === "friends" &&
      friends.has(key(owner, viewer)) &&
      !restrictions.has(directed(owner, viewer)));
  const visible = (p: RecordProfile, viewer?: string) =>
    !(viewer && blocked(viewer, p.identity.id)) &&
    permits(p.visibility, p.identity.id, viewer);
  function relation(actor: string | undefined, target: string): Relationship {
    const isOwner = actor === target;
    return {
      kind: isOwner
        ? "owner"
        : actor && blocked(actor, target)
          ? "blocked"
          : actor && friends.has(key(actor, target))
            ? "friend"
            : actor && follows.has(directed(actor, target))
              ? "follower"
              : "visitor",
      request:
        actor && requests.has(directed(target, actor))
          ? "incoming"
          : actor && requests.has(directed(actor, target))
            ? "outgoing"
            : "none",
      following: !!actor && follows.has(directed(actor, target)),
      followedBy: !!actor && follows.has(directed(target, actor)),
      favorite: !!actor && favorites.has(directed(actor, target)),
      restricted: !!actor && restrictions.has(directed(actor, target)),
      blockedByMe: !!actor && blocks.has(directed(actor, target)),
      version: actor ? (versions.get(key(actor, target)) ?? 0) : 0,
    };
  }
  const person = (p: RecordProfile): Person => ({
    id: p.identity.id,
    username: p.identity.username,
    displayName: p.identity.displayName,
    avatar: p.avatar,
  });
  async function people(
    viewer: string | undefined,
    predicate: (id: string) => boolean,
  ) {
    const result: Person[] = [];
    for (const [id, p] of profiles)
      if (predicate(id) && visible(p, viewer) && (await identity(p)))
        result.push(person(p));
    return result;
  }
  async function mutual(actor: string | undefined, target: RecordProfile) {
    if (
      !actor ||
      actor === target.identity.id ||
      !permits(target.connectionsAudience, target.identity.id, actor)
    )
      return [];
    return people(
      actor,
      (id) =>
        id !== actor &&
        id !== target.identity.id &&
        friends.has(key(actor, id)) &&
        friends.has(key(target.identity.id, id)),
    );
  }
  function publishedPosts(target: RecordProfile, viewer?: string) {
    const owner = target.identity.id;
    return target.posts
      .filter(
        (p) =>
          p.publication === "published" && permits(p.audience, owner, viewer),
      )
      .map(({ id, title, text, audience, date, media }) => ({
        id,
        title,
        text,
        audience,
        date,
        media,
      }));
  }
  async function profile(
    actor: ProfileIdentity | null,
    username?: string,
  ): Promise<import("@/features/profiles/contracts").ProfileRead> {
    if (actor) ensure(actor);
    if (username)
      for (const p of profiles.values()) if (p.external) await identity(p);
    let target: RecordProfile | undefined = username
      ? [...profiles.values()].find((p) => p.identity.username === username)
      : actor
        ? profiles.get(actor.id)
        : undefined;
    if (!target && username) {
      const fresh = await resolveIdentity(username);
      if (fresh?.username === username) target = ensure(fresh) ?? undefined;
    }
    // Inactive identities remain unavailable even if a legacy slug was indexed.
    if (target && !(await identity(target))) target = undefined;
    if (!target || !visible(target, actor?.id)) return { kind: "unavailable" };
    const owner = target.identity.id;
    const viewer = actor?.id;
    const posts = publishedPosts(target, viewer);
    const result: ProfileView = {
      kind: "visible",
      person: person(target),
      bio: target.identity.bio,
      cover: target.cover,
      version: `${target.version}:${target.identity.version}`,
      relationship: relation(viewer, owner),
      canAct: !!actor && owner !== viewer,
      details: permits(target.detailsAudience, owner, viewer)
        ? {
            location: target.location,
            work: target.work,
            website: target.website,
          }
        : null,
      settings:
        viewer === owner
          ? {
              visibility: target.visibility,
              detailsAudience: target.detailsAudience,
              connectionsAudience: target.connectionsAudience,
            }
          : null,
      posts,
      featured: posts.filter((p) => target.featured.has(p.id)),
      media: posts.filter((p) => p.media),
      connections: null,
    };
    if (permits(target.connectionsAudience, owner, viewer))
      result.connections = {
        friends: await people(
          viewer,
          (id) => id !== owner && friends.has(key(owner, id)),
        ),
        followers: await people(viewer, (id) =>
          follows.has(directed(id, owner)),
        ),
        following: await people(viewer, (id) =>
          follows.has(directed(owner, id)),
        ),
        mutual: await mutual(viewer, target),
      };
    return result;
  }
  async function connections(actor: ProfileIdentity): Promise<ConnectionsView> {
    ensure(actor);
    const result: ConnectionsView = {
      incoming: [],
      outgoing: [],
      friends: [],
      followers: [],
      following: [],
      suggestions: [],
      favorites: [],
      blocked: [],
      restricted: [],
    };
    for (const [id, p] of profiles) {
      if (id === actor.id || !(await identity(p))) continue;
      const r = relation(actor.id, id);
      const item: ConnectionPerson = {
        ...person(p),
        relationship: r,
        mutualCount: (await mutual(actor.id, p)).length,
      };
      if (r.blockedByMe) {
        result.blocked.push(item);
        continue;
      }
      if (!visible(p, actor.id)) continue;
      if (r.kind === "friend") result.friends.push(item);
      if (r.request === "incoming") result.incoming.push(item);
      if (r.request === "outgoing") result.outgoing.push(item);
      if (r.following) result.following.push(item);
      if (r.followedBy) result.followers.push(item);
      if (r.favorite) result.favorites.push(item);
      if (r.restricted) result.restricted.push(item);
      if (r.kind !== "friend" && r.request === "none" && !r.restricted)
        result.suggestions.push(item);
    }
    return result;
  }
  async function apply(
    actor: ProfileIdentity | null,
    input: ProfileCommand,
    requestId: string,
    saveIdentity: IdentitySave,
  ): Promise<ProfileOutcome> {
    if (!actor || (await resolveIdentity(actor.id))?.id !== actor.id)
      return failure("unauthorized", "Your session expired. Sign in again.");
    const parsed = profileCommand.safeParse(input);
    if (!parsed.success || !/^[a-zA-Z0-9-]{8,80}$/.test(requestId))
      return failure("validation", "Check your profile details.");
    const command = parsed.data;
    const own = ensure(actor);
    if (!own)
      return failure("unavailable", "Preview account capacity reached.");
    for (const [id, replay] of replays)
      if (replay.expires <= now()) replays.delete(id);
    const replayKey = `${actor.id}:${requestId}`;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(command))
      .digest("hex");
    // Reject replays after a block too, rather than reviving access with cached success.
    if (
      command.operation !== "edit" &&
      command.operation !== "feature" &&
      command.operation !== "unblock" &&
      command.operation !== "block" &&
      blocked(actor.id, command.targetId)
    )
      return failure("forbidden", "This connection is unavailable.");
    const replay = replays.get(replayKey);
    if (replay)
      return replay.fingerprint === fingerprint
        ? replay.result
        : failure(
            "conflict",
            "This request has changed. Reload and try again.",
          );
    let result: ProfileOutcome;
    if (command.operation === "edit" || command.operation === "feature") {
      if (
        `${own.version}:${own.identity.version}` !== command.version ||
        editing.has(actor.id)
      )
        return failure(
          "conflict",
          "Your profile changed. Reload before saving.",
        );
      if (command.operation === "feature") {
        const post = own.posts.find(
          (p) => p.id === command.postId && p.publication === "published",
        );
        if (!post)
          return failure(
            "forbidden",
            "Only your published preview posts can be featured.",
          );
        if (command.enabled) own.featured.add(post.id);
        else own.featured.delete(post.id);
        own.version++;
        result = success(
          command.enabled
            ? "Featured content added."
            : "Featured content removed.",
        );
      } else {
        editing.add(actor.id);
        try {
          const saved = await saveIdentity(
            command.displayName,
            command.bio,
            own.identity.version,
          );
          if (!saved.ok) return saved;
          const fresh = await resolveIdentity(actor.id);
          if (!fresh)
            return failure(
              "unauthorized",
              "Your session expired. Sign in again.",
            );
          own.identity = fresh;
          own.location = command.location;
          own.work = command.work;
          own.website = command.website;
          own.avatar = command.avatar;
          own.cover = command.cover;
          own.visibility = command.visibility;
          own.detailsAudience = command.detailsAudience;
          own.connectionsAudience = command.connectionsAudience;
          own.version++;
          result = success(
            "Profile updated. Your audience choices are applied.",
          );
        } finally {
          editing.delete(actor.id);
        }
      }
    } else {
      const target = profiles.get(command.targetId);
      if (
        !target ||
        target.identity.id === actor.id ||
        !(await identity(target))
      )
        return failure("forbidden", "This connection is unavailable.");
      const r = relation(actor.id, target.identity.id);
      if (r.version !== command.version)
        return failure(
          "conflict",
          "This connection changed. Reload and try again.",
        );
      if (
        command.operation !== "unblock" &&
        command.operation !== "block" &&
        !visible(target, actor.id)
      )
        return failure("forbidden", "This connection is unavailable.");
      const out = directed(actor.id, target.identity.id),
        incoming = directed(target.identity.id, actor.id),
        pair = key(actor.id, target.identity.id);
      switch (command.operation) {
        case "request":
          if (r.kind === "friend" || r.request !== "none")
            return failure(
              "conflict",
              "A connection or request already exists.",
            );
          requests.add(out);
          result = success("Friend request sent.");
          break;
        case "accept":
          if (r.request !== "incoming")
            return failure(
              "forbidden",
              "Only the recipient can accept an incoming request.",
            );
          requests.delete(incoming);
          friends.add(pair);
          result = success("Friend request accepted.");
          break;
        case "reject":
          if (r.request !== "incoming")
            return failure(
              "forbidden",
              "Only the recipient can reject an incoming request.",
            );
          requests.delete(incoming);
          result = success("Friend request rejected.");
          break;
        case "cancel":
          if (r.request !== "outgoing")
            return failure(
              "forbidden",
              "Only the sender can cancel an outgoing request.",
            );
          requests.delete(out);
          result = success("Friend request cancelled.");
          break;
        case "unfriend":
          if (r.kind !== "friend")
            return failure("conflict", "You are no longer friends.");
          friends.delete(pair);
          if (!follows.has(out)) favorites.delete(out);
          if (!follows.has(incoming)) favorites.delete(incoming);
          result = success("Friend removed.");
          break;
        case "follow":
          follows.add(out);
          result = success("Account followed.");
          break;
        case "unfollow":
          follows.delete(out);
          if (r.kind !== "friend") favorites.delete(out);
          result = success("Account unfollowed.");
          break;
        case "favorite":
          if (r.kind !== "friend" && !r.following)
            return failure(
              "forbidden",
              "Follow this account or become friends before adding a favorite.",
            );
          favorites.add(out);
          result = success("Favorite added.");
          break;
        case "unfavorite":
          favorites.delete(out);
          result = success("Favorite removed.");
          break;
        case "restrict":
          restrictions.add(out);
          result = success(
            "Account restricted. They can see only your public content.",
          );
          break;
        case "unrestrict":
          restrictions.delete(out);
          result = success("Restriction removed.");
          break;
        case "block":
          blocks.add(out);
          friends.delete(pair);
          [out, incoming].forEach((edge) => {
            requests.delete(edge);
            follows.delete(edge);
            favorites.delete(edge);
            restrictions.delete(edge);
          });
          result = success(
            "Account blocked. Connections and requests were removed.",
          );
          break;
        case "unblock":
          if (!r.blockedByMe)
            return failure("forbidden", "Only your own block can be removed.");
          blocks.delete(out);
          result = success(
            "Account unblocked. Previous connections were not restored.",
          );
          break;
      }
      versions.set(pair, r.version + 1);
    }
    if (replays.size >= 1000) replays.delete(replays.keys().next().value!);
    replays.set(replayKey, {
      fingerprint,
      result,
      expires: now() + 5 * 60_000,
    });
    return result;
  }
  async function content(actor: ProfileIdentity) {
    ensure(actor);
    const result: import("@/features/feed/contracts").ContentSource[] = [];
    for (const p of profiles.values()) {
      if (!(await identity(p))) continue;
      if (!visible(p, actor.id)) continue;
      for (const post of publishedPosts(p, actor.id))
        result.push({
          author: person(p),
          relationship: relation(actor.id, p.identity.id),
          post,
        });
    }
    return result;
  }
  async function permittedPerson(actor: ProfileIdentity, id: string) {
    const p = profiles.get(id);
    if (!p || !(await identity(p))) return null;
    return visible(p, actor.id) ? person(p) : null;
  }
  let mutationTail: Promise<unknown> = Promise.resolve();
  function execute(
    actor: ProfileIdentity | null,
    input: ProfileCommand,
    requestId: string,
    saveIdentity: IdentitySave,
  ) {
    const current = mutationTail
      .catch(() => undefined)
      .then(() => apply(actor, input, requestId, saveIdentity));
    mutationTail = current;
    return current;
  }
  return { profile, connections, execute, content, person: permittedPerson };
}
