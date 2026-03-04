# PartyPal — Implementation Plan

> Retrospective documentation of how PartyPal was built from concept to production.

---

## 1. Project Genesis

### Problem Statement
Party planning is fragmented — hosts juggle spreadsheets, Pinterest boards, text threads, vendor websites, and manual guest tracking. No single tool connects AI-powered planning with real vendor data, guest management, and collaboration.

### Solution
A vertically-integrated AI planning platform that generates complete party plans, discovers real local vendors, manages guests/RSVPs, and enables collaboration — all in one cohesive experience.

### Success Criteria
- ✅ AI generates complete, actionable party plans in <5 seconds
- ✅ Real vendor data from Google Places (not fabricated)
- ✅ Full guest lifecycle: add → invite → RSVP → notify
- ✅ Cross-platform: Web + iOS + Android
- ✅ Live at custom domain: partypal.social

---

## 2. Technology Selection

| Layer | Choice | Rationale |
|---|---|---|
| **Framework** | Next.js 14 (App Router) | SSR, API routes, file-based routing, React Server Components |
| **Language** | TypeScript | Type safety across full stack |
| **AI** | Google Gemini 2.5 Flash | Fast, cost-effective, excellent JSON structured output |
| **Auth** | Firebase Auth | Google/Apple/Email/Anonymous — free tier, Capacitor-compatible |
| **Database** | Firestore | Real-time sync, schemaless, generous free tier |
| **Email** | Resend | Developer-friendly, React email support, free tier |
| **Maps** | Google Maps Places API (New) | Real business data, photos, ratings, opening hours |
| **Mobile** | Capacitor 8 | Wrap web app in native shell, access native APIs |
| **Hosting** | Vercel (Hobby) | Free, git-push deploys, serverless API routes |
| **Domain** | Namecheap | $12/yr for `.social` TLD |

---

## 3. Build Phases

### Phase 1: Foundation
1. Scaffold Next.js 14 project with TypeScript
2. Design global CSS with dark theme, custom color palette, responsive grid
3. Build landing page with hero section, category grid, feature cards
4. Implement AI planning wizard (6-field form → API → results page)
5. Create `/api/plan` route with Gemini integration

### Phase 2: Core Features
1. Build results page with tabbed view (Plan, Budget, Moodboard)
2. Create vendor marketplace with category filtering
3. Integrate Google Places API for real vendor search
4. Build guest management component (add, bulk import, dietary tracking)
5. Implement AI invite generation with Gemini
6. Create RSVP system with shareable links and public response page

### Phase 3: Dashboard & Events
1. Build interactive dashboard with 5-tab layout (Plan, Theme, Vendors, Guests, Polls)
2. Implement multi-event support with Firestore persistence
3. Add timeline milestone tracking with computed dates
4. Build smart checklist with category grouping and completion tracking
5. Create budget tracker with visual progress bars
6. Add demo mode for first-time user experience

### Phase 4: Social & Collaboration
1. Build polls system (preset + custom) with Firestore voting
2. Create shareable poll pages with real-time results
3. Implement collaboration invites via email
4. Build collaboration accept flow
5. Add task assignment to collaborators
6. Implement WhatsApp sharing for invites/polls

### Phase 5: Intelligence Layer
1. Build Cross-Portal AI Context system (event, guest, vendor, plan, moodboard, preferences)
2. Implement AI Memory with user preference learning and interaction signals
3. Add server-side context assembly for API routes
4. Create dynamic rate limiter with tiered user scaling
5. Build analytics tracker with batched event flushing

### Phase 6: Infrastructure
1. Set up Firebase project (Auth, Firestore, Admin SDK)
2. Build 9 professional HTML email templates
3. Implement Resend email integration
4. Create admin dashboard with 14-section executive analytics:
   - Executive KPIs, API usage trends with cost tracking
   - User drill-down with per-user metrics, activity heatmaps, and recent events
   - Traffic & growth charts, conversion funnel with target benchmarks
   - Event insights with type distribution donut chart
   - Error tracking and bug report management (New → Reviewed → Fixed workflow)
   - Health & alerts engine with dynamic alert generation
   - Growth accounting (net growth, retention, activation rates)
   - User lifecycle & churn analysis with deletion reasons and timeline
   - AI usage monitoring with rate limit tiers and top consumers
   - Per-endpoint API metrics with cost estimates
   - Poll analytics with categories, engagement distribution, leaderboard
   - Live activity feed
5. Build `/api/bugs` endpoint for user bug report management
6. Add privacy policy, settings page, contact form
7. Implement account deletion with cascade cleanup

### Phase 7: Mobile & Distribution
1. Set up Capacitor for iOS and Android
2. Configure splash screens, status bar, and push notifications
3. Create app store screenshots and listing content
4. Build native init with keyboard handling and haptics
5. Configure hybrid web-view pointing to `partypal.social`

### Phase 8: Production & Polish
1. Deploy to Vercel, connect `partypal.social` domain
2. Set up environment variables for production
3. Add rate limiting to all AI endpoints
4. Implement in-memory vendor caching (5-min TTL)
5. Add error tracking and unhandled rejection monitoring
6. Push to GitHub, enable CI/CD

---

## 4. Architecture Decisions

### Why Gemini 2.5 Flash (not Anthropic Claude)
- **Cost:** ~10x cheaper per token than Claude Sonnet
- **Speed:** Sub-3-second plan generation
- **JSON output:** Reliably returns structured JSON without markdown wrapping
- **Paid Tier 1 limits:** 1,500 RPD, 300 RPM, 1M TPM — sufficient for early-stage

### Why Firebase (not Supabase/Postgres)
- **Zero-config auth** with Google, Apple, and anonymous support
- **Capacitor-compatible** with client SDK
- **Generous free tier** (50K reads/day, 20K writes/day)
- **Real-time listeners** for polls and collaboration

### Why Capacitor (not React Native)
- **Shared codebase:** Same Next.js app runs everywhere
- **Instant updates:** New features deploy via web without app store review
- **Hybrid approach:** Points to live `partypal.social` URL
- **Lower maintenance:** No separate mobile codebase

### Why Resend (not SendGrid/Mailgun)
- **Developer-first API** with minimal setup
- **Free tier** sufficient for early stage (100 emails/day)
- **Clean HTML rendering** across email clients
- **TypeScript SDK** with excellent DX

---

## 5. File Structure

```
partypal/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Landing page (518 lines)
│   ├── dashboard/page.tsx        # Dashboard (2,691 lines — largest file)
│   ├── vendors/page.tsx          # Vendor marketplace (681 lines)
│   ├── results/page.tsx          # AI plan results (261 lines)
│   ├── guests/page.tsx           # Standalone guest page
│   ├── rsvp/page.tsx             # Public RSVP (355 lines)
│   ├── collaborate/page.tsx      # Collaboration accept (155 lines)
│   ├── admin/page.tsx            # Admin dashboard (1,881 lines)
│   ├── settings/page.tsx         # User settings
│   ├── login/page.tsx            # Auth page
│   ├── contact/page.tsx          # Contact form
│   ├── privacy/page.tsx          # Privacy policy
│   ├── budget/page.tsx           # Budget management
│   └── api/                      # 23 API routes
│       ├── plan/route.ts         # Gemini: party plan generation
│       ├── vendors/route.ts      # Google Places: vendor search
│       ├── moodboard/route.ts    # Gemini: moodboard generation
│       ├── guests/route.ts       # Gemini: invite generation
│       ├── polls/route.ts        # Firestore: poll CRUD + voting
│       ├── events/               # Firestore: event CRUD
│       ├── collaborate/          # Collaboration invite/accept
│       ├── email/route.ts        # Resend: send emails
│       ├── notify/route.ts       # Bulk guest notifications
│       ├── bugs/route.ts        # Bug reports: list + status management
│       ├── analytics/route.ts   # Analytics event ingestion + admin dashboard data
│       ├── location/route.ts     # Google Places Autocomplete
│       ├── geolocation/route.ts  # Reverse geocoding
│       ├── user-data/route.ts    # User profile & AI memory
│       ├── account/delete/       # Account deletion
│       └── admin/                # Admin-only endpoints
├── components/                   # Shared React components
│   ├── GuestManager.tsx          # Guest management (817 lines)
│   ├── CreatePoll.tsx            # Poll creation (391 lines)
│   ├── LocationSearch.tsx        # Location autocomplete (376 lines)
│   ├── AuthContext.tsx           # Auth provider (108 lines)
│   ├── Nav.tsx                   # Navigation (171 lines)
│   ├── AnalyticsProvider.tsx     # Analytics init
│   ├── NativeInit.tsx            # Capacitor init
│   └── Toast.tsx                 # Toast notifications
├── lib/                          # Shared utilities
│   ├── ai-context.ts             # Cross-portal context system (223 lines)
│   ├── ai-context-server.ts      # Server-side context assembly
│   ├── ai-memory.ts              # AI preference learning (175 lines)
│   ├── useAIContext.ts           # React hook for context
│   ├── analytics.ts              # Client-side analytics (201 lines)
│   ├── rate-limiter.ts           # Dynamic rate limiter (321 lines)
│   ├── email-templates.ts        # 9 HTML email templates (567 lines)
│   ├── email.ts                  # Resend integration
│   ├── firebase.ts               # Firebase Admin SDK
│   ├── firebase-client.ts        # Firebase Client SDK
│   ├── admin-auth.ts             # Admin whitelist
│   ├── capacitor-init.ts         # Native bridge init
│   └── userStorage.ts            # localStorage abstraction
├── capacitor.config.ts           # Mobile app config
├── ios/                          # iOS native project
├── android/                      # Android native project
└── public/                       # Static assets
```
