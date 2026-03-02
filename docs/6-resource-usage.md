# PartyPal — Resource Usage

> APIs, tokens, services, and costs involved in building and running PartyPal.

---

## 1. External APIs Used

### 1.1 Google Gemini 2.5 Flash (AI)

| Attribute | Value |
|---|---|
| **Provider** | Google AI Studio / Vertex AI |
| **Model** | `gemini-2.5-flash` |
| **Plan** | Paid Tier 1 |
| **Endpoints Using It** | `/api/plan`, `/api/moodboard`, `/api/guests` |
| **Rate Limits** | 1,500 RPD · 300 RPM · 1M TPM |

**Usage Per Feature:**

| Feature | Avg Tokens (Input) | Avg Tokens (Output) | Est. Cost Per Call |
|---|---|---|---|
| Plan Generation | ~1,500–3,000 | ~800–1,500 | ~$0.002–0.005 |
| Plan Refinement | ~2,000–4,000 | ~500–1,000 | ~$0.002–0.004 |
| Moodboard Generation | ~800–1,500 | ~600–1,000 | ~$0.001–0.003 |
| Invite Generation | ~500–1,000 | ~200–500 | ~$0.001–0.002 |
| Invite Refinement | ~600–1,200 | ~200–500 | ~$0.001–0.002 |

**Pricing (Gemini 2.5 Flash — Paid Tier 1):**

| Metric | Rate |
|---|---|
| Input (≤200K tokens) | $0.15 per 1M tokens |
| Output | $0.60 per 1M tokens |
| Thinking | $3.50 per 1M tokens |

**Monthly Estimate (50 active users, ~15 AI calls each):**
- ~750 API calls/month
- ~2.5M input tokens, ~750K output tokens
- **Estimated: $5–15/month**

---

### 1.2 Google Maps Platform

| API | Used For | Endpoint |
|---|---|---|
| **Places API (New)** | Vendor search | `/api/vendors` |
| **Places Autocomplete** | Location input | `/api/location` |
| **Geocoding** | Reverse geocoding | `/api/geolocation` |
| **Places Photos** | Vendor photos | Via photo reference URL |

**Pricing:**

| API | Cost | Free Credit |
|---|---|---|
| Text Search (New) | $32 per 1,000 requests | $200/month credit |
| Autocomplete (New) | $2.83 per 1,000 requests | Included in $200 credit |
| Geocoding | $5 per 1,000 requests | Included in $200 credit |
| Place Photos | $7 per 1,000 requests | Included in $200 credit |

**Optimization: In-Memory Caching**
- 5-minute TTL cache on vendor searches
- Same category + location query → cached response
- Reduces API calls by ~40–60%

**Monthly Estimate (50 active users):**
- ~300 Text Search calls (cached)
- ~400 Autocomplete calls
- ~100 Geocoding calls
- ~500 Photo requests
- **Estimated: $0–15/month** (within $200 free credit)

---

### 1.3 Firebase

| Service | Used For | Free Tier |
|---|---|---|
| **Authentication** | User sign-in | 10,000 auths/month |
| **Firestore** | Data persistence | 50K reads/day, 20K writes/day |
| **Admin SDK** | Server-side operations | N/A (consumes Firestore quota) |

**Firestore Collections:**

| Collection | Reads/Day Est. | Writes/Day Est. |
|---|---|---|
| `events` | ~500 | ~200 |
| `polls` | ~300 | ~150 |
| `users` | ~200 | ~100 |
| `analytics` | ~50 | ~200 |
| `rate_limits` | ~300 | ~300 |
| `api_logs` | ~50 | ~200 |
| **Total** | **~1,400** | **~1,150** |

**Monthly Estimate:**
- Well within free tier for ≤100 users
- **Estimated: $0/month** (Spark plan)
- At scale (1000+ users): ~$25–50/month (Blaze plan)

---

### 1.4 Resend (Email)

| Attribute | Value |
|---|---|
| **Provider** | Resend |
| **Templates** | 9 custom HTML templates |
| **Free Tier** | 100 emails/day, 3,000/month |

**Email Types & Volume:**

| Template | Trigger | Est. Volume |
|---|---|---|
| Invitation | Host sends invites | ~20/week |
| RSVP Confirmation | Guest RSVPs | ~15/week |
| Host RSVP Notification | Each RSVP | ~15/week |
| Event Update | Host changes details | ~5/week |
| Event Reminder | Automated pre-event | ~10/week |
| Welcome | New user signup | ~5/week |
| Post-Event Thank You | After event date | ~3/week |
| Collaborator Invite | Host adds collaborator | ~2/week |
| Support Confirmation | Contact form | ~1/week |
| **Total** | | **~76/week = ~330/month** |

**Monthly Estimate:**
- **Estimated: $0/month** (within free tier)
- At scale: $20/month (Pro plan, 50K emails/month)

---

### 1.5 Vercel (Hosting)

| Attribute | Value |
|---|---|
| **Plan** | Hobby (Free) |
| **Framework** | Next.js |
| **Deployments** | Git push → auto deploy |
| **Bandwidth** | 100 GB/month |
| **Serverless Functions** | 100 GB-hrs/month |
| **Edge Functions** | 500K invocations/month |

**Monthly Estimate:**
- **Estimated: $0/month**
- At scale: $20/month (Pro plan)

---

### 1.6 Namecheap (Domain)

| Attribute | Value |
|---|---|
| **Domain** | `partypal.social` |
| **TLD** | `.social` |
| **Annual Cost** | ~$12/year |
| **DNS** | CNAME to Vercel |

**Monthly Estimate: ~$1/month**

---

## 2. Development Resources

### APIs Consumed During Development (Build Phase)

| Resource | Usage | Purpose |
|---|---|---|
| **Anthropic Claude API** | ~50+ conversations | AI pair programming (code generation) |
| **Google Gemini API** | ~200+ test calls | Testing AI plan/moodboard generation |
| **Google Maps API** | ~100+ test calls | Testing vendor search |
| **Firebase** | ~5,000+ R/W | Testing data persistence |
| **Resend** | ~50+ test emails | Testing email templates |
| **Vercel** | ~30+ deploys | Production deployments |

### Claude API Usage (Development)

| Metric | Estimate |
|---|---|
| **Conversations** | ~20+ major sessions |
| **Avg tokens per conversation** | ~50,000–100,000 |
| **Total tokens consumed** | ~1–2M tokens |
| **Estimated development cost** | ~$15–30 (Claude Pro subscription) |

---

## 3. Monthly Cost Summary

### Stage 1: Launch (0–50 users)

| Service | Monthly Cost |
|---|---|
| Vercel | $0 |
| Firebase | $0 |
| Gemini API | ~$5–15 |
| Google Maps | $0 (within $200 credit) |
| Resend | $0 |
| Domain | ~$1 |
| **Total** | **~$6–16/month** |

### Stage 2: Growth (50–500 users)

| Service | Monthly Cost |
|---|---|
| Vercel | $0–20 |
| Firebase | $0–25 |
| Gemini API | ~$20–50 |
| Google Maps | ~$0–30 |
| Resend | $0–20 |
| Domain | ~$1 |
| **Total** | **~$21–146/month** |

### Stage 3: Scale (500–5000 users)

| Service | Monthly Cost |
|---|---|
| Vercel | $20 |
| Firebase | ~$50–100 |
| Gemini API | ~$100–300 |
| Google Maps | ~$50–150 |
| Resend | ~$20–50 |
| Domain | ~$1 |
| **Total** | **~$241–621/month** |

---

## 4. API Keys & Credentials Inventory

| Key | Location | Service |
|---|---|---|
| `GEMINI_API_KEY` | `.env.local` + Vercel | Google AI Studio |
| `GOOGLE_MAPS_API_KEY` | `.env.local` + Vercel | Google Cloud Console |
| `RESEND_API_KEY` | `.env.local` + Vercel | resend.com |
| `FIREBASE_SERVICE_ACCOUNT_*` | `.env.local` + Vercel | Firebase Console |
| `NEXT_PUBLIC_FIREBASE_*` | `.env.local` + Vercel | Firebase Console (client config) |
| `NEXT_PUBLIC_APP_URL` | `.env.local` + Vercel | Self-configured |
| `NEXT_PUBLIC_DOMAIN` | `.env.local` + Vercel | Self-configured |

---

## 5. Rate Limiting Strategy

| User Count | Daily AI Calls/User | Rationale |
|---|---|---|
| ≤25 | 100 | No enforcement — tracking only |
| ≤100 | 40 | Light limits, generous usage |
| ≤250 | 20 | Comfortable for active planners |
| ≤500 | 12 | Moderate usage, covers typical session |
| ≤1000 | 8 | Essential actions only — upgrade to Tier 2 |

**A typical active planning session uses ~15–25 AI calls** (generate plan, refine 2x, generate moodboard, generate invite, refine invite, search vendors 3x).
