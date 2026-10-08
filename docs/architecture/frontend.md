# Frontend architecture and decisions

**Document state:** Phase 02 shell and Phases 03–05 development authentication/profile/feed interfaces implemented. Unimplemented social workstreams below remain proposals. See implementation status for current evidence and [repository assessment](repository-assessment.md) for the historical baseline.
**Prepared:** 2026-10-08.

## Proposed architecture
Use one Next.js App Router application with strict TypeScript and Tailwind CSS. Preserve installed Next.js 16.4.0, React 19.3.0, Tailwind 4.3.3 and npm lockfile. Type checking, lint, unit/component and browser suites, and the Webpack production build now pass; default Turbopack build is blocked by the documented environment restriction. Read installed Next.js guides before version-sensitive changes.

```text
./
  app/                 # route groups, layouts, loading/error/not-found boundaries
  components/ui/       # accessible shared primitives
  features/            # accounts, feed, posts, messaging, communities, safety...
  lib/api/             # transport, schemas, error normalization, adapters
  lib/auth/            # server session access and capability interpretation
  lib/config/          # validated public/server configuration
  app/globals.css      # semantic design tokens and global styles
  mocks/               # deterministic development fixtures and handlers
  test/                # shared test utilities
```

Keep the existing root `app/` and `@/*` root alias. `components/ui`, `components/shell`, `features/auth`, `lib/auth`, `lib/theme` and `tests` now exist. Add other directories only when their first slice needs them. Do not migrate to `src/` for cosmetic consistency.

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
| ADR-001 | Retain root App Router + strict TypeScript + npm | Already installed; preserve root alias and lockfile | Observed foundation; retention recommended |
| ADR-002 | Server-first reads, targeted client islands | Limit browser code while supporting interaction | Proposed |
| ADR-003 | Feature adapters with explicit modes | Deterministic demos without false integration claims | Proposed |
| ADR-004 | Service-authoritative safety and access | Client controls cannot enforce storage/distribution policy | Required boundary |
| ADR-005 | No custom encryption implementation | Protocol and key management require separate review | Pending service choice |
| ADR-006 | Progressive feature delivery | Finish verifiable vertical slices before breadth | Proposed |
| ADR-007 | Web first; native/federation separately scoped | Upload scope exceeds a Next.js frontend | Proposed |

## Verification gates
Component tests validate state transitions and accessible actions. End-to-end tests cover login/session expiry, feed/composer, screening hold/approval, audience denial, report/appeal and messaging retry. Integrated tests must hit actual authorization and media services. Profile production build bundle/media behavior at implementation time; agree measurable performance budgets then. Phase 00 ran ESLint, TypeScript without incremental writes, and dependency/ledger consistency checks. No component, browser, service or performance tests exist or were executed. See [status](../implementation/status.md).

## Phase 00 assessment decisions

Preserve the current Turbopack Tailwind loader; absence of PostCSS configuration is not itself a defect with this setup. Installed Next.js guides explicitly support `cacheComponents: true` with `partialPrefetching: true`; keep them and test session transitions before adding private data. Cache Components preserves route state through Activity, so logout and membership revocation must clear retained client state, not merely navigate away.

`LayoutProps<"/">` relies on generated route types. Future clean-checkout CI should run `next typegen` before TypeScript; the Phase 00 check used the existing generated context. Build-time Google font acquisition needs network access or a deliberate local-font decision; browser font delivery is self-hosted. No dependency upgrade, provider selection, auth design implementation or application refactor is authorized by this assessment.

## Phase 02 implemented architecture

Root App Router retained. Reusable components live in `components/ui`; shell and interactive library are separately composed. Root layout/pages/shell presentation are Server Components; navigation, appearance, form primitives and Radix interactions are targeted client boundaries. Theme is local, non-sensitive state, not a global business store. System fonts replace network-fetched starter fonts. Matching Tailwind PostCSS supports `build:webpack` verification where Turbopack worker binding fails; original Turbopack config is retained. Runtime component props are typed; no API/auth integrations were added in this phase.

## Phase 03 account architecture

`features/auth` owns typed validation/DTOs, forms, operation state and account presentation. `lib/auth` owns server-only mode selection, development adapter and data access. This is a simulated vertical slice with an unavailable production path, not a selected real auth provider. No authentication REST endpoint was invented.

Protected pages perform their own data-access check behind Suspense. Each Server Action validates inputs and invokes adapter authority again, including session ownership, expiry and account version. Opaque cookie values never enter client DTOs. Request-time `connection()` precedes mutable session-store reads to avoid Cache Components prerendering clock-dependent authority. None of this data uses shared `use cache`. Client mutation guards preserve inputs and idempotency IDs on transport failure. Full document transitions at authentication/lifecycle boundaries clear Activity-retained state. Passkey provider entry points remain disabled with an explanation.

Browser auth tests use a dedicated `.next/auth-preview` output directory to coexist with the IDE server. Generated TypeScript includes for that directory are maintained by Next.js. Webpack/PostCSS fallback remains explicit because Turbopack worker ports fail in the execution environment. Environment/API infrastructure beyond this auth-mode boundary remains unfinished from interrupted Phase 01.

## Phase 04 implemented profile and graph decisions

Routes `/profile`, `/profile/[username]` and `/connections` compose Server Components and existing client primitives. Request-time reads are behind Suspense with `connection()`; no profile or relationship DTO is placed in a shared cache. Owners reuse the existing session check; anonymous public reads receive only authorized public fields. Mutations are validated Server Actions and always derive the actor from the current auth adapter. Client controls are presentation, not authorization.

`features/profiles` owns safe DTOs, Zod commands, profile editing and connection interactions. `lib/profiles` owns the typed adapter and a bounded process-local preview store, selected only by the existing explicit development auth mode. Production has no fixture profile or graph authority. Existing auth adapter adds a server-internal, minimal active/onboarded identity lookup by ID or username; it never returns email or session data. Profile name/biography edits delegate to the existing identity mutation with its version check, avoiding separate copies of identity business rules. Deactivated/deleted identities are not returned by profile reads or lists.

Audience rules: profile visibility gates the entire read; detail/list visibility separately gates payloads. Owner sees their published content; unrestricted friends can see friends-only content; followers and guests get public content. Only published fixtures enter timelines, galleries and featured content, even for owners. Favorites require friendship/following. Blocking is symmetric for reads/interactions and removes edges in both directions; only the blocker can undo their block. Restriction is directional: a restricted viewer retains friendship but can receive only public owner content. Suggestions and mutuals exclude blocked/undiscoverable candidates and only disclose target list edges when their audience permits. Preview counts describe the visible list, not an unrestricted global total.

Connection commands check sender/recipient authority and pair versions. Profile edits use extension/identity versions and a preview edit lock; successful mutations use the documented Server Action `refresh()` and client transitions. No optimistic graph/safety decisions or global state library. A page-scoped feedback context preserves announcements when an accepted/rejected request row disappears. This process store is not a distributed transaction system; actual service concurrency/retention contracts remain dependencies.

Cover/avatar choices are a closed set of repository-authored SVG illustrations. Arbitrary uploads, URLs, unreviewed user media, external image calls and mock moderation approval are excluded. These graphics are clearly labeled preview artwork, not real user photos or a service moderation decision. Uploaded photos require private storage, purpose-scoped moderation and publication authority in a later approved integration.

## Phase 05 feed and engagement decisions

`/` now hosts the authenticated feed; the foundation overview moved to `/overview`. `/saved` and `/posts/[id]` share the same request-time authorization boundary. Server Components read behind Suspense and render safe cards; small client components own reactions, dialogs, comments, preferences and refresh. Existing primitives/tokens and session handling are reused. No dependency or global state manager was added. Active navigation waits for hydration before marking the current route, so Cache Components fallback markup matches the first client render. Authentication interactive readiness now uses the same post-commit timer as feed controls, correcting a regression observed during verification.

`ProfilesAdapter.content` projects only audience-permitted, published posts, using the same publication/audience predicate as profile timelines. `person` returns only discoverable, permitted author identity. `FeedAdapter` consumes these projections and rechecks them before every read and post mutation, including replay. Saved/reposted entries are references rather than copies, so revoked original permissions remove them from returned pages and details. Comments, reaction counts and repost attribution exclude blocked/undiscoverable authors; hidden roots hide their replies. Deleted comments retain an authorless, textless tombstone only when their thread remains permitted. Replies support one level.

Four-item pagination uses bounded, opaque, actor/mode-scoped ten-minute cursor snapshots of IDs, not content bodies. Each page resolves a fresh authorized source set and skips revoked/hidden/muted posts; IDs have stable date/order and cannot duplicate within the snapshot. Changed feed preferences invalidate cursors. Refresh starts from the current page; First page starts a new snapshot. Feed scroll offsets use a bounded document-memory map of numeric positions keyed by route; no identity, body, localStorage or sessionStorage persistence is involved. Restoration runs after the rendered feed mounts to accommodate streaming/retained route DOM. Focus reads refresh permissions and restored BFCache documents reload; each new server read rechecks authorization. Browser history may retain previously delivered hidden DOM until navigation invalidation or document reload. Already-delivered content cannot be made unseen; cross-client revocation events remain a service dependency.

Only reversible reactions update optimistically, with rollback and explicit reconciliation feedback on failure. Save/repost/comment/privacy/report controls await confirmation. Per-actor engagement and comment/preference revisions reject stale changes; bounded fingerprinted request IDs support network retries. Preview mutations serialize per actor to deduplicate concurrent retries, but provide no distributed transaction guarantees. Drafts stay in component memory, not local/session storage. Sharing checks access and exposes only the canonical URL; report draft preparation explicitly sends nothing.

## Phase 06 publication boundary

`features/publication` contains strict commands, draft validation, the publication state machine, composer, formatted-text preview, status and support interfaces. `lib/publication` owns actor-scoped reads/list/commands. Server Components authorize private composer/draft/status/appeal reads behind Suspense; Server Actions derive the current active, onboarded actor and validate every command. The browser never supplies an owner, destination state or moderation decision. Existing session expiry/focus/BFCache handling remains active. No global state manager, HTTP endpoint or dependency was added.

States are DRAFT → VALIDATING → UPLOADING → PROCESSING → SCREENING, then REVIEW_REQUIRED / APPROVED / RESTRICTED / REJECTED; FAILED supports bounded retry and CANCELLED is terminal. PUBLISHED requires an authoritative backend decision. The transition helper validates internal service events; it is not itself an authorization mechanism. The only connected adapter is explicitly development-only. Its scripted APPROVED decision is tagged `simulation`, never production approval, and can never transition to PUBLISHED. Every simulated publication command is forbidden. Transfer completion only advances to PROCESSING. An elapsed review target leaves content held; no deadline-based approval exists.

Draft text and declared attachment metadata are held in an owner-only, bounded process store; files and object URLs remain in the browser and are revoked on removal, workflow start and component cleanup. No bytes are uploaded, persisted or analyzed. Saved drafts require attachment reselection before simulation. Rich text is a small Markdown subset rendered as React text/elements, with no raw HTML or executable links. Declared MIME/extension/size checks are usability validation, not authoritative byte inspection. Public feeds/profile projections never consume these drafts or simulated approvals.

Versioned commands, serialized actor operations and bounded fingerprinted request replay reject stale/conflicting changes. Explicit network retries preserve request identity; latest authoritative state prevents late responses/replay from rewinding cancellation. Simulation steps are bounded, stop on errors and remain cancellable. Approval/restriction/rejection are never optimistic. Appeals prepare an unsent document-local note; no case, decision override or reviewer escalation is fabricated. NCII/sexual-content/deepfake help collects no evidence; actual report submission is disabled. Real services must supply authenticated decisions, private storage, moderation/review/appeal contracts, effective audience policy and distribution authorization before public launch.

## Phase 09 media architecture

Protected Server Components fetch development media projections through `lib/media`, deriving active identity and creator/audience authority from the existing auth/profile adapters. Strict Server Actions perform each engagement mutation and bounded idempotency replay with fresh access checks. No source is serialized for denied records. Client players use native playback events, a single active reel, captions/transcript fallback and source teardown; focus/visibility permission refresh unmounts media while authority is unknown. Static originals in `public/media` and `public/artwork` are public synthetic fixtures, not private user assets.

Media draft `format` is optional for compatibility with existing Phase 06 posts. All story/reel/video author flows reuse its private metadata/upload/screening/review state machine and forbid simulated publication. Live has a separate unavailable provider/capability interface: recorded approval does not establish eligibility or monitor future frames. Real processing/distribution, revocation delivery and continuous live safety remain service dependencies. No new transport or real-time endpoint is assumed.

## Phase 12 ownership and provider architecture

`features/advanced` defines creator/listing/schedule/preference/assistant DTOs and strict commands. `lib/advanced` owns server-selected process-local preview state, per-actor mutation serialization and bounded fingerprint replay. Profile graph checks control listing/seller/message entry projections, while creator content and manual drafting reuse publication authority. Schedule dates and manual confirmations cannot provide backend approval. Unavailable analytics/monetization/AI contracts use null data or explicit errors, never invented service results.

Well-being settings load through a small client leaf, which asks an authenticated Server Action for the current actor snapshot on route/focus changes and after confirmed preference saves. The leaf suspends independently without delaying, hiding or duplicating server-rendered forms, including no-JavaScript authentication explanations. Actor changes remount only the document timer, newer preference versions win, and failed checks default to disabled autoplay/reminders. Story viewers consume a separate client context so publication/server dependencies cannot leak into playback. Root integration and shared dialog focus return are covered by authentication/media regression and accessibility checks.
