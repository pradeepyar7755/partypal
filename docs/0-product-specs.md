# PartyPal — Product Specification

> **Version:** 1.0 | **Last Updated:** March 2, 2026  
> **Live URL:** [partypal.social](https://partypal.social) | **Platforms:** Web, iOS, Android

---

## 1. Product Overview

PartyPal is an **AI-powered party planning platform** that transforms event planning from a stressful chore into an effortless, delightful experience. Users input basic event details and receive a complete, AI-generated party plan — including timeline, checklist, budget breakdown, vendor recommendations, moodboard, and guest management — in seconds.

### Vision
*Make party planning as easy as ordering takeout — smart, fast, and personalized.*

### Target Audience
- Individuals planning birthday parties, weddings, graduations, holiday gatherings, corporate events
- Age range: 22–55, primarily millennials and Gen Z
- Tech-comfortable users who value convenience and quality

---

## 2. Core Features

### 2.1 AI Party Planner (Wizard)
| Attribute | Detail |
|---|---|
| **Input** | Event type, date, guest count, location, theme, budget |
| **Output** | Complete plan with summary, timeline, checklist, budget breakdown, tips, moodboard |
| **AI Model** | Google Gemini 2.5 Flash |
| **Refinement** | Users can refine the plan with natural language instructions |
| **Context-Aware** | Cross-portal intelligence uses guest, vendor, and preference data to personalize plans |

### 2.2 Interactive Dashboard
- **Tabbed interface:** Plan, Theme, Vendors, Guests, Polls
- **Timeline view** with milestone tracking and computed dates
- **Smart checklist** with categories, due dates, completion tracking, and task assignment
- **Budget tracker** with visual progress bars and category breakdowns
- **Moodboard** with color palette, vibe description, decor ideas, tablescape, and lighting suggestions
- **Multi-event support** — users can manage multiple events simultaneously
- **Demo mode** — pre-loaded sample event for first-time users

### 2.3 Vendor Marketplace
| Attribute | Detail |
|---|---|
| **Data Source** | Google Maps Places API (New) |
| **Categories** | Venue, Decor, Baker, Food, Music, Photos, Drinks, Entertain |
| **Features** | Location-based search, match scoring, ratings, price levels, Google Maps links, photos |
| **Shortlist** | Save vendors to shortlist, synced to event and Firestore |
| **Caching** | In-memory 5-minute TTL cache to reduce API calls |

### 2.4 Guest Management
| Attribute | Detail |
|---|---|
| **Add guests** | Individual or bulk import (comma/newline separated) |
| **RSVP tracking** | Going, Maybe, Declined, Pending statuses |
| **Dietary tracking** | 9 dietary options per guest (Vegetarian, Vegan, Gluten-Free, etc.) |
| **Additional guests** | +1s with name, dietary, and relationship fields |
| **AI invites** | Gemini generates personalized invitation text based on event details |
| **Custom invites** | Upload custom invite images with cover photos |
| **RSVP link** | Shareable public RSVP page (`/rsvp?event=<id>&v=<version>`) |
| **Sharing** | Copy link, WhatsApp share, direct email invites |
| **Email notifications** | Invite emails, RSVP confirmations, guest update notifications via Resend |

### 2.5 Polls & Voting
| Attribute | Detail |
|---|---|
| **Preset polls** | Best date, Venue choice, Theme, Food preference, Activity, Start time |
| **Custom polls** | Custom question with custom options |
| **Sharing** | Shareable public poll page (`/poll?id=<pollId>`) |
| **Context hints** | Smart tips based on event data |
| **Real-time results** | Live vote tracking stored in Firestore |

### 2.6 Collaboration
| Attribute | Detail |
|---|---|
| **Invite collaborators** | Email-based invitations with named roles |
| **Accept flow** | Public acceptance page links collaborator to event |
| **Task assignment** | Assign checklist/timeline tasks to specific collaborators |
| **Email notification** | Styled HTML invitation email via Resend |

### 2.7 AI Memory & Learning
- Tracks user planning style (minimal / detailed / collaborative)
- Learns budget tendency (frugal / moderate / lavish)  
- Detects tone preference (casual / formal / playful / elegant)
- Records favorite vendor categories, past event types, refinement patterns
- Syncs preferences to cloud (Firestore) for cross-device continuity

### 2.8 Authentication
| Method | Provider |
|---|---|
| Google Sign-In | Firebase Auth + Google OAuth |
| Apple Sign-In | Firebase Auth + Apple OAuth |
| Email/Password | Firebase Auth |
| Guest Mode | Anonymous Firebase Auth |

### 2.9 Analytics & Admin
- **Client-side tracking:** Page views, sessions, feature usage, conversions, errors
- **Batched flush:** Events queued and sent in batches of 10 or every 30s
- **Admin dashboard** (`/admin`): KPIs, conversion funnel, user management, event stats, API metrics
- **Admin access:** Whitelisted email (`admin@partypal.social`)

### 2.10 Email System
9 professional HTML email templates:
1. Invitation Email
2. RSVP Confirmation
3. Host RSVP Notification
4. Event Update Notification
5. Event Reminder
6. Welcome Email
7. Post-Event Thank You
8. Collaborator Invite
9. Support Confirmation

### 2.11 Mobile Apps (Capacitor)
| Attribute | Detail |
|---|---|
| **Framework** | Capacitor 8.x |
| **Strategy** | Hybrid — wraps `partypal.social` in native shell |
| **iOS** | Native splash screen, status bar, keyboard handling |
| **Android** | Native splash screen, push notifications, haptics |
| **App ID** | `social.partypal.app` |

---

## 3. Non-Functional Requirements

| Requirement | Implementation |
|---|---|
| **Rate Limiting** | Dynamic per-user daily limits based on total registered users, tiered scaling |
| **Privacy** | Privacy policy page, data export, AI memory clearing |
| **Performance** | In-memory vendor caching, batched analytics, lazy-loaded components |
| **Security** | Admin email whitelist, Firebase Auth, server-side API key storage, input validation |
| **Deployment** | Vercel (Hobby plan), GitHub CI/CD |
| **Domain** | `partypal.social` (Namecheap) |

---

## 4. Pages & Routes

| Route | Purpose |
|---|---|
| `/` | Landing page with hero, categories, AI wizard, demo, features, contact |
| `/dashboard` | Interactive planning dashboard (multi-event, tabbed) |
| `/vendors` | Vendor marketplace with category filtering |
| `/guests` | Standalone guest management |
| `/results` | AI plan results with tabs (Plan, Budget, Moodboard) |
| `/login` | Authentication page (Google, Apple, Email) |
| `/rsvp` | Public RSVP response page |
| `/poll` | Public poll voting page |
| `/collaborate` | Collaboration accept page |
| `/budget` | Budget management |
| `/contact` | Contact form |
| `/settings` | User settings (profile, preferences, data management) |
| `/privacy` | Privacy policy |
| `/admin` | Admin analytics dashboard |

---

## 5. API Endpoints (23 total)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/plan` | POST | Generate/refine AI party plan (Gemini) |
| `/api/vendors` | POST | Search vendors via Google Places |
| `/api/moodboard` | POST | Generate AI moodboard (Gemini) |
| `/api/guests` | POST | Generate AI invites (Gemini) |
| `/api/polls` | POST | Create/vote on polls (Firestore) |
| `/api/events` | GET/POST | CRUD events (Firestore) |
| `/api/events/[id]` | GET/DELETE | Get/delete specific event |
| `/api/events/shared` | GET | Get shared/collaborated events |
| `/api/collaborate/invite` | POST | Send collaborator invite email |
| `/api/collaborate/accept` | POST | Accept collaboration invite |
| `/api/notify` | POST | Send guest notification emails |
| `/api/email` | POST | Send emails via Resend |
| `/api/location` | POST | Google Places Autocomplete |
| `/api/geolocation` | POST | Reverse geocoding |
| `/api/analytics` | POST | Receive analytics events |
| `/api/user-data` | GET/POST | User profile & AI memory sync |
| `/api/account/delete` | DELETE | Account deletion |
| `/api/admin/users` | GET | List users (admin) |
| `/api/admin/events` | GET | List events (admin) |
| `/api/admin/usage` | GET | API usage stats (admin) |
| `/api/admin/cleanup` | POST | Data cleanup (admin) |
| `/api/admin/migrate-events` | POST | Event migration (admin) |
| `/api/seed-accounts` | POST | Seed test accounts |
