import type {
  PublicationList,
  PublicationResult,
} from "@/features/publication/contracts";
import type { PublicationCommand } from "@/features/publication/validation";
export interface PublicationAdapter {
  list(actorId: string): Promise<PublicationList>;
  read(actorId: string, id: string): Promise<PublicationResult>;
  execute(
    actorId: string,
    command: PublicationCommand,
    requestId: string,
  ): Promise<PublicationResult>;
}
