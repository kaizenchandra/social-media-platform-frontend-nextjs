import type { Person } from "@/features/profiles/contracts";
import type { Publication } from "@/features/publication/contracts";
export type AdvancedError = {
  code:
    | "unavailable"
    | "forbidden"
    | "conflict"
    | "validation"
    | "network"
    | "unauthorized";
  message: string;
};
export type AdvancedResult<T = undefined> =
  { ok: true; message: string; data: T } | { ok: false; error: AdvancedError };
export type SchedulePlan = {
  id: string;
  publicationId: string;
  publicationVersion: number;
  version: number;
  at: string;
  status: "planned" | "cancelled";
  delivery: "not-connected";
};
export type CreatorSnapshot = {
  content: Publication[];
  plans: SchedulePlan[];
  analytics: { status: "unavailable"; metrics: null };
  monetization: { status: "unavailable"; eligibility: null; balance: null };
};
export const listingCategories = ["home", "creative", "outdoors"] as const;
export const listingConditions = ["new", "used"] as const;
export type Listing = {
  id: string;
  sellerId: string;
  version: number;
  title: string;
  description: string;
  category: (typeof listingCategories)[number];
  condition: (typeof listingConditions)[number];
  status: "fixture" | "draft" | "withdrawn";
  artwork: "studio" | "garden" | "coast" | null;
  createdAt: string;
};
export type ListingView = Listing & {
  seller: Person;
  canManage: boolean;
  canContact: boolean;
  transaction: "unavailable";
  verification: "unavailable";
};
export type MarketplaceQuery = {
  q: string;
  category: "all" | Listing["category"];
  condition: "all" | Listing["condition"];
  collection: "discover" | "mine";
};
export type WellbeingPreferences = {
  version: number;
  screenTimeReminder: number;
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  timeZone: string;
  autoplay: boolean;
  inAppNotifications: boolean;
  pushNotifications: boolean;
  emailNotifications: boolean;
};
export const defaultWellbeing: WellbeingPreferences = {
  version: 0,
  screenTimeReminder: 0,
  quietEnabled: false,
  quietStart: "22:00",
  quietEnd: "08:00",
  timeZone: "UTC",
  autoplay: false,
  inAppNotifications: true,
  pushNotifications: false,
  emailNotifications: false,
};
export const assistantTasks = [
  "writing",
  "caption",
  "translation",
  "accessibility",
  "summary",
] as const;
export type AssistantTask = (typeof assistantTasks)[number];
export type AssistantRequest = {
  task: AssistantTask;
  text: string;
  sourceId?: string;
  language: "en" | "es" | "fr" | "hi";
  consent: true;
  syntheticOnly: true;
};
export type AssistantOutput = {
  text: string;
  provider: string;
  sourceId?: string;
  requiresReview: true;
};
export type AssistantResult = AdvancedResult<AssistantOutput>;
