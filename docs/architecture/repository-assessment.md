# Phase 00 — Repository discovery and architecture assessment

**Assessed:** 2026-10-08. **Scope:** repository evidence and documentation only. Phase 01 not started.

## Evidence and current functionality

Root `AGENTS.md` is the only repository instruction file found outside dependencies/build output; no nested application instructions were found. All six requested product, architecture, design, integration, roadmap and status documents exist. The initial working tree was clean. Assessment reviewed application/configuration files, npm manifest and lockfile, requirement ledger and safety/state criteria, and installed Next.js layout, CLI, caching, partial-prefetch and font guides.

| Area | Observed implementation | Assessment |
|---|---|---|
| Routes/components | Root `app/page.tsx`, `layout.tsx`, favicon; no feature or shared UI components | One static starter route, framework documentation/deployment links and local SVG images. No social functionality. Source/type validity verified; rendered runtime not verified |
| Rendering | Server Components by default; root HTML language, main landmark, heading and image alternatives | Useful semantic starting point; no interactive client features, custom loading/error/not-found boundaries or navigation shell |
| Toolchain | npm lock v3; Next 16.4.0; React/DOM 19.3.0; TS 5.9.3; Tailwind/loader 4.3.3; ESLint 9.39.5 | Installed direct versions match lockfile; manifest dependency sections match lock root; npm reports no invalid/missing direct dependencies |
| TypeScript | strict, noEmit, bundler resolution, root `@/*`, Next plugin, generated route includes; allowJs and skipLibCheck | Retain established configuration. No typecheck script. Current check relies on existing generated route context; clean checkout needs typegen |
| Next config | Cache Components and Partial Prefetching enabled; Turbopack CSS loader | Both cache options are documented for installed version; loader integration retained. No custom security headers, image origins, redirects or service configuration |
| Styling | Tailwind import, background/foreground variables, system dark mode, Geist variables; starter uses zinc colors | Minimal tokens; design document's semantic palette unimplemented. Body Arial rule differs from page font-sans/Geist; theme selection absent |
| Authentication | No provider/session code, guards, cookies or login routes | Unavailable, not mock authentication |
| API | No route handlers, service clients, runtime schemas or adapters | Contract document is proposals only; no base URL or connected backend |
| State | No application store, query cache or Context providers | No present need for global-state dependency |
| Tests/CI | No test files, runner, browser/axe config or CI workflows found | ESLint and TypeScript pass; no behavior or accessibility verification |
| Documentation | Six requested documents plus starter README and AGENTS | Starter claims of no repository/application are stale; assessment/architecture/roadmap/status now reconciled. Product/design/API specifications remain proposals |

## UI/UX and accessibility gaps

Starter branding and metadata are Next.js/Vercel rather than a product identity. Theme follows OS only. Page colors bypass the proposed palette; semantic surfaces, error/success/focus tokens and reusable controls are missing. There is no member navigation, form validation, async feedback, skeleton, empty state, recoverable error, privacy/audience control or reduced-motion rule. Starter outbound links opening new tabs already have `noopener noreferrer`.

The existing main landmark, heading, language and image alternatives are positive source observations, not WCAG certification. Fixed horizontal `px-16` padding and large vertical spacing require 320px and zoom review; overflow has not been observed in a browser. Contrast, keyboard focus, touch targets, light/dark layouts, RTL and media behavior remain unmeasured. Add patterns only as working slices need them.

## Compatibility and reproducibility

Node v24.21.0 and npm 11.19.0 were used. Installed Next requires Node >=20.9.0, React/DOM peer requirements accept the installed versions, and installed ESLint accepts the current runtime. No immediate incompatibility was found. `@types/node` targets 20 while the local runtime is 24; agree deployment runtime before using newer Node APIs. No engines/packageManager/runtime pin exists. Development dependency ranges permit changes on lock updates; preserve the lockfile and use npm ci for future reproducibility checks rather than upgrading during assessment.

Installed guides confirm the cache/prefetch pairing and explain retained Activity route state. Session revocation must remove private retained UI as well as server/query caches. Global `LayoutProps` is generated: future CI should run `next typegen` before `tsc --noEmit`. The existing TypeScript pass is not a clean-install guarantee. Tailwind's dedicated Turbopack loader makes a missing PostCSS file insufficient evidence of a defect; production CSS output still needs validation.

Geist uses `next/font/google`: build-time font download needs network access; the installed font guide states browser assets are self-hosted. Do not characterize this as browser requests to Google. No registry vulnerability audit, fresh install, production build or dependency-upgrade recommendation was performed.

## Recommended architecture

Retain root `app/`, strict TypeScript, `@/*`, npm and the existing compatible stack. Use route layouts and Server Components for appropriate reads, small Client Components for interaction. Add `components/ui`, `features/<domain>`, `lib/api`, `lib/auth`, `lib/config`, `mocks` and test utilities only when needed; keep tokens in `app/globals.css`. See [frontend decisions](frontend.md) for route families and ownership.

Feature contracts separate presentation from transport and normalize validation, authorization, conflict, timeout/network and terminal errors. Use native Fetch, AbortSignal and local React/URL state initially. Introduce runtime schema validation and testing dependencies when their first concrete slice needs them; defer query/global-state libraries until demonstrated requirements justify them. Explicit development adapters must never fall back from failed real requests to fixture success. Production integration absence fails closed.

Use service-authoritative identity, audience, publication and moderation decisions. Session-aware reads and retained client state must be isolated and cleared on logout/revocation. No generic route guard, cache key or UI visibility toggle substitutes for backend authorization. E2EE must use an agreed reviewed protocol rather than custom cryptography; AI access requires authorized context and explicit scoped private disclosure.

## Requirement coverage

A ledger scan found **615 unique rows: FR-001–610 and FR-POL-001–005**, all RETAIN and Not started. There are 12 authored FE criteria and 80 planned domain register entries, none verified by feature tests. The starter route does not fulfill any source feature requirement; Phase 00 adds assessment evidence only.

| Scope | Actual coverage | Delivery dependency |
|---|---|---|
| FE-001–004/010 | None verified; basic semantic starter only | Phase 01 establishes reusable states, keyboard/responsive foundations and adapter mode; feature-specific mutation/privacy proof continues in Phase 02 |
| FR-001–050 | No identity, profiles or graph | Identity/session/eligibility, discoverability and graph contracts |
| FR-051–090 and interaction group | No feed/composer/posts/interactions | Audience-scoped content, versions, idempotency and approved publication |
| FR-091–163; FR-POL-001–003/005; FE-005/006/012 | No media/safety/review/report/appeal implementation | Private storage/distribution, policy and specialist workflows, reports/audit and staffed review |
| Personal/group messaging, FE-007/008/011, FR-POL-004 | No messaging, encryption, reconnect or cache lifecycle | Protocol/keys/devices/backups, membership and replay events |
| Rich social, creator/business/search/notifications/privacy | No implementation | Feature-specific scope/eligibility, indexes/events and effective settings |
| AI/commerce/ads and MOD-D56–80 | Investigation/specification only | Atomic acceptance criteria, scoped AI consent, real financial/metrics/provenance authority |

Ranges describe existing planning groups, not full release assignments. Preserve every ledger row; select exact IDs, allowed/denied actors, atomic acceptance criteria, route/contract and code/test evidence before each slice. Domain-to-source semantic mapping and named service ownership remain incomplete. Priority P0–P3 in source text differs from legacy delivery P0–P4; [roadmap](../implementation/roadmap.md) now provides explicit user-facing phase aliases.

## Risks, blockers and actions

| Priority | Finding / evidence | Action and owner needed |
|---|---|---|
| Critical launch blocker | No authoritative identity, audience or private media pipeline | Backend/identity/trust-and-safety owners must approve services and prove storage/distribution denial; frontend fixtures cannot pass launch gate |
| Critical communication blocker | No E2EE protocol/device/key/recovery or transport | Messaging/security owners select protocol and verify actual integration before claims |
| High | No tests/CI/build evidence; existing generated types can mask clean-checkout gaps | Frontend/QA owners establish typegen, test/build pipeline and responsive/manual accessibility checks in Phase 01 |
| High future privacy risk | Cache Components retains client routes; no session/caching implementation yet | Verify user switching, logout/revocation and membership removal clear retained private data in Phase 02/03 |
| High specification risk | Proposed endpoints, unspecified provider/owners and unfinished atomic mappings | Product/backend owners approve contracts and slice assignments before integration; never call proposal an implemented API |
| Medium | Runtime unpinned; Node type/runtime mismatch; network-dependent font build | Agree deployment runtime and repeat clean npm ci/typegen/build in suitable environment; evaluate fonts after evidence |
| Medium | Minimal tokens, branding and unverified mobile/zoom/focus | Establish coherent product design and rendered checks in Phase 01 |
| Medium release risk | No explicit CSP/security-header, secret/config validation, CSRF or telemetry policy implementation | Review deployment headers and session mutation protections with concrete integrations; absence is not an observed exploit |

No credentials, private messages or user content were found in the reviewed application/config files. Environment values and private IDE files were not inspected. No claim of complete secret scanning or vulnerability clearance is made. Current missing auth is a feature absence, not evidence that private data is presently exposed. Backend owners, deployment environment and policy/operational responsibilities are unassigned in repository documentation.

## Executed verification and limits

On 2026-10-08: `npm run lint` passed; `./node_modules/.bin/tsc --noEmit --incremental false` passed; `npm ls --depth=0` passed. Python read-only checks confirmed direct installed/locked versions, manifest/lock root consistency and unique requirement ledger rows. Documentation diff and relative-link checks are recorded in [status](../implementation/status.md).

No build/dev/typegen/install command was run: these generate artifacts or change dependencies, outside the requested read-only verification. No unit/component/E2E/axe tests exist. Browser, responsive, performance, real service, E2EE and media safety checks were not run. Assessment completeness does not imply feature completion or production readiness.
