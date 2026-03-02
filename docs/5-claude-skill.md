# Claude Skill — AI-Powered Event Planning App Builder

> A reusable skill for building AI-powered planning applications using Next.js, Firebase, Gemini, and Capacitor.

---
name: AI Event Planning App
description: Reusable skill for building AI-powered event/project planning apps with Next.js, Firebase, Google Gemini, and Capacitor mobile wrappers.
---

## 1. When to Use This Skill

Use this skill when building any **AI-powered planning or management application** that includes:
- AI-generated plans, recommendations, or content
- Real-world data integration (maps, vendors, businesses)
- User management with social auth
- Guest/collaborator workflows
- Email notification pipelines
- Cross-platform (web + mobile) deployment

**Example applications:** Wedding planner, Trip planner, Event organizer, Project manager, Meal planner, Home renovation planner.

---

## 2. Tech Stack Blueprint

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js 14+ (App Router) | Full-stack React with API routes |
| Language | TypeScript | Type safety everywhere |
| AI Engine | Google Gemini 2.5 Flash | Fast, cheap, reliable JSON output |
| Auth | Firebase Auth | Google/Apple/Email + anonymous |
| Database | Firestore | Real-time, schemaless, generous free tier |
| Email | Resend | Transactional emails with templates |
| Maps/Places | Google Maps Places API (New) | Real business data |
| Mobile | Capacitor 8 | Wrap web app in native shell |
| Hosting | Vercel | Free tier, git-push deploys |
| Styling | CSS Modules + Global CSS | No runtime cost, scoped styles |

---

## 3. Project Setup

### Step 1: Scaffold
```bash
npx -y create-next-app@latest ./ --typescript --app --no-tailwind --no-eslint
npm install firebase @google/generative-ai resend uuid
npm install -D @types/uuid
```

### Step 2: Environment Variables
```bash
# .env.local
GEMINI_API_KEY=your_gemini_key
GOOGLE_MAPS_API_KEY=your_maps_key
RESEND_API_KEY=your_resend_key
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=yourapp.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DOMAIN=yourdomain.com
```

### Step 3: Firebase Setup
1. Create Firebase project at console.firebase.google.com
2. Enable Authentication (Google, Apple, Email/Password, Anonymous)
3. Enable Firestore with default rules
4. Download service account key for Admin SDK

### Step 4: Capacitor Setup (Optional — for mobile)
```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init AppName social.appname.app --web-dir=out
npx cap add ios
npx cap add android
```

---

## 4. Architecture Patterns

### Pattern 1: AI API Route Template

Every AI endpoint should follow this structure:

```typescript
// app/api/[feature]/route.ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, logApiCall } from '@/lib/rate-limiter'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limit
    const identifier = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anon'
    const check = await checkRateLimit(identifier, 'feature-name')
    if (!check.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 })

    // 2. Validate input
    const body = await req.json()
    if (!body.requiredField) return NextResponse.json({ error: 'Missing field' }, { status: 400 })

    // 3. Build context-aware prompt
    const prompt = `You are [AppName], an expert [role].
[Inject cross-portal context if available]
[Task-specific instructions]
Return ONLY valid JSON, no markdown, no backticks:
{ "field1": "value", "field2": [] }`

    // 4. Call Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const data = JSON.parse(cleaned)

    // 5. Log usage
    logApiCall('feature-name', 'gemini', identifier)

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

### Pattern 2: Cross-Portal Context System

Build a context engine that gives AI awareness across all features:

```typescript
// lib/ai-context.ts
interface CrossPortalContext {
  event: EventContext        // Event details
  guests: GuestContext       // Guest data
  vendors: VendorContext     // Vendor selections
  plan: PlanContext          // Plan progress
  preferences: UserPrefs     // Learned preferences
  signals: string[]          // Smart observations
}

function buildContextPrompt(ctx: Partial<CrossPortalContext>, surface: string): string {
  let prompt = `=== CROSS-PORTAL INTELLIGENCE (${surface}) ===\n`
  if (ctx.event) prompt += `Event: ${ctx.event.eventType}, ${ctx.event.guests} guests\n`
  if (ctx.guests) prompt += `Guests: ${ctx.guests.confirmed} confirmed, dietary: ${ctx.guests.dietarySummary}\n`
  // ... more context sections
  if (ctx.signals?.length) prompt += `\nSmart Signals:\n${ctx.signals.map(s => `• ${s}`).join('\n')}`
  return prompt
}
```

### Pattern 3: AI Memory / Preference Learning

```typescript
// lib/ai-memory.ts
type InteractionSignal =
  | { type: 'plan_generated'; eventType: string }
  | { type: 'plan_refined'; refinementText: string }
  | { type: 'item_shortlisted'; category: string }

function recordInteraction(signal: InteractionSignal): UserPreferences {
  const prefs = loadPreferences() // from localStorage
  prefs.interactionCount++
  
  switch (signal.type) {
    case 'plan_refined':
      // Detect tone from refinement language
      if (signal.refinementText.includes('formal')) prefs.tone = 'formal'
      break
    // ... more signal handlers
  }
  
  savePreferences(prefs) // localStorage + Firestore sync
  return prefs
}
```

### Pattern 4: Dynamic Rate Limiter

```typescript
// lib/rate-limiter.ts
const TIERS = [
  { maxUsers: 25,  limitPerUser: 100 },
  { maxUsers: 100, limitPerUser: 40 },
  { maxUsers: 250, limitPerUser: 20 },
  { maxUsers: 500, limitPerUser: 12 },
]

async function checkRateLimit(id: string, endpoint: string) {
  const userCount = await getRegisteredUserCount()
  const tier = TIERS.find(t => userCount <= t.maxUsers) || TIERS[TIERS.length - 1]
  const usage = await getDailyUsage(id)
  return { allowed: usage < tier.limitPerUser, remaining: tier.limitPerUser - usage }
}
```

### Pattern 5: Email Template System

```typescript
// lib/email-templates.ts
const COLORS = { primary: '#4AADA8', accent: '#F7C948', danger: '#E8896A' }

function baseLayout(content: string): string {
  return `<div style="max-width:600px;margin:0 auto;font-family:sans-serif">${content}</div>`
}

function invitationEmail(params: InviteParams): string {
  return baseLayout(
    headerBlock('🎉', params.eventName) +
    bodyWrap(`<p>You're invited to ${params.eventName}!</p>`) +
    ctaButton('RSVP Now', params.rsvpLink)
  )
}
```

### Pattern 6: localStorage-First + Cloud Sync

```typescript
// lib/userStorage.ts
let uid: string | null = null

export function setStorageUid(newUid: string | null) { uid = newUid }

export function userSetJSON(key: string, val: unknown) {
  const prefixedKey = uid ? `${uid}_${key}` : key
  localStorage.setItem(prefixedKey, JSON.stringify(val))
  // Fire-and-forget cloud sync
  if (uid) {
    fetch('/api/user-data', {
      method: 'POST',
      body: JSON.stringify({ uid, [key]: val })
    }).catch(() => {})
  }
}
```

---

## 5. Design System

### Color Palette
```css
:root {
  --bg-dark: #0a0a1a;
  --bg-card: #131829;
  --primary: #4AADA8;    /* Teal */
  --secondary: #3D8C6E;  /* Green */
  --accent: #F7C948;      /* Gold */
  --coral: #E8896A;       /* Coral */
  --purple: #7B5EA7;      /* Purple */
  --navy: #2D4059;        /* Navy */
  --text: rgba(255,255,255,0.85);
  --text-muted: rgba(255,255,255,0.5);
}
```

### Typography
```css
@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap');
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
h1, h2, .brand { font-family: 'Fredoka One', cursive; }
```

### Component Patterns
- Glass cards: `background: rgba(255,255,255,0.04); backdrop-filter: blur(20px);`
- Gradients: `background: linear-gradient(135deg, var(--primary), var(--secondary));`
- Borders: `border: 1px solid rgba(255,255,255,0.08);`
- Shadows: `box-shadow: 0 4px 24px rgba(0,0,0,0.3);`

---

## 6. Deployment Checklist

- [ ] Set all env variables in Vercel dashboard
- [ ] Enable Firebase Auth providers (Google, Apple, Email)
- [ ] Configure Firestore security rules
- [ ] Set up custom domain DNS (CNAME to Vercel)
- [ ] Test all AI endpoints with rate limiting
- [ ] Verify email delivery (check spam folder)
- [ ] Test mobile app (Capacitor build)
- [ ] Verify SEO (title, meta description, OG tags)
- [ ] Enable error tracking (analytics error handler)
- [ ] Test account deletion cascade

---

## 7. Cost Projections

### Free Tier Sweet Spot (0–100 users)

| Service | Monthly Cost |
|---|---|
| Vercel Hosting | $0 (Hobby) |
| Firebase Auth | $0 (free tier: 10K auths/mo) |
| Firestore | $0 (free tier: 50K reads/day) |
| Gemini API | $5–20 (Paid Tier 1) |
| Google Maps | $0–15 (free $200/mo credit) |
| Resend | $0 (100 emails/day) |
| Domain | ~$1/mo |
| **Total** | **~$6–36/mo** |

### Scaling (100–1000 users)
- Firebase: ~$25/mo (Blaze plan overage)
- Gemini: ~$50–100/mo (upgrade to Tier 2)
- Resend: ~$20/mo (Pro plan)
- **Total: ~$100–160/mo**
