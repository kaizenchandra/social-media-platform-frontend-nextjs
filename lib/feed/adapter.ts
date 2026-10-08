import type { ProfileIdentity } from "@/features/profiles/contracts";
import type {
  FeedOutcome,
  FeedRead,
  PostRead,
} from "@/features/feed/contracts";
import type { FeedCommand, FeedQuery } from "@/features/feed/validation";
export interface FeedAdapter {
  read(actor: ProfileIdentity | null, query: FeedQuery): Promise<FeedRead>;
  post(actor: ProfileIdentity | null, postId: string): Promise<PostRead>;
  execute(
    actor: ProfileIdentity | null,
    command: FeedCommand,
    requestId: string,
  ): Promise<FeedOutcome>;
}
