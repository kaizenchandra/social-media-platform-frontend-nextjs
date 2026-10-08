# Implementation roadmap

**Document state:** Phase 00 assessed; Phase 02 verified; Phases 03–12 development previews implemented. Production authentication remains unavailable.
**Prepared:** 2026-10-08.

## Execution phases and current scope

The user's explicit phase requests supersede earlier proposed numbering. Legacy P0–P4 below are product workstreams, not aliases for the user's execution phases. Source priority labels remain independent. No phase after Phase 12 has started.

| Execution phase | Scope | Current state / exit gate |
|---|---|---|
| 00 — Assessment | Inventory, risks, architecture and requirement coverage | Completed with read-only evidence |
| 01 — Application foundation | Root styling/fonts, configuration, errors, themes, API/error models and test tooling | Interrupted. Layout/design/test portions delivered as Phase 02 prerequisites; environment/API foundation and full exit gate remain incomplete |
| 02 — Design system and shell | All requested tokens/primitives, themes, responsive navigation, component library and states | Implemented and verified: nine component tests, 21 browser checks; Webpack build passes; default Turbopack environment restriction documented |
| 03 — Authentication and accounts | Login/registration, verification/reset/recovery/MFA, onboarding/settings/devices/sessions and lifecycle UI | Development adapter only; selected IDs and production/provider gaps recorded in status. Passkeys unavailable until provider selection |
| 04 — Profiles and social connections | Own/public profiles, artwork/details/audience editing, permitted timeline/media/featured content, requests/friendship/follows/favorites/block/restrict | Development adapter implemented; service and arbitrary-upload publication unavailable; verification recorded in status |
| 05 — Social feed and engagement | Home/friends/following/chronological/discovery feeds, preferences, post cards, reactions, comments/replies/edit/delete, public repost references, sharing, saves/hide/mute/report entry and cursor pages | Development adapter implemented; 50 unit/component and 30 production browser checks pass; all ten feed browser checks pass, whole development run 39/40 with failed auth check passing isolated rerun; services unavailable |
| 06 — Content creation and media safety | Private composer, safe formatted text, audience/disclosure, local image/video attachments, drafts/preview, typed upload/screening/review status, retry/cancel, explanations and unsent appeal/support entry | Development simulation implemented; no byte transfer/detection or public distribution; authenticated media/review/report/appeal/distribution services remain launch blockers; verification recorded in status |
| 07 — Personal messaging UI | One-to-one inbox/chat, typed finite send lifecycle, interactions, local media and connectivity/permission simulations | Tab-local synthetic preview implemented; 11 messaging tests and two desktop/mobile browser journeys pass; real messaging, encryption and enforcement services unavailable |
| 08 — Group messaging and collaboration | Membership/roles/permissions, channels/threads/polls/media and shared planning | Tab-local development preview implemented; membership and content projections tested; integration/encryption remain blocked |
| 09 — Rich media experiences | Stories/reels/video viewing and engagement, private media drafts and separate live boundary | Authenticated development fixtures implemented; Phase 06 publication gate retained; actual media and continuous live safety services unavailable |
| 10 — Communities and discovery | Public/private membership, content/events/pages and filtered search | Server development preview; versioned permissions and private projections tested; production providers unavailable |
| 11 — Trust, safety, privacy and moderation | Privacy, categorized reports, appeals, role-specific review and audit | Server development simulation; restricted evidence unavailable and publication unchanged; stop after Phase 11 |
| 12 — Advanced social platform features | Creator management/private planning, marketplace/private listings, consented assistance boundaries and well-being | Development adapters implemented; no fabricated metrics/financial events/AI outputs; actual providers unavailable; stop after Phase 12 |
| Subsequent selected slices | Social core, safety/publication, communication, rich social and ecosystem workstreams | Await explicit request; approve exact IDs/contracts before each implementation; actual authorization, privacy, moderation and provider integration remain launch gates |

## Delivery policy
Use complete vertical slices, not a page-count target. All 615 source IDs remain retained; deferred domains are still scope. P0–P4 below are legacy product workstreams; Critical/High/Normal are priority labels, avoiding confusion between phase and priority. No dates, staffing estimates or implementation completion are asserted.

| Phase | Scope and representative traceability | Dependencies | Exit gate |
|---|---|---|---|
| P0 — Foundation | Scaffold, design tokens, adapter modes, FE-001–004/010, source ledger refinement | Installed starter, branding/token decisions and verification tooling | Build/lint/typecheck scripts run; shell/accessible primitives; demo mode visible; no dead routes |
| P1 — Secure social core | FR-001–180 as applicable; profiles, graph, feed/posts, safety, notifications/privacy, report/appeal and minimum reviewer tools from later FR groups | Identity, private media pipeline, policy/roles, reports and review services | End-to-end create → upload → screening → eligible publish; denied audiences; fail-closed hold; appeal/status; genuine service checks before public launch |
| P2 — Communication | Personal/group messaging, calls, encrypted backups, related privacy and FE-007/008/011 | Protocol/key lifecycle, message/events, device/membership, RTC | Retry/reconnect/idempotency; revoked members; correct receipts; encryption integration independently verified |
| P3 — Rich social experiences | Stories/reels/long video/live, communities, pages/events, search, creators and expanded operations | Processing/live safety, scoped search, membership, analytics | One full owner/member/viewer/moderator journey per slice; ongoing live safety; media/audience controls consistent |
| P4 — Modern ecosystem | AI, collaboration, provenance, marketplace, ads/monetization; MOD-D56–80 investigations | Scoped AI consent, provenance/payment/metrics services, feasibility and policy decisions | Approved atomic stories and contracts; truthful metrics/transactions; consequential action review; no speculative placeholder claims |

P1 must select exact IDs from the source ledger, including launch-critical safety requirements outside the early numeric range. Ranges are not exhaustive release assignments. Before each phase starts, assign every selected FR row to its slice/contract/test and explicitly defer remaining rows with reasons. Baseline upload priorities in requirements remain source suggestions.

## First concrete slice
1. Phase 02 shell/primitives are delivered. Finish remaining Phase 01 environment/API foundations when requested; business data state adapters remain separate.
2. Phase 06 composer/publication UI is delivered in explicitly simulated mode. Integrate approved private upload, processing, screening, review, appeals and distribution contracts before production publication. Frontend progress and review deadlines supply no approval authority.
3. Mock workflow: choose audience → compose → validate benign attachment → upload → screening hold → approved or rejected → eligible appeal. Show demo mode throughout.
4. Add component tests for cancellation, retry, duplicate submission, processing failure, expired review target and rejected publication.
5. Add browser tests for complete author and unauthorized viewer journeys at mobile/desktop widths.
6. Integrate approved identity/content/media/report contracts; verify actual private storage and distribution denial before production publication.
7. Update source ledger and status with real code/tests and evidence; mock completion alone cannot pass the public launch gate.

## Non-negotiable launch dependencies
Mandatory media screening, specialist child-protection escalation, non-consensual imagery/likeness reports, blocking, account enforcement, human review, appeals and access-controlled distribution are launch-critical. A frontend-only demo can be delivered earlier with clear mode labels. Service detection quality and moderation staffing are operational dependencies, not promises made by UI code.

Encryption cannot be waived by a lock icon. Calls need media/signaling service support. Commerce requires a real transaction authority; AI needs permission-filtered context and explicit private disclosure controls. Keep unavailable integrations gated.

## Prioritization and change control
Prioritize safety/privacy blockers, then coherent user journeys and dependencies. Evaluate modernization by user demand, usability, feasibility, safety, privacy, cost and measurable benefit. D78 interoperability and D80 future innovation require discovery before commitment. Web implementation does not fulfill native mobile requirements automatically.

For consolidation, splitting, replacement, rejection or deferral, record decision/rationale, affected IDs, successor IDs, owner, dependency and phase. Do not remove a baseline capability merely because it is outside the first release.

## Definition of done per slice
Selected requirements have atomic acceptance criteria; all required states and permissions work; adapters and mode are explicit; relevant checks actually pass; accessible responsive flows are reviewed; backend claims have integrated evidence; documentation/status/traceability agree. Partial work remains Partial, unavailable services remain Blocked for integration, and unselected features remain Not started.

## Phase 00 follow-up priorities

1. Phase 01: reconcile semantic tokens/typography, verify mobile/zoom/focus, add justified test tooling and CI, validate clean-checkout generated types and production build. Preserve installed compatible dependencies.
2. Before integrated authentication and social core: product/backend owners approve identity/session and endpoint schemas, effective privacy rules, private media storage and distribution, moderation/reports/appeals scopes and operational ownership. These owners are not yet identified in the repository.
3. Before communication: select reviewed encryption/key/device/backup protocol and realtime/RTC services.
4. Before rich social/ecosystem: approve feature-specific memberships, indexes, live safety, analytics, AI consent and payment contracts. Native clients and federation remain separately scoped.
5. Preserve all 615 source ledger rows. Phase 00 records zero implemented source requirements; FE criteria and domain proposals remain unverified until selected slices have code/test evidence.

## Phase 05 stopping point

Selected feed/engagement frontend journeys use isolated synthetic adapters; production integration remains blocked on the documented service contracts. Cursor pagination satisfies the requested pagination option but does not implement automatic infinite scrolling. Recommendation explanations disclose deterministic preview discovery. No composer, arbitrary upload, publication approval, report receipt, messaging or later business module was started. Stop after Phase 05 and await the next explicit phase request.

## Phase 06 stopping point

Selected author/safety interfaces are implemented with isolated development adapters. Real publication remains blocked: no private upload service, authenticated moderation authority, specialist review/reporting, appeal receipt or distribution service is connected. All simulated results are labelled and public publication is forbidden. No Phase 07 or unrelated business module started. Historical Phase 05 statements above describe its stopping point.

## Phase 07 stopping point

Personal messaging UI is implemented as an authenticated tab-local synthetic preview. History/search, composer and finite send lifecycle, receipts/typing simulations, replies/reactions/edit/delete/expiry, local audio/attachment previews, settings/collections/requests and offline/disconnected states are included. Actual transport, durable storage, microphone capture, encrypted protocol and reporting/enforcement integrations remain unavailable. See the Phase 07 boundary in `api-contracts.md`. This is the historical Phase 07 stopping point; the explicitly requested Phase 08 is recorded below.

## Phase 08 stopping point

Group messaging and collaboration are implemented at `/groups` as a tab-local authenticated development preview. Role permissions and versioned membership commands, invitation failure/retry/consent, join-scoped content and removal, announcement/topic channels, threads/mentions/pins/search, polls/media and notes/tasks/reminders/events are covered. Real messaging, invitation delivery, durable permissions/storage, scheduling/reporting and group encryption remain unavailable. No Phase 09 or later module started.

## Phase 09 stopping point

Rich media UI is implemented at `/stories`, `/reels`, `/videos`, `/videos/[id]`, media creator routes and `/live`. Synthetic viewing fixtures, controls/captions/engagement, creator information and publication-safe private drafts are available only in the authenticated development preview. Live remains an explicitly unavailable provider boundary with unsent plans and connection-state simulations. Real private media storage/processing/screening/distribution and continuous live monitoring/interruption/reporting remain blocked. No Phase 10 or later module started.

## Phase 11 stopping point

Phase 10 community/discovery and Phase 11 trust interfaces are implemented as explicit development simulations. Membership and privacy projection, ownership, role changes, review expiry, appeals/reversal and audit minimization are covered by tests. Real storage, indexes, service-issued reviewer scopes, specialist evidence access, report/appeal delivery and cross-surface enforcement remain integration gates. Earlier stopping-point statements are historical. No later phase started.

## Phase 12 stopping point

The four explicitly requested areas are implemented according to the existing privacy/publication foundation. Creator content reuses Phase 06, marketplace publication remains unavailable, AI returns no generated output without a provider, and well-being recommendations use Phase 05 controls. Financial transactions, live analytics, AI generation, automatic publishing, notification delivery and monetization events were not fabricated. Development journeys and provider boundaries are tested/documented. Historical phase stopping points above are preserved. Stop after Phase 12.


## Phase 13 stopping point

Complete implemented-frontend review, scoped hardening and release verification are recorded in [Phase 13 report](../verification/phase-13-release-verification.md). Existing requirement classifications are retained. No production release is certified while services, security guarantees, dependency remediation and deployment gates remain unverified. No later phase or deployment was started.
