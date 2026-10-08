# API contracts and integration boundaries

**Document state:** Proposed service contracts; Phases 03–04 add isolated development authentication/profile/graph adapters, not a connected backend.
**Prepared:** 2026-10-08.

## Contract authority and capability mode
Everything below is a proposed frontend-facing contract, not an available backend API. Backend owners must approve paths, schemas, limits, authentication, events and policy semantics before integrated work. Route handlers may act as a backend-for-frontend but cannot manufacture production identity, encryption, moderation or payment guarantees.

Each capability declares `mock | integrated | unavailable`. Development defaults to deterministic mock adapters; release configuration must fail closed if required integration is absent. A visible demo banner identifies mock mode. Do not mix fixture identities with real sessions or fall back to fixtures after service errors.

| Capability | Permitted development simulation | Required integrated dependency | Current state |
|---|---|---|---|
| Identity/MFA/passkeys | Explicit development account/challenge/session simulation; passkeys unavailable | Identity provider, session, verification, age policy | Phase 03 mock adapter; no provider |
| Profile/social graph | Seeded audience-filtered profiles and graph transitions | Profile/graph/publication authority | Phase 04 development adapter; no service |
| Feed/ranking | Not implemented | Audience-aware content/ranking | No adapter/service |
| Upload/screening | Benign fixtures, progress, hold/reject/approve transitions | Private storage, malware/media pipeline, policy, moderation queue | No adapter/service |
| Reports/appeals | Case IDs and scripted decisions | Evidence access controls, workflow, audit | No adapter/service |
| Messaging/E2EE/backup | Explicitly simulated chat and crypto indicators | Reviewed protocol, keys/devices, message transport and recovery | No adapter/service |
| Calls/live | UI state simulation; optional local device preview explicitly labeled | RTC signaling, TURN/SFU as required, live moderation | No adapter/service |
| Search/notifications | Fixtures, delayed/duplicated events | Scoped indexes, event delivery, preferences | No adapter/service |
| AI/translation | Labeled canned drafts | Permission-filtered context, consent, model service | No adapter/service |
| Commerce/monetization/ads | Sandbox-like fixture statuses; no money movement | Payment provider, order/dispute/payout/ads services | No adapter/service |
| Analytics/admin | Aggregated fake data and scoped roles | Metrics definitions, roles, audit and operations | No adapter/service |

## Transport conventions
Proposed base path `/api/v1`; JSON except signed uploads. IDs are opaque strings, timestamps UTC ISO 8601; UI localizes dates. Lists use opaque cursors, stable ordering and explicit limits (proposed default 20, maximum 100; backend approval pending). Abort stale reads. Use idempotency keys for retriable creates/sends; retries reuse the same logical key. Backend defines retention and duplicate response behavior. Use `If-Match`/entity version for edits; 409 conflict requires refresh and user review.

Session cookie security, CSRF token/origin checks and session lifetime are identity decisions. Unauthenticated requests receive 401; denied requests receive 403 or privacy-preserving 404. Service validates ownership, membership, block, age and audience on every resource. Never trust userId supplied by the client as the authenticated actor.

```ts
type Page<T> = { items: T[]; nextCursor: string | null };
type ApiError = {
  error: { code: string; message: string; requestId: string;
    retryable: boolean; fieldErrors?: Record<string, string[]> }
};
type Session = {
  user: { id: string; username: string };
  identityId: string; capabilities: string[]; expiresAt: string;
};
type Post = {
  id: string; authorId: string; text: string; version: number;
  audience: 'public' | 'connections' | 'private' | 'custom';
  publication: 'draft' | 'processing' | 'review_required' |
    'published' | 'restricted' | 'rejected' | 'removed';
  media: { id: string; url?: string; altText?: string }[];
  createdAt: string; updatedAt: string;
};
```

These are illustrative types; implement runtime schemas. Custom audiences need a separate validated audience-list reference. Protected URLs are omitted for unauthorized users. Service-side field minimization matters even if the UI does not display the field.

## Proposed operations
| Operation | Request / successful result | Failure / authority | Traceability scope |
|---|---|---|---|
| GET /session | Session or 401 | Expired/revoked; no fixture fallback | FR-001–020 |
| POST /auth/login | Credentials/challenge → session or MFA challenge | Rate limit, verification, invalid credentials; provider owns flow | FR-001–020 |
| GET/PATCH /profiles/{id} | Profile read/validated patch with version | Discoverability/ownership; media references require approval | FR-021–035 |
| POST /connections/requests | targetId → pending request | Blocked/ineligible/duplicate | FR-036–050 |
| GET /feed | mode, cursor, language → Page<Post> | Session/audience/eligibility/ranking | FR-051–068 |
| POST /posts | text, audience, approved media IDs, clientMutationId → Post | Policy, stale approval, validation; may return processing | FR-069–090 |
| PATCH/DELETE /posts/{id} | If-Match version → revised Post / 204 | Ownership/conflict; media revision re-screened | FR-070–071, FR-089 |
| PUT/DELETE /posts/{id}/reaction | reaction → server counts / 204 | Denied/removed; optimistic rollback | Source interaction group |
| GET/POST /posts/{id}/comments | cursor / text,parentId → page/comment | Audience, threading, moderation, block | Source interaction group |
| POST /uploads | purpose, filename, declared MIME, byteLength → private upload intent | Signed constraints; validate actual bytes server-side | FR-091–108 |
| POST /uploads/{id}/complete | checksum, clientMutationId → processing state | Server verifies transfer; not publication | FR-107–108, FR-144–163 |
| GET /uploads/{id} | owner-scoped screening state/reason/targetAt | Owner-only pending previews; signed expiry | FR-107, FR-144–163 |
| DELETE /uploads/{id} | cancel → terminal result | Race with completion; server reconciles | FR-086–087 |
| POST /reports | target, category, selectedEvidence, consent → case | Access, redaction, duplicate handling | Reporting source groups |
| GET /reports/{id} | reporter-scoped summary/state | No confidential reviewer/reporter disclosure | Reporting source groups |
| POST /appeals | decisionId, grounds, evidence refs → case | Eligibility/deadline/version; no automatic restoration | FR-142, FR-580, FR-610 |
| GET /conversations/{id}/messages | cursor → permitted envelopes | Membership/device/session/revocation | Source personal/group messaging |
| POST /conversations/{id}/messages | encrypted envelope + clientMessageId → ack | Idempotency, membership, encryption epoch | Source personal/group messaging |
| PATCH /settings/privacy | version + validated values → effective settings | Age/policy limits; effective value may differ | Source privacy/teen groups |
| GET /search | query,type,cursor → permitted results | Index cannot reveal restricted/pending media | Source search group |
| GET/PATCH /notifications | page / read state → effective result | Scoped identity; sync across devices | Source notification group |
| POST /ai/drafts | operation, authorized context refs, consent → editable draft | Scope/token expiry; never autonomous publication | D69–70, AI source groups |
| POST /admin/cases/{id}/decision | version, decision, rationale → decision ref | Role scope, audit, conflict; no general access to specialist evidence | Source moderation group |

Table ranges describe feature scope rather than declaring complete endpoint coverage for every FR. Community, events, stories, payments, analytics, advertisements, backups and interoperability require their own approved schemas before integrated implementation.

## Public media state machine
`draft → validating → uploading → processing → screening → approved → published`.
Screening may instead lead to `review_required → approved/restricted/rejected`, `blocked`, or `processing_failed`. Upload may be `cancelled` or `upload_failed`; approved/published content may later become restricted/removed. Failed processing allows permitted retry or escalation. Appeal is an independent case workflow; success authorizes a new service disposition, not a local toggle.

Service returns `state`, `version`, `reasonCode`, `appealEligibility`, `targetAt`, and safe owner-facing details. A missing decision, timeout or detector outage stays non-public. Target expiry escalates review, never approves media. Staged objects use private ACLs and scoped short-lived URLs; distributions only receive authorized publication URLs. Integration checks must test public URL denial, feed/search exclusion, revision rescreening and post-enforcement cache invalidation. Benign synthetic fixtures replace harmful material in demos/tests.

## Messaging and realtime contracts
```ts
type MessageEnvelope = {
  id: string; clientMessageId: string; conversationId: string;
  senderId: string; deviceId: string; encryptionEpoch: string;
  ciphertext: string; version: number; createdAt: string;
};
type Event<T> = {
  eventId: string; type: string; resourceId: string;
  version: number; cursor: string; occurredAt: string; payload: T;
};
```

Illustrative only: ciphertext format and crypto metadata depend on the selected protocol. Do not implement custom cryptography from these types. Attachments need client encryption and scoped access under that protocol. Key changes, new devices, removed members, lost keys and backup recovery require reviewed behavior.

UI states: composing, queued, sending, sent, delivered, read, failed; also edited/deleted/expired where supported. `sent` means service acknowledgment, `delivered` means permitted recipient/device acknowledgment, `read` requires actual allowed receipt events. Deduplicate by event ID and clientMessageId; apply version ordering; reconnect using replay cursor or snapshot if replay expired. Revalidate membership before sending queued content. A queue does not guarantee send or delivery; sensitive offline persistence is opt-in and encryption/retention decisions remain open.

Proposed events: post.publication_changed, moderation.decision_changed, message.accepted/delivered/read/updated/deleted, conversation.membership_changed, notification.created, session.revoked. SSE or WebSocket is selected per service. Never place credentials in URL query strings or log message bodies.

## Error and test matrix
| Condition | Required UI / verification |
|---|---|
| 400/422 validation | Field errors; preserve valid input |
| 401 | Clear inaccessible cache; recovery/login with safe return path |
| 403/404 | Denied/unavailable without leaking restricted details |
| 409 | Show conflict and latest permitted state; no silent overwrite |
| 413/415 | Explain upload limit/type; do not retry unchanged file |
| 429 | Honor Retry-After; avoid retry storm |
| 5xx/offline | Bounded permitted retry; preserve draft; no mock success |
| Duplicate/reordered event | Stable identity and version prevent duplicate/regressed state |
| Timeout after mutation | Reconcile via idempotency key/status query before resubmit |

Approve schemas with backend owners, then run contract tests against both adapters and integration tests against real services. Record service environment, command, result and evidence in status. All integration checks are currently not run.

## Phase 03 local authentication boundary

`features/auth/contracts.ts` defines safe DTOs and typed errors; `validation.ts` provides runtime command validation; `lib/auth/adapter.ts` defines the operation boundary. The commands are frontend operations, not invented REST endpoints. `features/auth/actions.ts` exposes validated Next.js Server Actions and delegates to the selected server-only adapter. Existing proposed endpoint paths above are still unapproved and are not called.

Only `NODE_ENV=development` with `COMMON_AUTH_MODE=mock` enables `lib/auth/mock-adapter.ts`. The adapter factory also rejects actual production execution. All other modes use an unavailable adapter: no silent fixture fallback and no fixture production identity. A process-local store contains synthetic `.test` users, salted scrypt preview password hashes, opaque sessions and browser-bound challenges; no database or provider is present. Public codes/credentials are simulation fixtures, not secrets or real authentication. Production disables login and ignores forged preview cookies.

Selected commands: login, register, verify/resend email, forgot/reset password, MFA challenge, recovery, onboarding, account update, trust/revoke session, logout, expiry simulation, deactivate/delete preview account. A real passkey ceremony is unsupported. Recovery/email/MFA codes do not prove real identity, deliver mail, generate keys or replace provider authorization. Lifecycle operations affect only the synthetic process store; no real retention, backup deletion or recovery guarantee.

Server reads require a live adapter session; every account mutation checks it again and derives ownership from it rather than a browser-supplied user ID. Session-list IDs differ from bearer cookie values. Session/challenge/browser cookies are HttpOnly, SameSite=Lax and scoped to `/`; cookie values never enter safe DTOs. Cookies are set only through Server Actions. Request-time reads use `connection()` behind Suspense and are not placed in shared caches. Next.js Server Actions supply their framework origin checks; real provider/CSRF/cookie policy still requires approval.

Validation runs on client and server. Forms use POST and remain disabled before hydration; password/code fields never become GET parameters. Pending guards prevent double activation; successful development operations support bounded request-ID replay, input fingerprints and actor/challenge scoping. Network retries retain the same ID and draft inputs, without automatic retry loops. Conflicting account versions require review/reload. Challenge expiry and attempt/resend limits remain explicit. Logout/lifecycle/expiry redirects reload the document to remove retained route state; protected pages also recheck session on focus and reload restored BFCache documents. No credentials, messages or private DTOs are logged.

Pending integrated contracts: provider discovery and OAuth/WebAuthn URLs, registration/eligibility policy, actual email delivery and verification/reset proof, MFA enrollment/recovery/rate limiting, session/device revocation, effective account settings and version conflicts, lifecycle/retention/exports, reauthentication and service-side authorization. These must be approved rather than inferred from this development interface.

## Phase 04 profile/social graph adapter boundary

No proposed REST path above is implemented or called. `ProfilesAdapter` exposes actor-scoped `profile`, `connections` and validated `execute` operations. The actor comes from an active, onboarded session on each Server Action. Production uses an unavailable adapter; development requires the same explicit `COMMON_AUTH_MODE=mock` opt-in as authentication. Five synthetic discoverable accounts and synthetic posts/artwork provide deterministic preview data; each new preview actor has a sample friend, incoming/outgoing requests and follows, disclosed in the UI. Process restart loses changes; no durable backend exists.

Commands: `edit`, `feature`, `request`, `accept`, `reject`, `cancel`, `unfriend`, `follow`, `unfollow`, `favorite`, `unfavorite`, `block`, `unblock`, `restrict`, `unrestrict`. Profile commands carry a combined profile/identity version; relationship commands carry the current pair version. Bounded five-minute request-ID replay uses fingerprints and rechecks active identity/block authority before returning success. Client network retry IDs are stable; failures do not silently become successful fixture actions. Forbidden, unauthorized, validation, stale-version and network errors are typed; reload/retry is user-controlled.

The read DTO deliberately omits contact email, cookies, unauthorized profile details, non-public posts, hidden relationship lists, unpublished media and fixture pending-content bodies. Featured content and media are derived from the permitted published post set. Blocked/nonexistent/private profiles share the same unavailable response. Own block-list metadata is available only to its owner so they can undo a block; it does not contain target posts/details. External identity lookup omits inactive/unverified/unonboarded accounts, including after deactivation/deletion.

Real integrations still require profile slug uniqueness and discoverability, field-specific audiences/teen defaults, graph edge authority/revisions, service idempotency/concurrency, actual recommendation consent/signals, durable favorites/restrictions/blocks, relationship revocation events/cache invalidation, own published-post/media pagination, private uploads/screening and signed distribution, and lifecycle erasure/retention across identity/profile/graph services. Guest access to genuinely public content does not imply an authentication-independent blocking guarantee. Public local fixture artwork is not private storage or screened user media.

## Phase 05 feed/engagement boundary

`FeedAdapter.read(actor, { mode?, cursor? })` returns a typed page or typed error. Modes are home/friends/following/chronological/recommended/saved; preferences specify the default, optional Home public discovery/favorite priority and media filtering. Recommendations are deterministic public discovery, not an AI assessment. `post(actor, postId)` returns a safe post and permitted comments. Cursor IDs are opaque, actor/mode-scoped, expire after ten minutes, and are invalidated by preference changes. No content is stored in a cursor. Publication, profile/block/restriction and audience authority are rechecked before page/detail serialization.

`execute(actor, command, requestId)` accepts reaction/save/repost/hide/mute/share/comment/edit-comment/delete-comment/preferences/unmute/reset-hidden/report-draft. Next.js Server Actions derive the current active/onboarded actor and run Zod validation; no HTTP endpoints were invented. Reaction/save/repost carry the viewer's post revision; edits/deletes carry the comment revision; preferences carry their own revision. Replay is bounded to five minutes and checks current post access first. Explicit network retries preserve the ID; no automatic retry loop or optimistic publication approval exists.

Development requires NODE_ENV=development and COMMON_AUTH_MODE=mock, including factory checks. Production returns unavailable and protected routes redirect to login even with forged cookies. Synthetic post publication states include pending/restricted fixtures which never enter published projections. New content creation/upload/moderation is outside this phase. Sharing returns a relative canonical post URL without text/media; recipients independently need authorization. Report preparation returns a disclosure only, stores no evidence/case, and sends nothing to reviewers. Real reporting remains unavailable.

Required real services: cursor/page/schema agreement and order/freshness semantics, permission-filtered post/media/comment reads, reaction/save/repost revisions and idempotency, durable preferences/hidden/muted state, comment ownership/deletion/retention, distribution-level original-audience enforcement, session and permission revocation events, publication lifecycle/private storage, consent-based ranking, actual reporting/evidence receipt and reviewer access. There is no durable backend, signed-media service or centralized comment moderation in this preview. Service timeouts/cancellation/rate limits and cross-service atomicity must be specified when that transport exists.

## Phase 06 draft/publication adapter

No upload/moderation HTTP endpoints exist. `PublicationAdapter.list(actor)`, `read(actor, id)` and `execute(actor, command, requestId)` return typed results. Commands are save (new or id+version), begin, advance, retry, publish (always forbidden in preview), and cancel. Existing revisions are mandatory except cancel, which cancels the latest owned active version. Commands are strict: client owner IDs, destination states and decision fields are rejected. Server Actions derive active/onboarded identity, authorize each read/mutation and expose typed validation/unauthorized/forbidden/conflict/network/unavailable errors. Replay is bounded to five minutes, actor-scoped and fingerprinted; it returns the latest owned snapshot, never a stale pre-cancellation result.

Drafts include text, intended audience, self-declared AI disclosure, declared attachment name/type/size/alt and a scripted scenario. Metadata only reaches the development server; files/object URLs do not. Limits: six attachments, images 10 MiB each, videos 50 MiB each, combined 100 MiB, text 5,000 characters. Images need descriptions. These are declared metadata checks, not malware/byte/codec/content verification. The process store is bounded (20 drafts per actor / 500 total), non-durable and development-only with synthetic-content acknowledgement. Production remains unavailable even when the mock flag is set.

All status/progress/decision results are explicitly simulated. Scripted scenarios exercise low-risk-shaped approval, human-review hold, rejection, restriction, upload interruption and moderation timeout; they perform no AI detection or safety assessment. At simulated transfer 100%, state is PROCESSING, not approved. Review timeout stays REVIEW_REQUIRED. Retry is bounded to three attempts; cancellation remains terminal. Scripted APPROVED retains `distributionEnabled=false`; publish is rejected at the adapter boundary. No content is inserted into public feed/profile fixtures.

Appeal preparation is document-local and unsent; it issues no case ID and cannot change a decision. Safety help has no evidence intake or real report action. Self-declared AI labels provide no verified provenance/confidence. Required backend contracts: owned durable drafts; private signed upload sessions, resumability/cancellation and server byte validation; processing events; mandatory screening and specialist escalation; authenticated/versioned review decisions and target/escalation events; real rejection reasons and appeal eligibility/receipt; content-authenticity/provenance data; NCII/likeness reporting with restricted evidence access; authorization/audience and distribution enforcement. Upload completion, frontend clocks and self-disclosures must never supply approval authority.

## Phase 07 personal messaging boundary

`/messages` checks the existing active/onboarded development account. Production authentication stays unavailable. Messaging is a tab-local synthetic reducer, with no network transport, persistent messages, WebSocket subscription, encryption, key storage or E2EE claim. File bytes and object URLs remain in the current browser; attachment/audio previews are not uploads. Voice UI supports selecting and playing a local audio file; microphone recording/transcription is unavailable. Reports show an unavailable disclosure and submit no case. Local block/mute/request acceptance is not durable account enforcement. Permission controls simulate revocation and do not integrate graph permissions.

Typed `Message` separates stable client ID, optional acknowledged server ID, sequence, attempt count, delivery, content revision, edit/retry flags and active/deleted/expired lifecycle. Acknowledgments address client ID and attempt; duplicate IDs/server IDs are rejected, delivery advances monotonically, and stale-attempt failures cannot overwrite a newer attempt. Edits retain identity/sequence; tombstones redact text/attachments/reactions and cannot be resurrected. Replies resolve by ID so deletion/expiration hides quoted content. Queued sends resume after connectivity returns; in-flight sends resume the same attempt; failures require explicit retry with a three-attempt ceiling. Repeated acknowledgment controls are explicitly simulated. Receipts and typing have no remote meaning; typing expires after four seconds.

Required integration contracts remain blocked: authenticated participant-authorized history/search and pagination, durable idempotent client IDs, canonical ordering and cursor/sequence reconciliation, acknowledgment correlation/revision and replay semantics, offline durable queue retention, actual receipt/typing consent and expiry, message request/block/session revocation, own edit/delete/expiry windows and cross-device tombstones, scoped saved/pinned messages and preferences, private attachment upload/download authorization and safety, reporting receipts, and reviewed encryption/key/device protocol. Only connect real-time events when these contracts exist. Tab reload discards the entire messaging preview.

## Phase 08 group messaging and collaboration boundary

`/groups` requires the existing active/onboarded development account. `GroupState`, `GroupCommand`, `GroupOperation` and `GroupResult` are typed, tab-local preview contracts, not HTTP or real-time backend contracts. Synthetic participant switching is explicitly labelled. Production authentication remains unavailable. No invitations, reports or reminders leave the browser; group data, notifications and media are non-durable. No encryption implementation/status badge or E2EE claim is provided.

`executeGroup(state, {id, actor, groupId, revision, operation})` checks current active membership, role/permission, expected group revision and item revision for shared edits. Invitation/request acceptance has its own nonmember eligibility checks. Request replay is bounded to 500 applied commands and checks current membership; conflicting identity/fingerprint reuse is rejected. Messages retain request identity and monotonic sequence; explicit failed-send retry retains the request ID, adds nothing on failure, and never runs automatically. Read projections are mandatory for visible history, search, quotes/threads, pinned messages, polls, shared files/media and collaboration. This is UI/state enforcement only: synthetic fixture data exists in the browser bundle and is not a production confidentiality boundary.

Only active members can read or write content. Admins control details, permissions, roles, channels, pinning, poll closure, admission and removal; configurable active-member invitations/posting/collaboration do not grant administration. Announcement channels remain admin-only even when ordinary posting is allowed. Last-admin removal/demotion/leave is forbidden; promote another member first. Invitations (including failed/retried ones) never grant membership; the invitee must accept. Requests need admin approval. Removal or leave hides the entire group workspace immediately, clears open drafts and unsent object URLs, and denies subsequent actions/replays. Rejoining requires a fresh invitation/acceptance or eligible approved request. Joined sequence resets on every admission: new/rejoining members see only messages, files, polls and shared items created since that join. Replies whose roots are outside the allowed history appear without the inaccessible quote. Pending stale actions conflict after any intervening membership/content revision; removed actors fail authorization first.

Groups are limited to 20 per tab, 30 active/invited participants, 12 channels, 500 messages, 50 polls and 100 shared items. Search spans accessible messages and reply text/file names across topics. Polls allow one replaceable vote per participant and admin closure; UI counts active participants' votes. Notes support revisioned edits, tasks active-member assignment/completion, reminders local date/completion, events local date and RSVP. Reminder/event dates are local planning fields; no scheduler, calendar sync or delivery promise exists. Notification preferences store all/mentions/muted locally only. Shared media supports selected image/audio files; files support PDF/text, up to four files per message and 10 MB each. Object URLs remain local, with no upload, media scanning, private storage or signed distribution. Reports are unsent local notes with submission disabled.

Required real contracts remain blocked: participant-authorized group/directory reads, moderated requests and invitation consent/delivery/revocation, role and permission authority with expected membership epochs/revisions, cross-device revocation and projection invalidation, message ordering/idempotency/history policy/threads/mentions, durable polling and shared-item concurrency, notification and reminder delivery, media safety and authorized file distribution, report case receipts/moderation, and independently reviewed encryption with membership/key rotation. No WebSocket or speculative service integration is connected.

## Phase 09 rich media and live boundary

Protected routes: `/stories`, `/reels`, `/videos`, `/videos/[id]`, their `/create` routes, and `/live`. Active/onboarded identity is required on every read and action; the existing development-only authentication gate disables previews in production. `MediaAdapter.catalog`, `read` and `execute` derive current creator/audience access from the Phase 04 profile adapter. Blocking a creator removes their media from discovery, details, saved items and interactions, including action replay. Direct held/restricted/unknown IDs return a generic denial without title, poster, source or captions. Focus/visibility resumption rechecks current access; while that check is pending or fails, players and interactions unmount. BFCache restores reload. Already delivered bytes cannot be made unseen; event-driven revocation and actual media authorization still require services.

`MediaRecord.source` distinguishes fixture/service/author-draft. `FIXTURE` is a viewing-fixture designation, never a publication decision. Only closed repository-authored SVGs and the original synthetic animation enter the preview catalog. Their distribution flag is false, with no moderation/analytics claim. These public static files are not private storage. Pending/restricted fixtures never serialize through the media adapter. User files/object URLs are never inserted into this catalog. Future service-backed records need PUBLISHED, backend decision evidence, explicit distribution authorization, applicable audience access and expiry/highlight authority.

Media drafts reuse the Phase 06 `PublicationAdapter`, Server Actions, validation and transition model. Optional draft `format` distinguishes post/story/reel/video without changing old post behavior. Reels/videos require a declared video attachment; the existing six-file / 100 MB total, 10 MB image / 50 MB video limits and descriptions apply. Creator file previews remain owner-local; only metadata reaches the development server. Simulated upload 100%, screening/approval or a client-side duration never grants publication. Drafts stay outside story/reel/video discovery, even after APPROVED. Restored files must be reselected. No real upload, transcoding, detection, specialist review or distribution service is connected.

`execute(actor, {operation,id,...}, requestId)` supports explicit save values, reactions, own-story highlights, comments and permission-checked preview links. Strict Zod input rejects owner/source/publication fields. Replays are actor-scoped, fingerprinted, expire after five minutes, and recheck current media access before returning the latest projection. Explicit unconfirmed comment retries preserve their ID and draft, with no automatic retry loop. Development state is process-local and bounded to 100 actor stores, 100 comments per fixture and 1,000 replay records. There are no real engagement/view/performance counts. Saved media retains permission requirements; links contain no bytes or asset URLs, and recipients must authenticate independently.

Story fixtures have 24-hour process-clock availability; normal trays exclude expired stories, while eligible creator highlights retain approved fixture availability without overriding blocking/restriction/audience checks. Only creators can change their highlight selection. This models UI behavior, not durable archives or verified viewer analytics. Playback starts paused, uses native media events/controls, handles metadata/buffering/failure/manual retry, pauses offscreen/hidden/on blur, and tears down old sources when switching or denying media. Captions use a bundled WebVTT track with a transcript fallback; no speech-recognition/subtitle provider is claimed. Reel discovery is deterministic fixture order, not a recommendation system. Long-form layout uses the same six-second fixture; it is not a full creator video.

Live is separate from recorded pre-publication screening. `LiveProvider` exposes an unavailable capability snapshot and rejects start/stop. The UI cannot acquire camera/microphone or start ingest, playback, comments, captions, reports or moderation. Connecting/disconnected/interrupted controls are labelled UI simulations with no transmitted frames. An unsent local plan is not a schedule or eligibility receipt. Recorded approval cannot authorize future live frames. A real provider requires authenticated eligibility and audience authorization, ingest/signed playback, continuous detection and human escalation, reporting, moderator controls and emergency interruption/restriction, plus authenticated capability/session/event schemas. Completed recordings must enter the ordinary private processing/screening/review workflow before replay publication. No live HTTP, WebSocket, RTC, HLS or provider token contract has been invented or connected.

## Phases 10–11 provider boundaries

Community commands derive actors from the active server session; strict schemas reject injected actors/roles. Detail/search projection precedes serialization and excludes private posts/topics/events/discussions for nonmembers. Public directory metadata is limited to name/description/visibility; generic shared metadata has no content. Profile visibility and bilateral blocks filter owners/authors. Membership, events and page writes require current versions and authorized roles/ownership. RSVP views reveal only the current actor's participation. A future durable provider must atomically verify membership and versions, enforce publication safety for all actual user content, and invalidate private indexes/previews on revocation.

Trust commands derive the actor and reviewer role server-side. Preview roles come solely from deployment UUID allowlists and are re-read on every check. Reporter views contain only their cases; queues require reviewer scope; audit requires admin. Evidence has no storage/provider and is never returned. No report attachment endpoint exists. Audit stores opaque identifiers and transitions only; ordinary logs never receive report contents/media. Appeals have bounded synthetic notes; report request fingerprints prevent duplicate acknowledgments with a bounded receipt map. Deadline expiry cannot dismiss a report or publish content. Reversal is a simulated case transition and cannot override Phase 06 approval gates.

A real trust provider must supply authenticated report/appeal receipts, service-issued scoped roles, operational review targets, evidence minimization and specialist grants, revocation, immutable durable audits, notifications and versioned cross-surface enforcement. No AI confidence value is conclusive proof; the preview exposes uncertainty with no connected classifier. Privacy audience writes use the existing authoritative profile graph; discovery filtering uses the current server preference. Security preferences are not active security services. Focus/visibility revalidates sensitive projections; BFCache restoration reloads access. Continuous revocation push remains blocked pending service contracts.

## Phase 12 advanced platform boundaries

`AdvancedAdapter` exposes typed creator, marketplace, seller, wellbeing and mutation operations. It is selected only in explicit development mock mode; all production operations fail closed. Server Actions derive the active onboarded actor, use strict schemas rejecting actor/status/financial injection, and recheck owned resources and profile visibility/block rules. Mutations serialize per actor, use current versions and a bounded 500-result fingerprint replay cache; no automatic retry occurs. Plans are capped at 50 per owner and listing drafts at 20. Results are copied to protect stored records. These limits and serial queues model development behavior, not durable distributed transactions.

Creator snapshots use the authoritative owner-only publication adapter. Analytics and monetization are unavailable objects with null data, never zero-valued fictional measurements. Confirmed plans target a specific owned draft/approved revision and a future UTC date within one year; held states reject plans. Duplicate active plans are rejected. Due times do not execute jobs and stale revisions remain plans only. A real scheduler must atomically verify current ownership, revision, audience and Phase 06 backend approval/distribution evidence at dispatch and support authenticated cancellation/idempotency.

Marketplace discovery contains only closed repository fixtures. Authored synthetic text drafts are owner-only, unpriced, undistributed and cannot be promoted by a client command. Draft editing/withdrawal requires ownership/version/confirmation. Listing, seller and buyer entry read the same profile authorization; denied reads include no title/artwork/seller data. Shared metadata is generic. Reporting links enter the Phase 11 simulated report workflow. Buyer drafting rechecks listing access at `/messages?listing=…`; it creates neither a conversation nor delivery receipt and cannot call the unrelated personal-chat fixture. Real listing moderation, seller eligibility, private media storage, inventory, fraud/transaction status, payments and buyer transport have no approved contracts.

`AssistantProvider` exposes status/generate but currently returns only unavailable errors; no external AI request, canned output or generated provenance exists. Writing/caption/accessibility requests use synthetic input and explicit consent; translation/summary take only freshly authorized public source IDs, with server text replacing browser text. Private/friends/blocked/restricted content is denied before provider invocation. Failures produce no output; stale client responses are ignored. Manual text save is explicitly human-authored, requires reviewed confirmation and enters a private Phase 06 draft. Real provider integration requires consent/data minimization/retention/cancellation, authenticated eligibility, scoped public source references, safety policy and reviewable output/provenance; consequential application must remain confirmed and pass ordinary publication gates.

Well-being preferences are per actor/version, with validated IANA zones and overnight/DST-aware quiet policies. The root client provider uses an isolated preference leaf and authenticated Server Action to load only the current actor's preferences; no guest receives account settings. Page forms do not depend on preference loading or JavaScript to expose their existing no-script explanations. The local timer counts approximate focused/visible time in the current document while opted in; it is not measured screen-time analytics or an enforced OS limit and resets on document/account changes. Videos remain paused initially and automatic next-story navigation is off by default. Home discovery/default feed settings write the existing authoritative feed adapter. Notification preferences and quiet-hour policy have no sender to govern yet; a future provider must check the current policy at delivery and define essential security notifications separately. No push registration, permission prompt, email, notification event or analytics record is invented.
