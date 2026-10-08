import Link from "next/link";
import { OperationFeedback } from "./operation-feedback";
import { Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/overlays";
import { SessionWatch } from "@/features/auth/account-panel";
import { ConnectionActions } from "./connection-actions";
import {
  artwork,
  type ConnectionsView,
  type ConnectionPerson,
} from "./contracts";
function List({
  items,
  title,
  description,
}: {
  items: ConnectionPerson[];
  title: string;
  description: string;
}) {
  return (
    <section>
      <h2>{title}</h2>
      {items.length ? (
        <ul className="connection-list">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="connection-card">
                <div className="connection-person">
                  <Avatar
                    name={item.displayName}
                    src={artwork[item.avatar].src}
                  />
                  <div>
                    <Link
                      href={`/profile/${item.username}`}
                      className="connection-name"
                    >
                      {item.displayName}
                    </Link>
                    <p className="field-hint">@{item.username}</p>
                    {item.relationship.kind !== "blocked" ? (
                      <p className="field-hint">
                        {item.mutualCount} shared connections visible to you
                      </p>
                    ) : null}
                  </div>
                </div>
                <ConnectionActions
                  targetId={item.id}
                  name={item.displayName}
                  relationship={item.relationship}
                />
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Users />}
          title={`No ${title.toLowerCase()}`}
          description={description}
        />
      )}
    </section>
  );
}
export function ConnectionsPage({
  data,
  expiresAt,
}: {
  data: ConnectionsView;
  expiresAt: string;
}) {
  return (
    <div className="page-content connections-page">
      <SessionWatch expiresAt={expiresAt} />
      <div className="page-heading">
        <p className="eyebrow">YOUR CIRCLE, YOUR CHOICES</p>
        <Badge>Development preview</Badge>
      </div>
      <h1>Connections</h1>
      <p className="muted">
        Keep close to the people who matter. Friendships and follows are
        separate choices.
      </p>
      <p className="field-hint">
        Every new preview account starts with synthetic sample relationships.
        Suggestions use only visible mutual connections; no contacts or location
        are imported.
      </p>
      <nav aria-label="Profile navigation">
        <Link href="/profile">Back to your profile</Link>
      </nav>
      <OperationFeedback>
        <Tabs
          label="Connection groups"
          tabs={[
            {
              value: "requests",
              label: `Requests (${data.incoming.length})`,
              content: (
                <div className="profile-stack">
                  <List
                    items={data.incoming}
                    title="Incoming requests"
                    description="New friend requests will appear here."
                  />
                  <List
                    items={data.outgoing}
                    title="Sent requests"
                    description="You have no pending outgoing requests."
                  />
                </div>
              ),
            },
            {
              value: "friends",
              label: "Friends",
              content: (
                <List
                  items={data.friends}
                  title="Friends"
                  description="Accept a request or connect with someone you know."
                />
              ),
            },
            {
              value: "following",
              label: "Following",
              content: (
                <div className="profile-stack">
                  <List
                    items={data.following}
                    title="Following"
                    description="Follow someone to keep their public profile in your circle."
                  />
                  <List
                    items={data.followers}
                    title="Followers"
                    description="No visible accounts follow you yet."
                  />
                </div>
              ),
            },
            {
              value: "suggestions",
              label: "Suggestions",
              content: (
                <List
                  items={data.suggestions}
                  title="Connection suggestions"
                  description="No eligible suggestions are available right now."
                />
              ),
            },
            {
              value: "favorites",
              label: "Favorites",
              content: (
                <List
                  items={data.favorites}
                  title="Favorites"
                  description="Add a followed account or friend to favorites."
                />
              ),
            },
            {
              value: "privacy",
              label: "Privacy",
              content: (
                <div className="profile-stack">
                  <List
                    items={data.blocked}
                    title="Blocked accounts"
                    description="You have not blocked any accounts."
                  />
                  <List
                    items={data.restricted}
                    title="Restricted accounts"
                    description="Restrict an account to share only your public content with it."
                  />
                </div>
              ),
            },
          ]}
        />
      </OperationFeedback>
    </div>
  );
}
