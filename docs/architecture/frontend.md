# Frontend architecture and decisions

**Document state:** Starter specification; no application, backend, dependencies, tests, or deployment exist in this package.
**Prepared:** 2026-10-08.

## Proposed architecture
Use one Next.js App Router application with strict TypeScript and Tailwind CSS. Choose compatible stable versions at scaffold time; no dependency installation or framework behavior is verified here. Follow existing conventions if these files are later adopted into a repository.

```text
src/
  app/                 # route groups, layouts, loading/error/not-found boundaries
  components/ui/       # accessible shared primitives
  features/            # accounts, feed, posts, messaging, communities, safety...
  lib/api/             # transport, schemas, error normalization, adapters
  lib/auth/            # server session access and capability interpretation
  lib/config/          # validated public/server configuration
  styles/              # semantic design tokens and global styles
  mocks/               # deterministic development fixtures and handlers
  test/                # shared test utilities
```

This tree is proposed; none of these code directories is delivered.

## Route and feature boundaries
| Route family | Feature ownership | Primary dependency | Initial phase |
|---|---|---|---|
| /login, /register, /forgot-password, /onboarding | accounts | identity/session/eligibility | P1 |
| /home, /posts/[postId], /saved | feed/posts | audience-aware content, publication | P1 |
| /profile/[username], /profile/edit, /friends | profiles/graph | discoverability and graph service | P1 |
| /notifications, /settings/*, /safety/* | preferences/privacy/safety | policy, reports, appeals | P1 |
| /messages, /messages/[conversationId], /calls | messaging/calls | encryption, events, RTC | P2 |
| /stories, /reels, /videos, /live | media | processing, distribution, live safety | P3 |
| /groups/*, /communities/*, /events/*, /pages/*, /search | communities/discovery | memberships, scoped search | P3 |
| /creator/*, /marketplace/*, /ads/*, /assistant | ecosystem | analytics/payments/AI consent | P4 |
| /admin/* | privileged operations | separate role scopes/audit | P1 minimum safety; fuller P3 |

Use `(public)`, `(member)` and `(operations)` route groups for layouts; these groups do not change URLs or enforce backend authorization. Redirect root according to session. Deep links preserve permitted return destinations. Unsupported routes show unavailable states; do not expose dead navigation.

## Rendering and data flow
Server Components fetch suitable initial data with session-aware server access. Never cache user-specific responses across users. Client Components own composers, interactive media, dialogs and realtime subscriptions. Revalidate service authority after session, audience or membership changes. Authorization belongs to services even if a server-rendered page hides actions.

All feature reads/mutations use a typed adapter interface. Mock and integrated adapters implement the same interface and runtime schemas. Native Fetch is sufficient initially; add query caching only when interaction complexity justifies it. Cache keys include user, contextual identity, audience/feed mode and filters. Clear scoped caches on logout. Render initial data once without duplicate client fetches where practical.

Use URL state for shareable search/filter/navigation, local React state for transient controls, server-state caches for remote entities and a scoped store only for demonstrated cross-route needs. Do not duplicate canonical remote records in unrelated stores.

## Async and realtime behavior
Use stable client mutation IDs and idempotency keys, cancellation of obsolete reads, bounded retry for safe transient operations, and version-based conflict handling. Optimistic UI is allowed for reversible reactions/bookmarks with rollback; publication, payment, moderation, identity and delivery states remain authoritative. Preserve drafts on recoverable failure with privacy-aware local retention.

Realtime adapters handle authentication, subscription scope, event IDs, ordering/version checks, replay cursors, reconnect backoff and snapshot resync after gaps. Do not use socket connectivity as proof of message delivery. Revoked membership closes subscriptions and removes inaccessible cached records.

## Safety and security boundaries
Private upload staging precedes processing and approval. A publication service grants audience-scoped access; browser-side blur or hidden cards cannot satisfy FR-POL-001. Editing media creates a new screening revision; prior approval does not transfer automatically. Enforcement invalidates distribution caches. Live uses continuous service moderation and stop/restrict controls.

E2EE needs selected protocol, audited implementation, device keys, membership changes, verification, recovery and encrypted backup decisions before integrated claims. Browser UI cannot independently prove service security. AI cannot bypass audience access, and private plaintext disclosure requires explicit scoped consent. Reporting private messages discloses only selected evidence.

Use server-only secrets, secure session cookies through the agreed identity system, CSRF protections for cookie-authenticated mutations, strict URL allowlists where applicable and sanitized rich text. Redact private content, credentials and reporter identities from telemetry.

## Proposed architectural decision records
| ADR | Decision | Rationale / revisit condition | State |
|---|---|---|---|
| ADR-001 | App Router + strict TypeScript | Shared layouts and typed feature contracts; adapt to supplied repo | Proposed |
| ADR-002 | Server-first reads, targeted client islands | Limit browser code while supporting interaction | Proposed |
| ADR-003 | Feature adapters with explicit modes | Deterministic demos without false integration claims | Proposed |
| ADR-004 | Service-authoritative safety and access | Client controls cannot enforce storage/distribution policy | Required boundary |
| ADR-005 | No custom encryption implementation | Protocol and key management require separate review | Pending service choice |
| ADR-006 | Progressive feature delivery | Finish verifiable vertical slices before breadth | Proposed |
| ADR-007 | Web first; native/federation separately scoped | Upload scope exceeds a Next.js frontend | Proposed |

## Verification gates
Component tests validate state transitions and accessible actions. End-to-end tests cover login/session expiry, feed/composer, screening hold/approval, audience denial, report/appeal and messaging retry. Integrated tests must hit actual authorization and media services. Profile production build bundle/media behavior at implementation time; agree measurable performance budgets then. No test or benchmark has been run on an application in this package.
