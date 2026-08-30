# MediSense AI — Brand Guidelines v1.0

> Last updated: 2026-08-29
> Status: Draft — formalizes the palette/voice already in ad hoc use across the app; this is a codification pass, not a rebrand.

## Quick Reference

| Element | Value |
|---------|-------|
| Primary Color | #3B82F6 |
| Secondary Color | #8B5CF6 |
| Accent Color | #10B981 |
| Primary Font | Plus Jakarta Sans (headings) / Inter (body) |
| Voice | Warm, Clear, Professional, Reassuring |

---

## Brand Concept

**Theme name:** Clinical Calm — a healthcare product that feels like a competent, unhurried clinician: precise language, no false alarm, no false comfort. Blue reads as trustworthy/clinical without the coldness of pure navy-on-white; the severity scale below carries the emotional weight so the rest of the UI can stay calm.

---

## 1. Color Palette

### Primary Colors

| Name | Hex | RGB | HSL | Usage |
|------|-----|-----|-----|-------|
| Primary Blue | #3B82F6 | rgb(59,130,246) | hsl(217,91%,60%) | CTAs, links, active states, brand mark |
| Primary Dark (Ink) | #0F2744 | rgb(15,39,68) | hsl(211,64%,16%) | Headings, nav text — already the de facto heading color across every existing page |

### Secondary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Secondary Purple | #8B5CF6 | rgb(139,92,246) | Secondary accents, admin/analytics charts, differentiating a second data series from primary blue |
| Accent Emerald | #10B981 | rgb(16,185,129) | Positive confirmations, "Low" severity, success states |

### Neutral Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Background | #F8FAFC | rgb(248,250,252) | Page backgrounds |
| Surface | #FFFFFF | rgb(255,255,255) | Cards, modals, panels |
| Border | #E2E8F0 | rgb(226,232,240) | Dividers, card borders |
| Text Secondary | #64748B | rgb(100,116,139) | Body/muted text |
| Text Tertiary | #94A3B8 | rgb(148,163,184) | Captions, placeholders, disabled |

### Clinical Severity Scale (distinct from generic semantic colors — this is MediSense's core visual language)

| Level | Hex | RGB | Usage |
|-------|-----|-----|-------|
| Low | #22C55E | rgb(34,197,94) | Self-care, low-risk assessments |
| Moderate | #F59E0B | rgb(245,158,11) | Monitor / see-doctor-soon guidance |
| High | #EF4444 | rgb(239,68,68) | Urgent-care level findings |
| Critical | #7C3AED | rgb(124,58,237) | Emergency-level findings — deliberately violet, not just a darker red, so it reads as categorically distinct at a glance, not merely "more red" |

This scale is already used identically across SessionChat, SessionDetail, History, and HealthStats — this section formalizes it as the canonical reference; do not introduce a second severity palette anywhere.

### Generic Semantic Colors (non-clinical UI states — form validation, toasts, etc.)

| State | Hex | Usage |
|-------|-----|-------|
| Success | #22C55E | Confirmations, saved states (shares the Low-severity green intentionally — both mean "good") |
| Warning | #F59E0B | Non-clinical cautions (shares Moderate-severity amber intentionally) |
| Error | #EF4444 | Form errors, failed requests (shares High-severity red intentionally) |
| Info | #3B82F6 | Informational toasts/banners (same as primary) |

### Accessibility

- Primary Blue (#3B82F6) on white: 3.7:1 — sufficient for large text/UI components (AA), NOT for small body text at default weight. Use Primary Dark (#0F2744) for small-text links/CTAs on white, reserve #3B82F6 for large text, icons, and filled buttons with white text on top.
- Text Secondary (#64748B) on white: 4.6:1 (AA for normal text).
- All four severity colors must be paired with the existing text label + icon (never color alone) — already true in the current app's badges; the Phase 1 accessibility pass (via the `accessibility` skill) should verify every severity badge migrated to shadcn still carries a text label, not just a colored dot.

---

## 2. Typography

### Font Stack

```css
--font-heading: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
--font-body: 'Inter', system-ui, -apple-system, sans-serif;
```

Already loaded in `frontend/index.html` via Google Fonts — no font change needed, just formalizing what's already there.

### Type Scale

| Element | Size (Desktop) | Size (Mobile) | Weight | Line Height |
|---------|----------------|----------------|--------|-------------|
| H1 | 40px | 28px | 800 | 1.2 |
| H2 | 30px | 24px | 700 | 1.25 |
| H3 | 22px | 20px | 700 | 1.3 |
| Body | 15px | 14px | 400 | 1.6 |
| Small | 13px | 12px | 500 | 1.5 |
| Caption | 11px | 11px | 600 | 1.4 |

---

## 3. Design Components

### Buttons

| Type | Background | Text | Border Radius |
|------|------------|------|----------------|
| Primary | #3B82F6 | #FFFFFF | 8px (20px for pill CTAs, matching existing `.btn-blue`/`lp-btn-solid` patterns) |
| Secondary | Transparent, 1px #E2E8F0 border | #0F2744 | 8px |
| Destructive | #EF4444 | #FFFFFF | 8px |

### Spacing Scale

| Token | Value |
|-------|-------|
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 32px |
| 2xl | 48px |

### Border Radius

| Element | Radius |
|---------|--------|
| Buttons | 8px |
| Cards | 12–16px (existing pages already vary 12–18px; standardize to 14px) |
| Inputs | 8px |
| Modals | 18px |
| Pills/Badges | 9999px |

---

## 4. Voice & Tone

### Brand Personality

| Trait | Description |
|-------|--------------|
| **Warm** | Speaks to a worried person, not a support ticket — never clinical-cold |
| **Clear** | Plain language over medical jargon; short sentences under stress |
| **Reassuring without minimizing** | Never alarmist, never dismissive — this is a hard line already codified in `backend/utils/gemini.js`'s system prompt and must extend to every UI string, not just chat replies |
| **Honest about limits** | Always surfaces "I'm an AI, not a doctor" — in copy, not just disclaimers buried in a footer |

### Voice Chart

| Trait | We Are | We Are Not |
|-------|--------|------------|
| Warm | Personal, human | Cutesy, casual to the point of unserious |
| Clear | Plain-language, short | Vague, hedging on everything |
| Reassuring | Calm, steady | Falsely comforting, minimizing real risk |
| Honest | Transparent about AI limits | Overselling diagnostic authority |

### Tone by Context

| Context | Tone | Example |
|---------|------|---------|
| Onboarding/marketing | Warm, benefit-focused | "Tell us how you feel — we'll ask the right follow-ups." |
| In-session chat | Calm, clinical-warm | "That could suggest a few things — let's narrow it down." |
| Emergency banner | Direct, urgent, no hedging | "Emergency symptoms detected. Seek immediate medical attention." |
| Error messages | Calm, actionable | "Couldn't reach the server — check your connection and try again." |
| Empty states | Encouraging, low-pressure | "No sessions yet — start a Quick Check whenever you're ready." |

### Prohibited Terms

| Avoid | Reason |
|-------|--------|
| "You definitely have X" | Already explicitly banned in the Gemini system prompt — extend the ban to all UI copy |
| "Cure" / "guaranteed" | Overclaims medical authority |
| "Don't worry" | Minimizes — use "Here's what this likely means" instead |
| Revolutionary / seamless / best-in-class | Generic marketing filler, contradicts the "clear, honest" trait |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-08-29 | Initial guidelines — codifies the palette/voice already in use across the app, adds the formal clinical severity scale and accessibility notes ahead of the Phase 1 Tailwind/shadcn migration. |
