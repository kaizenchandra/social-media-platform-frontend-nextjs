import "server-only";
import type { AdvancedAdapter } from "./adapter";
import type { ProfilesAdapter } from "@/lib/profiles/adapter";
import type { PublicationAdapter } from "@/lib/publication/adapter";
import type { ProfileIdentity, Person } from "@/features/profiles/contracts";
import {
  defaultWellbeing,
  type AdvancedResult,
  type Listing,
  type ListingView,
  type SchedulePlan,
  type WellbeingPreferences,
} from "@/features/advanced/contracts";
import {
  advancedCommand,
  marketplaceQuery,
} from "@/features/advanced/validation";
export const advancedFailure = (
  code:
    | "unavailable"
    | "forbidden"
    | "conflict"
    | "validation"
    | "unauthorized"
    | "network",
  message: string,
): AdvancedResult<never> => ({ ok: false, error: { code, message } });
const success = <T>(
  data: T,
  message = "Development preview loaded.",
): AdvancedResult<T> => ({ ok: true, data, message });
export function createDevelopmentAdvancedAdapter(
  config: { nodeEnv: string; mode: string },
  profiles: ProfilesAdapter,
  publication: PublicationAdapter,
  active: (id: string) => Promise<boolean>,
  now: () => number = Date.now,
): AdvancedAdapter {
  const enabled = config.nodeEnv === "development" && config.mode === "mock";
  const listings = new Map<string, Listing>([
    [
      "studio-kit",
      {
        id: "studio-kit",
        sellerId: "demo-noah",
        version: 0,
        title: "Synthetic sketch kit",
        description:
          "Repository-authored marketplace fixture. A sample creative kit, not a real offer for sale.",
        category: "creative",
        condition: "new",
        status: "fixture",
        artwork: "studio",
        createdAt: "2026-10-09T00:00:00.000Z",
      },
    ],
    [
      "garden-pot",
      {
        id: "garden-pot",
        sellerId: "demo-ava",
        version: 0,
        title: "Synthetic garden planter",
        description:
          "Repository-authored sample home item. No real seller inventory or price.",
        category: "home",
        condition: "used",
        status: "fixture",
        artwork: "garden",
        createdAt: "2026-10-09T00:00:00.000Z",
      },
    ],
    [
      "coast-pack",
      {
        id: "coast-pack",
        sellerId: "demo-milo",
        version: 0,
        title: "Synthetic walking pack",
        description:
          "Repository-authored outdoors fixture. No transaction or delivery service.",
        category: "outdoors",
        condition: "used",
        status: "fixture",
        artwork: "coast",
        createdAt: "2026-10-09T00:00:00.000Z",
      },
    ],
  ]);
  const settings = new Map<string, WellbeingPreferences>(),
    plans = new Map<string, { ownerId: string; plan: SchedulePlan }>(),
    receipts = new Map<
      string,
      {
        fingerprint: string;
        result: Awaited<ReturnType<AdvancedAdapter["execute"]>>;
      }
    >();
  const locks = new Map<string, Promise<unknown>>();
  const authorize = async (actor: ProfileIdentity) =>
    enabled && (await active(actor.id));
  const prefs = (id: string) => ({ ...defaultWellbeing, ...settings.get(id) });
  async function person(
    actor: ProfileIdentity,
    id: string,
  ): Promise<Person | null> {
    await profiles.content(actor);
    return profiles.person(actor, id);
  }
  async function project(
    actor: ProfileIdentity,
    item: Listing,
  ): Promise<ListingView | null> {
    if (item.status !== "fixture" && item.sellerId !== actor.id) return null;
    const seller = await person(actor, item.sellerId);
    if (!seller) return null;
    return {
      ...item,
      seller,
      canManage: item.sellerId === actor.id,
      canContact: item.status === "fixture" && item.sellerId !== actor.id,
      transaction: "unavailable",
      verification: "unavailable",
    };
  }
  async function execute(
    actor: ProfileIdentity,
    raw: Parameters<AdvancedAdapter["execute"]>[1],
    requestId: string,
  ): ReturnType<AdvancedAdapter["execute"]> {
    if (!(await authorize(actor)))
      return advancedFailure(
        "unauthorized",
        "Your session or advanced services are unavailable.",
      );
    const parsed = advancedCommand.safeParse(raw);
    if (!parsed.success || !/^[\w-]{8,100}$/.test(requestId))
      return advancedFailure(
        "validation",
        "Check the fields and explicitly confirm consequential changes.",
      );
    const cmd = parsed.data,
      key = `${actor.id}:${requestId}`,
      fingerprint = JSON.stringify(cmd),
      previous = receipts.get(key);
    if (previous)
      return previous.fingerprint === fingerprint
        ? structuredClone(previous.result)
        : advancedFailure(
            "conflict",
            "Request identity was reused for different input.",
          );
    let result: Awaited<ReturnType<AdvancedAdapter["execute"]>>;
    if (cmd.operation === "wellbeing") {
      const p = prefs(actor.id);
      if (p.version !== cmd.version)
        return advancedFailure(
          "conflict",
          "Preferences changed. Reload before saving.",
        );
      const { operation, ...next } = cmd;
      void operation;
      const updated = { ...next, version: p.version + 1 };
      settings.set(actor.id, updated);
      result = success(
        { ...updated },
        "Well-being preferences saved in development preview.",
      );
    } else if (cmd.operation === "schedule") {
      const item = await publication.read(actor.id, cmd.publicationId);
      if (!item.ok)
        return advancedFailure("forbidden", "Owned content unavailable.");
      if (item.item.version !== cmd.publicationVersion)
        return advancedFailure(
          "conflict",
          "Content changed. Review the current revision before planning.",
        );
      if (!["DRAFT", "APPROVED"].includes(item.item.state))
        return advancedFailure(
          "forbidden",
          "Only private drafts or simulated approved revisions can have a plan; held or restricted content cannot be scheduled.",
        );
      const at = Date.parse(cmd.at);
      if (at <= now() || at > now() + 366 * 86400000)
        return advancedFailure(
          "validation",
          "Choose a future UTC time within one year.",
        );
      if (
        [...plans.values()].some(
          (p) =>
            p.ownerId === actor.id &&
            p.plan.publicationId === cmd.publicationId &&
            p.plan.status === "planned",
        )
      )
        return advancedFailure(
          "conflict",
          "Cancel the existing plan before creating another.",
        );
      if (
        [...plans.values()].filter((p) => p.ownerId === actor.id).length >= 50
      )
        return advancedFailure(
          "validation",
          "Preview limit reached: 50 schedule plans.",
        );
      const plan: SchedulePlan = {
        id: crypto.randomUUID(),
        publicationId: cmd.publicationId,
        publicationVersion: cmd.publicationVersion,
        version: 0,
        at: cmd.at,
        status: "planned",
        delivery: "not-connected",
      };
      plans.set(plan.id, { ownerId: actor.id, plan });
      result = success(
        { ...plan },
        "Private schedule plan saved. No job was queued and nothing will publish automatically.",
      );
    } else if (cmd.operation === "cancel-schedule") {
      const item = plans.get(cmd.id);
      if (!item || item.ownerId !== actor.id)
        return advancedFailure("forbidden", "Schedule plan unavailable.");
      if (item.plan.version !== cmd.version || item.plan.status !== "planned")
        return advancedFailure("conflict", "Schedule plan changed. Reload.");
      item.plan = {
        ...item.plan,
        version: item.plan.version + 1,
        status: "cancelled",
      };
      result = success({ ...item.plan }, "Private schedule plan cancelled.");
    } else if (cmd.operation === "listing") {
      const previous = cmd.id ? listings.get(cmd.id) : undefined;
      if (cmd.id && (!previous || previous.sellerId !== actor.id))
        return advancedFailure(
          "forbidden",
          "Only the owner can edit this listing.",
        );
      if (
        previous &&
        (previous.version !== cmd.version || previous.status !== "draft")
      )
        return advancedFailure(
          "conflict",
          "Only a current private draft may be edited.",
        );
      if (
        !previous &&
        [...listings.values()].filter((l) => l.sellerId === actor.id).length >=
          20
      )
        return advancedFailure(
          "validation",
          "Preview limit reached: 20 listing drafts.",
        );
      const item: Listing = {
        id: previous?.id ?? crypto.randomUUID(),
        sellerId: actor.id,
        version: (previous?.version ?? -1) + 1,
        title: cmd.title,
        description: cmd.description,
        category: cmd.category,
        condition: cmd.condition,
        status: "draft",
        artwork: null,
        createdAt: previous?.createdAt ?? new Date(now()).toISOString(),
      };
      listings.set(item.id, item);
      const view = await project(actor, item);
      if (!view)
        return advancedFailure("forbidden", "Seller profile unavailable.");
      result = success(
        view,
        "Private synthetic listing saved. Listing publication, screening and transactions are not connected.",
      );
    } else if (cmd.operation === "withdraw-listing") {
      const item = listings.get(cmd.id);
      if (!item || item.sellerId !== actor.id)
        return advancedFailure(
          "forbidden",
          "Only the owner can withdraw this listing.",
        );
      if (item.version !== cmd.version || item.status === "withdrawn")
        return advancedFailure("conflict", "Listing changed. Reload.");
      item.status = "withdrawn";
      item.version++;
      const view = await project(actor, item);
      if (!view)
        return advancedFailure("forbidden", "Seller profile unavailable.");
      result = success(view, "Private listing withdrawn.");
    } else {
      const saved = await publication.execute(
        actor.id,
        {
          operation: "save",
          draft: {
            text: cmd.text,
            audience: "private",
            format: "post",
            disclosure: "not-declared",
            media: [],
            scenario: "review",
            syntheticOnly: true,
          },
        },
        `${requestId}-draft`,
      );
      if (!saved.ok) return advancedFailure("unavailable", saved.error.message);
      result = success(
        saved,
        "Reviewed manual text saved as a private draft. Nothing was published.",
      );
    }
    if (receipts.size >= 500) receipts.delete(receipts.keys().next().value!);
    receipts.set(key, { fingerprint, result: structuredClone(result) });
    return result;
  }
  return {
    async creator(actor) {
      if (!(await authorize(actor)))
        return advancedFailure("unauthorized", "Creator service unavailable.");
      const content = await publication.list(actor.id);
      if (!content.ok)
        return advancedFailure("unavailable", content.error.message);
      const ownedPlans = [...plans.values()]
        .filter(
          (p) =>
            p.ownerId === actor.id &&
            content.items.some((i) => i.id === p.plan.publicationId),
        )
        .map((p) => ({ ...p.plan }));
      return success({
        content: content.items,
        plans: ownedPlans,
        analytics: { status: "unavailable", metrics: null },
        monetization: {
          status: "unavailable",
          eligibility: null,
          balance: null,
        },
      });
    },
    async marketplace(actor, raw) {
      if (!(await authorize(actor)))
        return advancedFailure("unauthorized", "Marketplace unavailable.");
      const parsed = marketplaceQuery.safeParse(raw);
      if (!parsed.success)
        return advancedFailure(
          "validation",
          "Invalid search filters. Clear the filters and try again.",
        );
      const q = parsed.data,
        items: ListingView[] = [];
      for (const item of listings.values()) {
        if (
          q.collection === "mine"
            ? item.sellerId !== actor.id
            : item.status !== "fixture"
        )
          continue;
        if (
          (q.category !== "all" && item.category !== q.category) ||
          (q.condition !== "all" && item.condition !== q.condition) ||
          !`${item.title} ${item.description}`
            .toLowerCase()
            .includes(q.q.toLowerCase())
        )
          continue;
        const view = await project(actor, item);
        if (view) items.push(view);
      }
      return success(items);
    },
    async listing(actor, id) {
      if (!(await authorize(actor)))
        return advancedFailure("unauthorized", "Marketplace unavailable.");
      const item = listings.get(id),
        view = item ? await project(actor, item) : null;
      return view
        ? success(view)
        : advancedFailure(
            "forbidden",
            "Listing unavailable or outside your permissions.",
          );
    },
    async seller(actor, id) {
      if (!(await authorize(actor)))
        return advancedFailure("unauthorized", "Marketplace unavailable.");
      const seller = await person(actor, id);
      if (!seller) return advancedFailure("forbidden", "Seller unavailable.");
      const items: ListingView[] = [];
      for (const item of listings.values())
        if (item.sellerId === id && item.status === "fixture") {
          const view = await project(actor, item);
          if (view) items.push(view);
        }
      return success({ person: seller, listings: items });
    },
    async wellbeing(actor) {
      return (await authorize(actor))
        ? success(prefs(actor.id))
        : advancedFailure("unauthorized", "Preferences unavailable.");
    },
    execute(actor, cmd, requestId) {
      const previous = locks.get(actor.id) ?? Promise.resolve();
      const current = previous
        .catch(() => undefined)
        .then(() => execute(actor, cmd, requestId));
      locks.set(actor.id, current);
      void current
        .finally(() => {
          if (locks.get(actor.id) === current) locks.delete(actor.id);
        })
        .catch(() => undefined);
      return current;
    },
  };
}
