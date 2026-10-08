# Design system and responsive behavior

**Document state:** Starter specification; no application, backend, dependencies, tests, or deployment exist in this package.
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
