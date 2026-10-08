# API contracts and integration boundaries

**Document state:** Starter specification; no application, backend, dependencies, tests, or deployment exist in this package.
**Prepared:** 2026-10-08.

## Contract authority and capability mode
Everything below is a proposed frontend-facing contract, not an available backend API. Backend owners must approve paths, schemas, limits, authentication, events and policy semantics before integrated work. Route handlers may act as a backend-for-frontend but cannot manufacture production identity, encryption, moderation or payment guarantees.

Each capability declares `mock | integrated | unavailable`. Development defaults to deterministic mock adapters; release configuration must fail closed if required integration is absent. A visible demo banner identifies mock mode. Do not mix fixture identities with real sessions or fall back to fixtures after service errors.

| Capability | Permitted development simulation | Required integrated dependency | Current state |
|---|---|---|---|
| Identity/MFA/passkeys | Fixture login and expired/locked states | Identity provider, session, verification, age policy | No adapter/service |
| Feed/profile/social graph | Seeded pages and permitted/denied actors | Audience-aware graph/content/ranking | No adapter/service |
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
