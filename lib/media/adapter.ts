import type { ProfileIdentity } from "@/features/profiles/contracts";
import type {
  CatalogResult,
  MediaRead,
  MediaOutcome,
} from "@/features/media/contracts";
import type { MediaCommand } from "@/features/media/validation";
export interface MediaAdapter {
  catalog(actor: ProfileIdentity): Promise<CatalogResult>;
  read(actor: ProfileIdentity, id: string): Promise<MediaRead>;
  execute(
    actor: ProfileIdentity,
    command: MediaCommand,
    requestId: string,
  ): Promise<MediaOutcome>;
}
