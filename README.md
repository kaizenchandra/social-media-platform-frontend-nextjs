# Common

A Next.js 16.4 / React 19.3 application with a responsive design system and development-only authentication, profile, social connection, feed, engagement, private content-creation and local personal/group messaging and rich-media journeys. Root `app/`, strict TypeScript, Tailwind and npm conventions are preserved.

## Run locally

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Authentication is unavailable by default. To enable synthetic account flows, copy `.env.example` to `.env.local`, uncomment `COMMON_AUTH_MODE=mock`, and restart `next dev`. Use only `.test` emails and passwords created for the preview. No real identity, email, MFA, passkey or recovery provider is connected. Production always disables preview authentication, even if the mock flag is set.

The sign-in page lists public fixture credentials and failure scenarios. Accounts, hashed preview passwords, challenges and sessions are process-local and disappear when development restarts. Preview sessions expire after 15 minutes; challenges after 10 minutes. Passkey controls explain their missing provider and stay unavailable.

## Routes

- `/stories`, `/reels`, `/videos`, `/videos/[id]`: protected synthetic rich-media experiences.
- `/stories/create`, `/reels/create`, `/videos/create`: private Phase 06 media workflows.
- `/live`: unavailable live-provider studio and unsent planning interface.

- `/messages`: authenticated tab-local personal messaging preview.
- `/groups`: authenticated tab-local group conversations, membership and collaboration preview.

- `/`: authenticated development home feed with Home/Friends/Following/Chronological/Recommended views.
- `/saved`, `/posts/[id]`: permission-filtered saved posts and comment threads.
- `/overview`: foundation overview.
- `/design-system`: interactive component library; examples are local only.
- `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/mfa`, `/recovery`: account entry journeys.
- `/onboarding`, `/account`, `/account/sessions`: server-checked preview account interfaces.
- `/profile`, `/profile/[username]`: own/public audience-filtered profiles, editing, featured posts and media.
- `/create`, `/drafts`, `/content/[id]`, `/content/[id]/appeal`: private composer, owner drafts and simulated publication/appeal interfaces.
- `/safety`: sexual-content, consent and authenticity help; real reporting disabled.
- `/connections`: requests, friends, followers/following, suggestions, favorites, blocks and restrictions.

With preview mode enabled, visit `/profile/ava` for a guest public view. Each synthetic account starts with sample relationships. Profile posts and artwork are explicitly synthetic. Cover/avatar choices are local illustrations; arbitrary photo uploads remain unavailable until storage and safety screening are connected.

Feed preferences, reactions, saves, public repost references and comment threads use the same development-only process store boundary. Pagination has four posts per cursor page; cursors expire after ten minutes. Sharing copies a permission-bound URL; report entry prepares a disclosed preview draft and never sends a report. Restarting loses engagement and preferences. Pending/restricted fixtures are excluded, including for owners.

No real social backend, media upload, messaging, moderation or AI service is connected. System fonts require no remote font download. Theme preference is the only value persisted in browser local storage; credentials and session values are never stored there.

## Verification

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Turbopack worker-port binding is blocked in the current agent environment. A supported fallback uses the matching Tailwind PostCSS adapter:

```sh
npm run build:webpack
npm run start
```

For development in that environment, use `npm run dev -- --webpack`.

Browser tests require Chromium (`npx playwright install chromium`):

```sh
npm run build:webpack
npm run test:e2e
npm run test:e2e:auth
```

The first browser suite starts a production server on 3100 and checks the shell plus production auth/profile/feed/publication denial. The development suite starts an explicitly enabled development simulation on 3101, in `.next/auth-preview`, without stopping the IDE server. Run builds and browser suites sequentially: a production build cleans the parent output directory, and browser suites share an artifact directory. No test uses real credentials or services. Both suites have bounded runs and no automatic retries.

Registry audit currently reports five high advisories in the existing ESLint transitive dependency chain. A breaking downgrade suggested by npm was not applied. See [implementation status](docs/implementation/status.md) for exact results and remaining limitations.

## Implementation documents

- [Requirements and traceability](docs/product/requirements.md)
- [Architecture](docs/architecture/frontend.md)
- [Phase 00 assessment](docs/architecture/repository-assessment.md)
- [Design system](docs/design/design-system.md)
- [Integration contracts](docs/integration/api-contracts.md)
- [Roadmap](docs/implementation/roadmap.md)
- [Status and evidence](docs/implementation/status.md)

### Phase 06: private composer and simulated media safety

In explicit development mock mode, visit `/create` for safe formatted text, audience, AI self-disclosure and local multiple image/video previews. `/drafts` holds owner-only text/declared metadata until server restart; attachment files must be reselected. `/content/[id]` shows the typed lifecycle and `/content/[id]/appeal` prepares an unsent eligible appeal note. `/safety` explains sexual-content, NCII and synthetic-media concerns without evidence intake.

No file bytes leave the browser. Upload progress and moderation decisions are scripted simulations, clearly labelled; public distribution is disabled, including after simulated approval. Successful transfer and overdue review targets never authorize publication. Production ignores mock flags and rejects private creation/status access. Real storage, screening, review, reporting, appeals and distribution authority remain launch blockers. See implementation status for executed checks and limitations. Stop after Phase 06.

Phase 07 adds `/messages` to the authenticated development preview (`COMMON_AUTH_MODE=mock`, development only). Inbox and chat interactions are synthetic and tab-local: reload clears messages, saved/pinned items and settings. Delivery, read receipts, typing, failures, expiration and permission changes can be exercised through explicit preview controls. There is no real-time messaging backend or E2EE. Attachments and voice audio files preview locally without upload; microphone recording and report submission are unavailable. Stop after Phase 07.

Phase 08 adds `/groups` to the same authenticated development preview. Group administration, invitations/requests, conversations and collaboration remain local to the tab. Explicit synthetic participant controls exercise permissions and removal. New/rejoining members see content created since their join; removed members lose the workspace. Announcements require administrators. Shared notes, tasks, reminders and events are local planning items, with no background alerts, calendar sync, real invitation or report delivery. No supported encryption implementation is connected. Stop after Phase 08.

Phase 09 adds `/stories`, `/reels`, `/videos`, `/videos/[id]`, `/stories/create`, `/reels/create`, `/videos/create` and `/live`. Viewers use original bundled SVG artwork and a six-second animation; no published user media or real performance counts are implied. Playbacks start paused, support captions/transcripts and keyboard controls, and stop when hidden/offscreen or access is denied. Creator drafts reuse Phase 06 screening simulation and cannot publish. Live is an unavailable provider interface: no camera, microphone, broadcast, continuous monitoring or report delivery. Stop after Phase 09.

The original playback fixture can be regenerated locally with `node scripts/generate-media-fixture.mjs` (uses the installed Playwright Chromium renderer; no network assets). Bundled captions are at `public/media/captions.vtt`.

### Communities and trust (Phases 10–11)

Explore `/communities`, `/search` and `/pages`; manage `/privacy`, `/reports` and the public `/safety` center. Private community content is withheld pending membership approval and excluded from unauthorized search. `/moderation` requires server-assigned preview reviewer scope. In development mock mode only, set `COMMON_PREVIEW_MODERATOR_IDS` or `COMMON_PREVIEW_ADMIN_IDS` to comma-separated authenticated profile UUIDs; never expose these as client settings. Production authentication and these stores remain unavailable.

All new state is process-local and synthetic. Reports, appeals, deadlines and decisions are simulations, not receipts from an operational moderation service. No sensitive evidence is accepted or exposed, classifiers are unavailable, and decisions cannot approve publication. Security notification preferences are intentions only. Stop after Phase 11.

### Advanced platform (Phase 12)

- `/creator`: manage owned content and confirmed private schedule plans. No automatic publication, analytics data or assessed monetization status.
- `/marketplace`: search/filter synthetic fixtures, inspect privacy-filtered listings/sellers, create private text drafts, withdraw drafts, enter reporting and unsent buyer messaging. No real goods, prices, inventory, transactions or seller verification.
- `/assistant`: consented writing/caption/translation/accessibility/summary request UI with an unavailable AI provider. No fabricated outputs; manual text can be reviewed and saved privately through Phase 06.
- `/wellbeing`: versioned screen-time reminders, zoned quiet hours, automatic story navigation and notification preferences; existing default-feed/public-discovery controls apply. Timers are opt-in and local to the active document, not usage analytics; notification delivery remains unavailable.

All routes require an active onboarded development preview account. Production fails closed, even with a mock flag or forged cookies. No external providers/dependencies were added. Stop after Phase 12.


### Production hardening (Phase 13)

The implemented frontend was reviewed and hardened without adding product modules. See the [final verification report](docs/verification/phase-13-release-verification.md) for exact command results, measurements, failed/unexecuted gates, mock boundaries and missing services. **Production release remains blocked**; passing frontend previews do not verify backend authorization, encryption or mandatory content-safety integrations. Bundle measurements can be regenerated after a production build with `node scripts/analyze-bundle.mjs`. Stop after Phase 13.


### Dummy login for local page access

Run `npm run dev:preview` and open `/login`. This workspace's ignored `.env.local` enables synthetic development authentication and the seeded demo account's moderation preview role. Sign in with username **demo** (or **member@example.test**) and password **Preview-only-42!**. The account is already verified/onboarded, so implemented protected pages open without registration. Restart the development server after changing environment settings. Production authentication remains unavailable; private-content membership/ownership rules still apply.

To reproduce this preview on another machine, create `.env.local` with `COMMON_AUTH_MODE=mock` and, for the moderation preview, `COMMON_PREVIEW_ADMIN_IDS=00000000-0000-4000-8000-000000000007`. These are public development fixture settings, not production credentials.
