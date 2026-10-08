# Implementation roadmap

**Document state:** Starter specification; no application, backend, dependencies, tests, or deployment exist in this package.
**Prepared:** 2026-10-08.

## Delivery policy
Use complete vertical slices, not a page-count target. All 615 source IDs remain retained; deferred domains are still scope. P0–P4 below are delivery phases; Critical/High/Normal are priority labels, avoiding confusion between phase and priority. No dates, staffing estimates or implementation completion are asserted.

| Phase | Scope and representative traceability | Dependencies | Exit gate |
|---|---|---|---|
| P0 — Foundation | Scaffold, design tokens, adapter modes, FE-001–004/010, source ledger refinement | Repository, dependency/version selection | Build/lint/typecheck scripts run; shell/accessible primitives; demo mode visible; no dead routes |
| P1 — Secure social core | FR-001–180 as applicable; profiles, graph, feed/posts, safety, notifications/privacy, report/appeal and minimum reviewer tools from later FR groups | Identity, private media pipeline, policy/roles, reports and review services | End-to-end create → upload → screening → eligible publish; denied audiences; fail-closed hold; appeal/status; genuine service checks before public launch |
| P2 — Communication | Personal/group messaging, calls, encrypted backups, related privacy and FE-007/008/011 | Protocol/key lifecycle, message/events, device/membership, RTC | Retry/reconnect/idempotency; revoked members; correct receipts; encryption integration independently verified |
| P3 — Rich social experiences | Stories/reels/long video/live, communities, pages/events, search, creators and expanded operations | Processing/live safety, scoped search, membership, analytics | One full owner/member/viewer/moderator journey per slice; ongoing live safety; media/audience controls consistent |
| P4 — Modern ecosystem | AI, collaboration, provenance, marketplace, ads/monetization; MOD-D56–80 investigations | Scoped AI consent, provenance/payment/metrics services, feasibility and policy decisions | Approved atomic stories and contracts; truthful metrics/transactions; consequential action review; no speculative placeholder claims |

P1 must select exact IDs from the source ledger, including launch-critical safety requirements outside the early numeric range. Ranges are not exhaustive release assignments. Before each phase starts, assign every selected FR row to its slice/contract/test and explicitly defer remaining rows with reasons. Baseline upload priorities in requirements remain source suggestions.

## First concrete slice
1. P0: scaffold shell and accessible primitives; create deterministic mock fixtures for loading, empty, denied, failed and stale states.
2. Define feed/composer source IDs (FR-051–090), screening policies and FR-091–163, ownership/audience requirements and FE-001–006/010.
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
