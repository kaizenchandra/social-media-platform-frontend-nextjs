import Link from "next/link";
import {
  MapPin,
  BriefcaseBusiness,
  Link as LinkIcon,
  Users,
  Image as ImageIcon,
  LockKeyhole,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/overlays";
import { SessionWatch } from "@/features/auth/account-panel";
import { ProfileEditor } from "./profile-editor";
import { ConnectionActions } from "./connection-actions";
import { FeaturedControl } from "./featured-control";
import {
  artwork,
  type ProfileView,
  type ProfilePost,
  type Person,
} from "./contracts";
export function Artwork({
  asset,
  alt,
  className = "",
}: {
  asset: keyof typeof artwork;
  alt: string;
  className?: string;
}) {
  // Sources are a closed list of local synthetic SVGs, never user-provided media URLs.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={artwork[asset].src}
      alt={alt}
      className={className}
      loading="lazy"
      width={960}
      height={480}
    />
  );
}
export function People({ people, label }: { people: Person[]; label: string }) {
  return people.length ? (
    <ul className="profile-people" aria-label={label}>
      {people.map((person) => (
        <li key={person.id}>
          <Link href={`/profile/${person.username}`}>
            <Avatar
              name={person.displayName}
              src={artwork[person.avatar].src}
              size="small"
            />
            <span>{person.displayName}</span>
          </Link>
        </li>
      ))}
    </ul>
  ) : (
    <p className="muted">No {label.toLowerCase()} to show.</p>
  );
}
function Post({
  post,
  profile,
  owner,
}: {
  post: ProfilePost;
  profile: ProfileView;
  owner: boolean;
}) {
  return (
    <article className="profile-post card">
      <div className="profile-post-heading">
        <div>
          <h3>{post.title}</h3>
          <p className="field-hint">
            <time dateTime={post.date}>{post.date}</time> ·{" "}
            <span>
              {post.audience === "private"
                ? "Only me"
                : post.audience === "friends"
                  ? "Friends"
                  : "Public"}
            </span>
          </p>
        </div>
        <Badge>Preview post</Badge>
      </div>
      <p>{post.text}</p>
      {post.media ? (
        <Artwork
          asset={post.media}
          alt={`${artwork[post.media].label}, synthetic preview artwork`}
          className="profile-post-image"
        />
      ) : null}
      {owner ? (
        <FeaturedControl
          profile={profile}
          postId={post.id}
          enabled={profile.featured.some((p) => p.id === post.id)}
        />
      ) : null}
    </article>
  );
}
export function ProfilePage({
  profile,
  expiresAt,
}: {
  profile: ProfileView;
  expiresAt?: string;
}) {
  const owner = profile.relationship.kind === "owner";
  const labels = {
    owner: "Your profile",
    friend: "Friend",
    follower: "Following",
    visitor: "Public visitor",
    blocked: "Blocked",
  };
  return (
    <div className="page-content profile-page">
      {expiresAt ? <SessionWatch expiresAt={expiresAt} /> : null}
      <div className="page-heading">
        <p className="eyebrow">PEOPLE, WITH A LITTLE MORE CONTEXT</p>
        <Badge>Development preview</Badge>
      </div>
      <p className="field-hint">
        Synthetic accounts, artwork, posts and connections. No social backend or
        media screening service is connected.
      </p>
      <Card className="profile-header">
        <Artwork
          asset={profile.cover}
          alt={`${artwork[profile.cover].label}, profile cover artwork`}
          className="profile-cover"
        />
        <div className="profile-identity">
          <Avatar
            name={profile.person.displayName}
            src={artwork[profile.person.avatar].src}
            size="large"
          />
          <div className="profile-title">
            <h1>{profile.person.displayName}</h1>
            <p className="muted">@{profile.person.username}</p>
            <Badge tone={owner ? "primary" : "neutral"}>
              {labels[profile.relationship.kind]}
            </Badge>
            {profile.relationship.followedBy ? (
              <Badge>Follows you</Badge>
            ) : null}
            {profile.relationship.restricted ? (
              <Badge tone="warning">Restricted</Badge>
            ) : null}
          </div>
          <div className="profile-header-actions">
            {owner ? (
              <ProfileEditor profile={profile} />
            ) : profile.canAct ? (
              <ConnectionActions
                targetId={profile.person.id}
                name={profile.person.displayName}
                relationship={profile.relationship}
              />
            ) : (
              <Link href="/login" className="button button-secondary">
                Sign in to connect
              </Link>
            )}
          </div>
        </div>
        {profile.bio ? (
          <p className="profile-bio">{profile.bio}</p>
        ) : (
          <p className="profile-bio muted">
            A little more about this person is yet to come.
          </p>
        )}
        <div className="profile-summary">
          {profile.connections ? (
            <>
              <span>{profile.connections.friends.length} friends</span>
              <span>{profile.connections.followers.length} followers</span>
              <span>{profile.connections.following.length} following</span>
            </>
          ) : (
            <span>
              <LockKeyhole size={15} aria-hidden="true" /> Connection lists are
              private.
            </span>
          )}
          {owner ? (
            <Link href={`/profile/${profile.person.username}`}>
              View profile link
            </Link>
          ) : null}
        </div>
      </Card>
      {owner ? (
        <p className="field-hint">
          You can see all published preview content, including Only me posts.
          Other visitors receive only audience-permitted content.
        </p>
      ) : null}
      <Tabs
        label="Profile sections"
        tabs={[
          {
            value: "posts",
            label: "Posts",
            content: (
              <div className="profile-content-grid">
                <aside className="profile-about card">
                  <h2>About</h2>
                  {profile.details ? (
                    <ul className="profile-detail-list">
                      {profile.details.location ? (
                        <li>
                          <MapPin size={17} aria-hidden="true" />
                          {profile.details.location}
                        </li>
                      ) : null}
                      {profile.details.work ? (
                        <li>
                          <BriefcaseBusiness size={17} aria-hidden="true" />
                          {profile.details.work}
                        </li>
                      ) : null}
                      {profile.details.website ? (
                        <li>
                          <LinkIcon size={17} aria-hidden="true" />
                          <a
                            href={profile.details.website}
                            rel="noreferrer noopener"
                            target="_blank"
                          >
                            Visit website (opens a new tab)
                          </a>
                        </li>
                      ) : null}
                      {!profile.details.location &&
                      !profile.details.work &&
                      !profile.details.website ? (
                        <li className="muted">
                          No profile details shared yet.
                        </li>
                      ) : null}
                    </ul>
                  ) : (
                    <p className="muted">
                      Profile details are not shared with this audience.
                    </p>
                  )}
                  {owner ? (
                    <Link
                      href="/connections"
                      className="button button-secondary"
                    >
                      <Users size={17} aria-hidden="true" />
                      Manage connections
                    </Link>
                  ) : null}
                </aside>
                <section
                  className="profile-post-list"
                  aria-label="Profile posts"
                >
                  <h2>Posts</h2>
                  {profile.posts.length ? (
                    profile.posts.map((post) => (
                      <Post
                        key={post.id}
                        post={post}
                        profile={profile}
                        owner={owner}
                      />
                    ))
                  ) : (
                    <EmptyState
                      title="No posts to show"
                      description="There are no published posts available to this audience."
                    />
                  )}
                </section>
              </div>
            ),
          },
          {
            value: "media",
            label: "Media",
            content: (
              <section>
                <h2>Media gallery</h2>
                {profile.media.length ? (
                  <div className="profile-gallery">
                    {profile.media.map((post) => (
                      <figure className="card" key={post.id}>
                        <Artwork
                          asset={post.media!}
                          alt={`${artwork[post.media!].label}, synthetic preview artwork`}
                        />
                        <figcaption>
                          {post.title}
                          <span className="field-hint">
                            {post.audience === "private"
                              ? "Only me"
                              : post.audience}
                          </span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<ImageIcon />}
                    title="No media to show"
                    description="Only permitted, published preview artwork appears here."
                  />
                )}
              </section>
            ),
          },
          {
            value: "featured",
            label: "Featured",
            content: (
              <section className="profile-post-list">
                <h2>Featured content</h2>
                {profile.featured.length ? (
                  profile.featured.map((post) => (
                    <Post
                      key={post.id}
                      post={post}
                      profile={profile}
                      owner={owner}
                    />
                  ))
                ) : (
                  <EmptyState
                    title="Nothing featured yet"
                    description={
                      owner
                        ? "Feature one of your published preview posts from the Posts tab."
                        : "There is no featured content shared with this audience."
                    }
                  />
                )}
              </section>
            ),
          },
          {
            value: "connections",
            label: "Connections",
            content: (
              <section>
                <h2>Connections</h2>
                {profile.connections ? (
                  <div className="profile-list-grid">
                    {Object.entries(profile.connections).map(
                      ([label, people]) => (
                        <Card key={label}>
                          <h3>
                            {label === "mutual"
                              ? "Mutual connections"
                              : label[0].toUpperCase() + label.slice(1)}
                          </h3>
                          <People people={people} label={label} />
                        </Card>
                      ),
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon={<LockKeyhole />}
                    title="Connection lists are private"
                    description="This profile has not shared its connection lists with this audience."
                  />
                )}
              </section>
            ),
          },
        ]}
      />
    </div>
  );
}
