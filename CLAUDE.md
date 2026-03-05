# PartyPal — AI Context

## What is PartyPal?

PartyPal is an AI-powered party planning app. Users create events, get AI-generated timelines and checklists, manage guest RSVPs, find vendors, collaborate with co-hosts, and track budgets. It's deployed as a web app on Vercel and wrapped as native iOS/Android apps via Capacitor.

**Domain:** partypal.social
**Production URL:** https://partypal.social

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.5 |
| Language | TypeScript | ^5 |
| UI | React | ^18 |
| Styling | CSS Modules (no Tailwind, no CSS-in-JS) | — |
| Auth | Firebase Auth (client-side) | ^12.9.0 |
| Database | Firestore (Admin SDK, server-side only) | ^13.7.0 |
| AI | Google Generative AI (Gemini 2.5 Flash) | ^0.24.1 |
| Email | Resend | ^6.9.3 |
| Native | Capacitor | ^8.x |
| Hosting | Vercel (Git-based deploys) | — |
| Images | Sharp (server-side) | ^0.34.5 |
| Markdown | marked (docs viewer) | ^17.0.3 |
| IDs | uuid | ^9.0.0 |

## Commands

```bash
npm run dev          # Local dev server (localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint via next lint
npm run cap:sync     # Sync Capacitor native projects
npm run cap:ios      # Open Xcode project
npm run cap:android  # Open Android Studio project
npm run cap:build    # Build + Capacitor sync
```

**No test framework is configured.** There are no Jest, Vitest, or Playwright dependencies.

## Project Structure

```
app/                         # Next.js App Router (pages + API routes)
├── layout.tsx               # Root layout (providers: Auth > Analytics > Nav)
├── page.tsx                 # Homepage
├── globals.css              # Global styles
├── dashboard/               # Main user dashboard
├── guests/                  # Guest management
├── vendors/                 # Vendor marketplace
├── budget/                  # Budget tracking
├── rsvp/                    # RSVP page (RSVPClient.tsx client component)
├── results/                 # Party plan results display
├── join/[code]/             # Dynamic RSVP invite link (layout.tsx + client.tsx)
├── poll/[id]/               # Dynamic poll page
├── login/                   # Login page
├── settings/                # User settings
├── admin/                   # Admin dashboard
├── collaborate/             # Collaboration page
├── contact/                 # Contact / FAQ page
├── docs/                    # Admin documentation viewer (uses marked)
├── privacy/                 # Privacy policy page
├── api/                     # API routes (serverless functions)
│   ├── events/              # Event CRUD + RSVP + shared events
│   ├── vendors/             # Vendor search (Google Places)
│   ├── guests/              # Guest management
│   ├── plan/                # AI party planning (Gemini)
│   ├── collaborate/         # Invite + accept collaboration
│   ├── email/               # Email sending
│   ├── polls/               # Poll management
│   ├── auth/                # Apple auth webhook
│   ├── admin/               # Admin endpoints (cleanup, migrate-events, usage, users)
│   ├── account/delete/      # Account deletion
│   ├── analytics/           # Analytics tracking
│   ├── bugs/                # Bug report submission
│   ├── docs/                # Documentation API (serves docs from Firestore)
│   ├── geolocation/         # Geolocation service
│   ├── join/[code]/         # RSVP join endpoint
│   ├── location/            # Location search/details
│   ├── moodboard/           # Moodboard generation (Gemini AI)
│   ├── notify/              # Notification service
│   ├── og/                  # Open Graph image generation
│   ├── seed-accounts/       # Development seed data
│   └── user-data/           # User data export/sync
components/                  # Shared React components
├── AuthContext.tsx           # Firebase auth context + useAuth hook
├── AnalyticsProvider.tsx     # Analytics wrapper
├── Nav.tsx                  # Navigation bar
├── Toast.tsx                # Toast notification system
├── NativeInit.tsx           # Capacitor native initialization
├── BugReportButton.tsx      # Floating bug report FAB
├── GuestManager.tsx         # Guest list management
├── LocationSearch.tsx       # Google Places autocomplete
├── CreatePoll.tsx           # Poll creation
└── AdUnit.tsx               # Google AdSense
lib/                         # Shared utilities
├── firebase.ts              # Firebase Admin SDK init (server-side)
├── firebase-client.ts       # Firebase client SDK init (browser-side)
├── admin-auth.ts            # Admin authentication helpers
├── ai-context.ts            # AI context management (client)
├── ai-context-server.ts     # AI context management (server)
├── ai-memory.ts             # AI conversation memory
├── useAIContext.ts           # React hook for AI context
├── analytics.ts             # Analytics utilities
├── constants.ts             # Email aliases (SITE_EMAILS)
├── email.ts                 # Email sending logic (Resend)
├── email-templates.ts       # HTML email templates
├── rate-limiter.ts          # Firestore-backed rate limiting
├── userStorage.ts           # User data persistence
└── capacitor-init.ts        # Capacitor initialization
public/                      # Static assets (favicon, logo, manifest.json)
ios/                         # Capacitor iOS project
android/                     # Capacitor Android project
```

## Architecture Patterns

### Firebase / Firestore

- **Named database:** Firestore uses database ID `'partypal'`, NOT the default database.
- **Server-side only:** All Firestore operations go through API routes using Firebase Admin SDK. The client SDK is only used for Auth.
- **Lazy singleton init:** `getDb()` in `lib/firebase.ts` initializes on first call with `getApps().length === 0` guard.
- **Dual init path:** Uses `FIREBASE_SERVICE_ACCOUNT` env var (JSON) in production, falls back to `projectId` for local dev.
- **Upsert pattern:** Writes use `set({ merge: true })`, not `update()`.

```typescript
// Standard Firestore access pattern
import { getDb } from '@/lib/firebase'
const db = getDb()
await db.collection('events').doc(eventId).set(data, { merge: true })
```

### Authentication

- **Client-side only:** Firebase Auth runs in the browser via `AuthContext.tsx`.
- **Three auth methods:** Google, Apple (OAuth), and Email/Password.
- **No server-side token verification:** API routes receive `uid` as a parameter and trust it. There is no middleware or token validation.
- **Dual platform strategy:** Uses `signInWithPopup` on web, `signInWithRedirect` on Capacitor native apps.
- **Consumer hook:** `const { user, loading } = useAuth()`.
- **Native detection:** `window.Capacitor?.isNativePlatform()`.

### API Routes

Standard pattern for all API route handlers:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url)
        const uid = url.searchParams.get('uid')
        if (!uid) {
            return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
        }
        const db = getDb()
        // ... Firestore operations ...
        return NextResponse.json({ success: true, data })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Context:', msg)
        return NextResponse.json({ error: 'Description', details: msg }, { status: 500 })
    }
}
```

**Conventions:**
- GET/DELETE read params from `URL.searchParams`
- POST reads body from `req.json()`
- Success: `{ success: true, ... }`
- Error: `{ error: string, details: string }` with appropriate HTTP status
- Error typing: `error: unknown` with `instanceof Error` extraction
- All handlers wrapped in top-level `try/catch`

### Styling

- **CSS Modules only** — every page/component has a `.module.css` file alongside it.
- No Tailwind, no styled-components, no CSS-in-JS.
- Import pattern: `import styles from './page.module.css'`
- Class usage: `className={styles.container}`

### State Management

- **React Context** for auth state (`AuthContext`).
- **localStorage** for event data, guest lists, AI memory, settings, shortlists, checklists.
- **Firestore cloud sync** for persistence across devices (30-second polling + merge logic).
- No Redux, Zustand, or other state management libraries.

### Rate Limiting

- Firestore-backed, persists across serverless invocations.
- Dynamic per-user daily limits that scale down as user count grows.
- **Fails open:** If Firestore is unavailable, all requests are allowed.
- Below 25 users: tracking only, never blocks.
- Located in `lib/rate-limiter.ts`.

### AI Integration

- Uses Google Generative AI SDK (Gemini 2.5 Flash).
- API key env var: `GEMINI_API_KEY` (not `GOOGLE_MAPS_API_KEY`).
- AI context built from event data; personal names are sanitized out.
- Conversation memory stored in localStorage.

### Email

- Sent via Resend SDK.
- Templates in `lib/email-templates.ts` (HTML strings).
- Business aliases defined in `lib/constants.ts` as `SITE_EMAILS`.

### Provider Nesting Order (layout.tsx)

```
<html> → <body> → AuthProvider → AnalyticsProvider → [NativeInit, Nav, ToastContainer, {children}, BugReportButton]
```

## Environment Variables

Required env vars (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `GOOGLE_MAPS_API_KEY` | Google Maps, Places, and Gemini AI |
| `GEMINI_API_KEY` | Google Generative AI (Gemini) |
| `NEXT_PUBLIC_APP_URL` | App base URL (localhost:3000 in dev) |
| `NEXT_PUBLIC_DOMAIN` | Domain name (partypal.social) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Admin SDK credentials (JSON string) |
| `FIREBASE_PROJECT_ID` | Firebase project ID (fallback for Admin SDK) |
| `RESEND_API_KEY` | Resend email API key |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | Google AdSense client ID (optional) |

## Deployment

- **Hosting:** Vercel with Git-based auto-deploys.
- **Production:** `main` branch → partypal.social
- **Staging:** `staging` branch → auto-generated Vercel preview URL
- **Preview:** Any PR or branch push gets a unique preview deployment URL.
- **Config:** `vercel.json` in repo root.
- **Native apps:** Capacitor wraps the live web app in a WebView (points to partypal.social).

## Development Conventions

### Commit Message Style

Commits follow a loose conventional format observed across 270+ commits:
- `feat:` for new features
- `fix:` for bug fixes
- `chore:` for maintenance tasks
- Plain descriptive text for UI changes, fixes, and updates
- Messages describe the "what" concisely

### Common Patterns Across the Codebase

1. **Client components** use `'use client'` directive at the top of the file.
2. **Server components** are the default (no directive needed).
3. **Dynamic routes** use `[param]` folder naming (e.g., `join/[code]/`, `poll/[id]/`).
4. **Metadata** is exported separately from `viewport` (Next.js 14 pattern).
5. **Join codes** use unambiguous characters: `abcdefghjkmnpqrstuvwxyz23456789`.
6. **Nested Firestore fields** are updated via dot notation: `data['inviteVersions.${id}'] = { ... }`.
7. **Fire-and-forget API calls** use `.catch(() => {})` for non-critical operations (e.g., analytics, profile sync).

### Known Architecture Decisions

- **No auth middleware:** API routes trust client-provided `uid`. This is a deliberate simplification, not an oversight.
- **No client-side Firestore:** All DB operations go through API routes. The client Firebase SDK is only for Auth.
- **localStorage as primary store:** Event data lives in localStorage first, synced to Firestore for cross-device persistence.
- **No test suite:** There are no automated tests. Manual testing via preview deployments.
