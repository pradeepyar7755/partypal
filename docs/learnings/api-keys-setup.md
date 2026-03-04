# Setting Up APIs and Keys

## Overview

Managing API keys, service credentials, and environment variables across development, preview, and production environments in a Next.js + Vercel app.

## Environment Variable Architecture

### `.env.example` — Documentation, Not Secrets

Keep a committed `.env.example` with placeholder values documenting every required variable:

```bash
# .env.example — Copy to .env.local and fill in real values
# NEVER commit .env.local to GitHub

# Google API Key (Maps, Places, Gemini AI)
GOOGLE_MAPS_API_KEY=AIzaSy-REPLACE_WITH_YOUR_KEY

# Gemini AI (separate key for AI features)
GEMINI_API_KEY=your-gemini-api-key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DOMAIN=yourdomain.com

# Firebase Client Config (safe to expose in browser)
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id

# Firebase Admin (server-side only, NEVER expose to browser)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
FIREBASE_PROJECT_ID=your-project-id

# Email
RESEND_API_KEY=re_REPLACE_WITH_YOUR_KEY

# AdSense (optional)
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXX
```

### Client vs Server Key Separation

Next.js enforces a critical rule: **only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser**.

| Prefix | Available In | Example |
|--------|-------------|---------|
| `NEXT_PUBLIC_` | Browser + Server | `NEXT_PUBLIC_FIREBASE_API_KEY` |
| No prefix | Server only | `FIREBASE_SERVICE_ACCOUNT`, `RESEND_API_KEY` |

**Rule:** Never put secrets (service accounts, API keys with write access) in `NEXT_PUBLIC_` variables.

## Firebase Setup

### Client SDK (Browser-Side)

```typescript
// lib/firebase-client.ts
import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'project.firebaseapp.com',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'project-id',
}

// Idempotency guard — prevents double-init during hot reload
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
const auth = getAuth(app)

export { app, auth }
```

### Admin SDK (Server-Side)

```typescript
// lib/firebase.ts
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

let app: App
let db: Firestore

function getDb(): Firestore {
    if (!db) {
        if (getApps().length === 0) {
            const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
            if (serviceAccount) {
                // Production: use full service account JSON
                app = initializeApp({ credential: cert(JSON.parse(serviceAccount)) })
            } else {
                // Local dev: use ADC or just project ID
                app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'project-id' })
            }
        } else {
            app = getApps()[0]
        }
        db = getFirestore(app, 'database-name') // named database, not default
    }
    return db
}

export { getDb }
```

**Key Patterns:**
- **Lazy singleton** via `getDb()` — not initialized at module load time
- **`getApps().length === 0` guard** — prevents double-initialization (critical for Next.js hot reload and serverless cold starts)
- **Dual init path** — `FIREBASE_SERVICE_ACCOUNT` for production, fallback for local development
- **Named database** — Firestore supports multiple databases per project. Pass the database ID to `getFirestore()`.

## Graceful Degradation

When API keys are missing, the app should degrade gracefully rather than crash.

### Rate Limiter Fails Open

```typescript
let db: ReturnType<typeof getDb>
try {
    db = getDb()
} catch {
    // Firebase not available — allow all requests
    return { allowed: true, remaining: 999, limit: 999, resetAt: `${today}T23:59:59Z` }
}
```

### AI Features Degrade

```typescript
// Initialize with empty string — will fail gracefully when called
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
```

### Email Sends Are Optional

```typescript
const resendKey = process.env.RESEND_API_KEY
let emailSent = false

if (resendKey) {
    try {
        const { Resend } = await import('resend')
        const resend = new Resend(resendKey)
        await resend.emails.send({ /* ... */ })
        emailSent = true
    } catch (emailErr) {
        console.error('Email send error:', emailErr)
    }
}

// Always return success, just indicate whether email was sent
return NextResponse.json({ success: true, emailSent })
```

**Pattern:** Dynamic import `await import('resend')` — only loads the email library when the API key exists.

## Resend Email Setup

```typescript
// lib/email.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail(to: string, subject: string, html: string) {
    return resend.emails.send({
        from: 'AppName <noreply@yourdomain.com>',
        to,
        subject,
        html,
    })
}
```

**Gotcha:** Resend requires a verified sending domain. During development, use `onboarding@resend.dev` as the from address.

## Google Maps/Places API

The Google Maps API key is used server-side for Places API searches:

```typescript
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY

// Server-side Places API call (no client-side SDK needed)
const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${GOOGLE_API_KEY}`
)
```

**Gotcha:** Use server-side API calls instead of the Google Maps JavaScript SDK to avoid exposing your API key and to reduce bundle size. The JS SDK adds ~200KB to the client bundle.

## Vercel Environment Variable Scoping

In Vercel dashboard, scope variables to specific environments:

| Variable | Production | Preview | Development |
|----------|-----------|---------|-------------|
| `NEXT_PUBLIC_APP_URL` | `https://yourdomain.com` | Auto-set by Vercel | `http://localhost:3000` |
| `FIREBASE_SERVICE_ACCOUNT` | Full JSON | Same | Can omit (uses ADC) |
| `RESEND_API_KEY` | Real key | Test key or omit | Omit |

**Key Rule:** Preview deployments should use the same database but can skip email/SMS to avoid spamming real users during testing.

## Reusable Checklist

- [ ] **Create `.env.example`** with all variables documented and placeholder values
- [ ] **Add `.env.local` to `.gitignore`** — never commit real secrets
- [ ] **Separate `NEXT_PUBLIC_` from server-only variables** — client-safe vs secret
- [ ] **Use `getApps().length` idempotency guard** for both Firebase client and admin initialization
- [ ] **Implement lazy singleton pattern** for server-side SDK init (don't init at module load)
- [ ] **Add dual init paths** — full credentials for production, simplified for local dev
- [ ] **Make every external service optional** — wrap in try/catch, use dynamic imports
- [ ] **Fail open for non-critical services** — rate limiting, analytics should never block the main flow
- [ ] **Return `emailSent` booleans** — let the caller know if the email went out without failing the operation
- [ ] **Scope Vercel env vars** — different values for Production vs Preview vs Development
- [ ] **Prefer server-side API calls** over client-side SDKs for external services
