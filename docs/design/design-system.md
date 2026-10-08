# Design system and responsive behavior

**Document state:** Phase 02 design system and shell implemented; profile and feed component families reuse the established primitives; remaining families are planned.
**Prepared:** 2026-10-08.

## Product direction
Prioritize a readable central feed, predictable messaging, explicit audience controls and calm safety feedback. Use a distinctive brand rather than copying another platform's assets. Design tokens below are starter values to verify in actual rendered components.

## Foundation tokens
| Token family | Proposed values | Usage |
|---|---|---|
| Background light/dark | #F8FAFC / #0F172A | App canvas |
| Surface light/dark | #FFFFFF / #1E293B | Cards, panels, dialogs |
| Text light/dark | #0F172A / #F8FAFC | Primary text |
| Muted text light/dark | #475569 / #CBD5E1 | Secondary text |
| Primary light/dark | #1D4ED8 / #93C5FD | Links/actions; pair dark-mode fills with #0F172A text |
| Danger light/dark | #B91C1C / #FCA5A5 | Error/destructive foreground |
| Border light/dark | #CBD5E1 / #475569 | Decorative separators; input/focus boundaries need independent contrast check |
| Focus light/dark | #1D4ED8 / #93C5FD | 2px visible outline with offset |
| Spacing | 4, 8, 12, 16, 24, 32, 48px | Named scale; avoid arbitrary per-page values |
| Radius | 6, 12, 16px; full for avatars | Controls, cards, sheets |
| Typography | system sans; 14/20, 16/24, 20/28, 28/36px | Metadata, body, section, page |
| Motion | 120–200ms standard; reduced-motion disables nonessential transitions | Feedback, sheets |
| Layers | base 0, sticky 10, overlay 40, dialog 50, toast 60 | Centralized stacking |

Implement semantic CSS variables for background, surface, text, muted, border, primary, danger, warning and success across themes. Never encode state through color alone. Contrast is a verification requirement, not a claim already measured: target WCAG 2.2 AA, including 4.5:1 normal text and 3:1 large text/non-text controls where applicable.

## Responsive composition
| Width | Proposed layout | Behavior |
|---|---|---|
| 320–767px | Single primary column, compact header/bottom nav | Full-width feed; inbox and thread separate views; safe-area padding; keyboard-aware composer |
| 768–1199px | Primary content with collapsible navigation | Hide secondary panel first; preserve content width and touch targets |
| 1200px+ | Navigation + central feed + optional context panel | Feed about 680px max; side panels must not crowd reading |

Breakpoints depend on content fit, not device names. Support 200% text zoom, 400% page zoom/reflow checks and RTL. Aim for 44px interaction targets; meet applicable minimum target requirements. Do not rely on hover or swipe for essential actions.

## Component contracts
| Family | Required behavior |
|---|---|
| Buttons/icon buttons | Named purpose, disabled reason when needed, pending feedback, duplicate-action prevention |
| Inputs/forms | Persistent labels, hints, field and summary errors linked to inputs; retain values after failure |
| Dialogs/sheets/menus | Appropriate semantics, keyboard navigation, focus trap where modal, Escape, return focus |
| Feed/PostCard | Author/time/audience, expandable text, reactions, comments, save/report; stable layout and media ratio |
| Composer/upload | Audience visible before submit, draft recovery, alt text/captions, cancellation and explicit transfer/screening states |
| Messages | Accessible sender/time/status, grouped bubbles without losing names, retry, attachment limits, privacy labels |
| Safety | Plain-language decision/status, uncertainty where applicable, eligible appeals, minimal sensitive evidence |
| Notifications | Read/unread semantic state, category control, grouped updates without repetitive announcements |
| Media/story/reel | Pause, volume, captions, accessible controls; no forced autoplay sound or gesture-only navigation |
| Admin review | Scope warning, case permissions, explicit decision confirmation, audit reference; restricted specialist material excluded |

## State and accessibility rules
Provide skeletons only when useful, with reserved dimensions and no misleading content. Empty states explain the next action. Offline/stale states display freshness and available operations. Use concise live-region announcements for completed sends/uploads; do not announce entire feeds on every update. Pagination or a load-more alternative preserves focus and return position when infinite scroll is used.

Sensitive-content overlays do not expose rejected media in the DOM or downloadable URLs. Pending screening is clearly distinct from published. Synthetic-content labels explain uncertainty; missing provenance is not proof of manipulation. Teen restrictions cannot be turned off through cosmetic switches.

Use locale-aware dates, pluralization and text direction. Avoid fixed-height text containers. Respect autoplay, reduced motion, notification boundaries and session reminders; do not trap users in engagement flows.

## Design verification checklist
Check representative feed, composer, chat, settings and report dialogs at 320, 768 and 1440px, light/dark and RTL, keyboard-only and zoomed. Inspect names, headings, focus order, contrast and touch targets; run automated accessibility checks plus manual checks. Save actual results in status when UI exists. Component library/Storybook is optional and should be introduced only when scale warrants it.

## Phase 02 implementation evidence

The Common identity uses the palette above, semantic control-border/on-primary/on-danger colors, system sans/mono stacks, named typography/spacing/radius/elevation/layer/motion tokens in `app/globals.css`. System fonts deliberately remove build-time font-network dependence. `components/ui` supplies typed buttons, icon buttons, native labeled inputs/textareas/selects, Radix switches/tabs/dropdowns/dialogs/sheets/toasts, alerts, skeletons, empty/error states, avatars, cards, badges and native progress. Radix handles focus trapping, Escape, focus restoration and keyboard patterns; native controls retain platform behavior.

`components/shell` supplies desktop topbar/sidebar/main/optional context, tablet navigation sheet and mobile bottom navigation with safe areas. Appearance has light/dark/system choices, pre-hydration initialization, guarded local preference storage and cross-tab synchronization. Only a non-sensitive theme choice is persisted. `/design-system` demonstrates local validation, retries, pending/empty/error/loading and feedback; nothing is sent to backend services.

Nine component tests and 21 Chromium tests passed, including 320/768/1440px, 200% text scaling on both routes, theme persistence and unavailable storage, reduced motion, menu/tab keys, modal focus, linked form errors, not-found navigation and axe WCAG-tagged light/dark/modal scans. Desktop/tablet/mobile and dark library screenshots were visually inspected. This is scoped evidence, not a full WCAG certification; manual assistive-technology and Firefox/WebKit checks remain open.

## Phase 04 component reuse

Profiles/connections reuse Cards, Avatars, native labeled form fields/Selects, Radix Tabs/Dialogs, Buttons, Badges, Alerts, skeletons and existing theme/focus/motion tokens. Responsive profile headers, detail/timeline columns and media grids collapse at content breakpoints. The mobile bottom navigation now exposes Profile, Connections and Account; the compact menu/desktop sidebar retain Overview and Component library. Private audiences have explicit copy; friendship and following are separate controls. Local SVG illustrations provide benign preview artwork without remote requests. Destructive unfriend/block dialogs explain consequences and restore focus. Page-scoped feedback preserves announcements when a request row disappears.

## Phase 05 feed composition

Feed cards use existing surface/border/radius/elevation tokens, author avatar/link, explicit date/audience, readable text, publication-safe artwork, permission reason and engagement actions. Media reserves a 2:1 frame and uses the existing lazy-loaded local artwork component. Text-only cards are supported. Controls wrap at narrow widths and 200% text scale; pressed reaction/save/repost states are exposed through aria-pressed. Repost denial explains the public-only rule. Feed modes are semantic navigation links with aria-current, not simulated tabs.

The responsive shell now links Home/Saved/Profile in mobile navigation; all existing routes remain reachable through desktop/sidebar/mobile menus. Preference/share/report and comment edit/reply/delete dialogs reuse focus trapping, Escape and return-focus behavior. Loading skeletons reserve media space; empty views provide relevant recovery links. Error feedback survives removed cards; drafts are retained for explicit retry. Only reactions use provisional counts while confirmation is pending; reduced motion follows the existing global preference.

## Phase 06 composer and safety status

The composer reuses existing fields, cards, dialogs, alerts, badges and progress primitives. Text formatting exposes keyboard-operable bold/italic/list actions over a labelled textarea. A private preview renders safe text; local image/video previews reserve their aspect ratio, avoid autoplay and require image descriptions. Local preview loading and decode errors provide explicit, recoverable feedback. Audience and self-declared AI information remain distinct from verified authenticity.

Status surfaces show simulation mode, intended audience, named lifecycle state, progress, explanations and bounded retry/cancel actions. Public distribution remains disabled with an associated explanation. Review targets explicitly state that overdue content stays held. Restricted/rejected status views do not display media. Appeal and victim-support entry points clearly disclose unavailable submission, no case receipt and no evidence collection. Responsive action rows wrap; options and attachment grids collapse to a single mobile column within the established safe-area shell. Browser checks cover keyboard dialog return focus, light/dark axe scans, reduced motion and 320/768/1440px with 200% text reflow.

## Phase 12 advanced interfaces

Creator and marketplace cards reuse existing surfaces, adaptive grids, form primitives and semantic navigation. Unavailable analytics, monetization, AI and delivery states are named rather than illustrated with fictional numbers or outputs. Repository artwork is explicitly synthetic, reserves layout space and has accessible descriptions. Confirmation dialogs show the actual prepared text/time, support Escape/back-to-edit, and restore focus to the invoking form control. Pending forms disable repeat actions while preserving text; manual retries keep an unconfirmed request identity. Well-being offers dismissible local reminders without preventing navigation or exit. Screens support narrow viewports and wrap actions; axe and keyboard/reflow checks cover high-value journeys.
