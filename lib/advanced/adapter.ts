import type { ProfileIdentity, Person } from "@/features/profiles/contracts";
import type { PublicationResult } from "@/features/publication/contracts";
import type { AdvancedCommand } from "@/features/advanced/validation";
import type {
  AdvancedResult,
  CreatorSnapshot,
  MarketplaceQuery,
  ListingView,
  WellbeingPreferences,
  SchedulePlan,
} from "@/features/advanced/contracts";
export interface AdvancedAdapter {
  creator(actor: ProfileIdentity): Promise<AdvancedResult<CreatorSnapshot>>;
  marketplace(
    actor: ProfileIdentity,
    query: MarketplaceQuery,
  ): Promise<AdvancedResult<ListingView[]>>;
  listing(
    actor: ProfileIdentity,
    id: string,
  ): Promise<AdvancedResult<ListingView>>;
  seller(
    actor: ProfileIdentity,
    id: string,
  ): Promise<AdvancedResult<{ person: Person; listings: ListingView[] }>>;
  wellbeing(
    actor: ProfileIdentity,
  ): Promise<AdvancedResult<WellbeingPreferences>>;
  execute(
    actor: ProfileIdentity,
    command: AdvancedCommand,
    requestId: string,
  ): Promise<
    AdvancedResult<
      | SchedulePlan
      | WellbeingPreferences
      | ListingView
      | PublicationResult
      | undefined
    >
  >;
}
