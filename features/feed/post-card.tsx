import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/primitives";
import { artwork } from "@/features/profiles/contracts";
import { Artwork } from "@/features/profiles/profile-view";
import { EngagementControls } from "./engagement-controls";
import { PostTools } from "./post-tools";
import type { FeedPost } from "./contracts";
export function PostCard({
  post,
  detail = false,
}: {
  post: FeedPost;
  detail?: boolean;
}) {
  return (
    <article
      className="feed-card card"
      data-post-id={post.id}
      aria-labelledby={`post-title-${post.id}`}
    >
      {post.repostedBy.length ? (
        <p className="post-repost-line">
          Reposted by {post.repostedBy.map((p) => p.displayName).join(", ")} ·
          Original permissions apply
        </p>
      ) : null}
      <header className="post-header">
        <Link href={`/profile/${post.author.username}`} className="post-author">
          <Avatar
            name={post.author.displayName}
            src={artwork[post.author.avatar].src}
          />
          <span>
            <strong>{post.author.displayName}</strong>
            <span className="field-hint">
              <time dateTime={post.date}>{post.date}</time> ·{" "}
              {post.audience === "private"
                ? "Only me"
                : post.audience === "friends"
                  ? "Friends"
                  : "Public"}
            </span>
          </span>
        </Link>
        <PostTools post={post} />
      </header>
      <div className="post-body">
        <h2 id={`post-title-${post.id}`}>
          <Link href={`/posts/${post.id}`}>{post.title}</Link>
        </h2>
        <p>{post.text}</p>
        <p className="field-hint post-explanation">{post.explanation}</p>
      </div>
      {post.media ? (
        <Artwork
          asset={post.media}
          alt={`${artwork[post.media].label}, synthetic preview artwork`}
          className="feed-media"
        />
      ) : null}
      <footer className="post-footer">
        <EngagementControls post={post} detail={detail} />
        <Badge>Preview content</Badge>
      </footer>
    </article>
  );
}
