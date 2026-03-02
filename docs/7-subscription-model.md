# PartyPal — Subscription Model Analysis

> **Milestone:** 500 registered users | **Last Updated:** March 2, 2026  
> **Objective:** Evaluate monetization strategies with profit margin projections

---

## 1. Cost Baseline at 500 Users

Before modeling revenue, here's what PartyPal costs to operate at the 500-user milestone (from [resource usage docs](file:///Users/pradeepyar/Downloads/partypal/docs/6-resource-usage.md)):

| Service | Monthly Cost | Notes |
|---|---|---|
| Gemini API (AI) | $100–300 | ~7,500 AI calls/month (500 users × 15 calls avg) |
| Google Maps | $50–150 | Vendor search, autocomplete, photos |
| Firebase | $50–100 | Firestore reads/writes, auth |
| Vercel | $20 | Pro plan |
| Resend | $20–50 | ~3,000+ emails/month |
| Domain | $1 | Namecheap |
| **Total** | **$241–$621/month** | |

> [!IMPORTANT]
> **Midpoint estimate used for modeling: ~$430/month ($5,160/year)**
> Not all 500 users are active simultaneously. Assume **30% monthly active** (~150 MAU), which is typical for event-planning tools with seasonal spikes.

### Per-User Cost Breakdown

| Metric | Value |
|---|---|
| Cost per registered user | ~$0.86/month |
| Cost per active user (MAU) | ~$2.87/month |
| Cost per AI call | ~$0.005–0.04 |
| Cost per event planned | ~$0.15–0.50 |

---

## 2. Subscription Models

### Model A: Freemium + Pro Tier

The classic SaaS approach — generous free tier to drive growth, paid tier for power users.

| | **Free** | **Pro** ($4.99/month or $39.99/year) |
|---|---|---|
| AI Plan Generation | 2 plans/month | Unlimited |
| Plan Refinements | 3 total | Unlimited |
| Moodboards | 1/month | Unlimited |
| Events | 1 active | Unlimited |
| Guests per event | 25 | Unlimited |
| Vendor Search | 5 searches/month | Unlimited |
| Polls | 1 per event | Unlimited |
| Collaborators | — | Up to 5 per event |
| AI Invites | — | ✅ |
| AI Memory | — | ✅ |
| Email Invites | — | ✅ |
| Priority Support | — | ✅ |

**Profit Margin Scenarios (at 500 users):**

| Conversion Rate | Paying Users | Monthly Revenue | Monthly Cost | Profit/Loss | Margin |
|---|---|---|---|---|---|
| 3% | 15 | $75 | $430 | **−$355** | −83% |
| 5% | 25 | $125 | $430 | **−$305** | −71% |
| 10% | 50 | $250 | $430 | **−$180** | −42% |
| 15% | 75 | $375 | $430 | **−$55** | −13% |
| 20% | 100 | $499 | $430 | **+$69** | +14% |

> [!NOTE]
> Break-even at **~86 paying users** (17% conversion). Industry average freemium conversion is 2–5%, but niche tools with high value can reach 10–15%.

**✅ Pros:**
- Lowest barrier to entry — maximizes user growth
- Users experience value before paying  
- Annual plan improves retention and cash flow ($39.99 = ~33% discount incentive)
- Free users still generate word-of-mouth and viral loops (RSVP links, polls)

**❌ Cons:**
- Free users still cost money (AI calls, Maps API)
- Low conversion rates mean operating at a loss for months  
- Difficult to "take away" features users already have
- Requires large user base (1,500+) to be sustainably profitable

---

### Model B: Usage-Based (Pay Per Event)

Charge per event planned rather than monthly subscriptions. Aligns cost with value delivery.

| Tier | Price | Includes |
|---|---|---|
| **Quick Plan** | Free | 1 AI plan (no refinements), 10 guests, no vendors |
| **Full Event** | $2.99/event | Full AI plan + 3 refinements, moodboard, 50 guests, vendors, polls |
| **Premium Event** | $6.99/event | Everything + unlimited refinements, collaborators, email invites, AI memory, priority AI |

**Profit Margin Scenarios (at 500 users):**

| Avg Events/User/Month | Paid Events | Avg Revenue/Event | Monthly Revenue | Cost | Profit/Loss | Margin |
|---|---|---|---|---|---|---|
| 0.3 (low) | 100 | $4.00 | $400 | $350* | **+$50** | +13% |
| 0.5 (medium) | 175 | $4.00 | $700 | $430 | **+$270** | +39% |
| 0.8 (high) | 280 | $4.50 | $1,260 | $520 | **+$740** | +59% |

*\*Lower cost at low usage because fewer AI calls are made.*

**✅ Pros:**
- Revenue directly tied to usage — no subsidy problem
- Lower sticker shock than monthly plans ($2.99 vs $4.99/mo)
- Seasonal users pay only when they need it (birthday planners, holiday hosts)
- Costs scale proportionally with revenue
- Easy upsell path (Quick → Full → Premium)

**❌ Cons:**
- Unpredictable monthly revenue (seasonal spikes and valleys)
- Users may try to "game" the free tier  
- Harder to forecast growth and budget  
- No recurring revenue → lower company valuation
- Higher cognitive load for users ("which tier do I need?")

---

### Model C: Tiered Subscription (Good/Better/Best)

Three clearly differentiated tiers. Most common SaaS pricing model.

| | **Starter** ($2.99/mo) | **Plus** ($6.99/mo) | **Pro** ($12.99/mo) |
|---|---|---|---|
| AI Plans | 3/month | 10/month | Unlimited |
| Refinements | 5/month | 20/month | Unlimited |
| Active Events | 1 | 3 | Unlimited |
| Guests/Event | 30 | 75 | Unlimited |
| Vendor Search | 10/month | 30/month | Unlimited |
| Moodboards | 1/month | 5/month | Unlimited |
| Polls | 1/event | 3/event | Unlimited |
| Collaborators | — | 2/event | 5/event |
| AI Invites | — | ✅ | ✅ |
| AI Memory | — | — | ✅ |
| Email Invites | — | ✅ | ✅ |
| Priority Support | — | — | ✅ |

**Profit Margin Scenarios (at 500 users, no free tier):**

| Tier Distribution | Revenue/User | Paying Users | Monthly Revenue | Cost | Profit/Loss | Margin |
|---|---|---|---|---|---|---|
| 60/30/10% split | $4.79 avg | 150 MAU | $719 | $430 | **+$289** | +40% |
| 50/35/15% split | $5.49 avg | 150 MAU | $824 | $430 | **+$394** | +48% |
| 40/40/20% split | $6.20 avg | 150 MAU | $930 | $430 | **+$500** | +54% |

> [!TIP]
> With no free tier, every user pays *something*. A 7-day free trial converts better than permanent free tiers (trial conversion rates: 15–25% vs freemium 2–5%).

**✅ Pros:**
- Every user contributes revenue — no free-rider problem
- Predictable monthly recurring revenue (MRR)
- Tier upgrades increase ARPU over time
- Easier budgeting and forecasting
- Higher company valuation (recurring revenue multiple)

**❌ Cons:**
- Paywall kills viral growth — losing free RSVP/poll sharing  
- Smaller user base (friction at signup)
- Harder to compete with free alternatives
- Must deliver instant value to justify day-1 payment
- Requires polished onboarding to reduce churn

---

### Model D: Hybrid (Free + Credits)

Free tier for basic use + purchasable AI credits for power features. Combines freemium growth with monetization.

| | **Free** | **Credits** |
|---|---|---|
| Plan & Browse | ✅ Full dashboard, 1 event, 15 guests | Same |
| AI Credits | 5 free/month | Buy packs: 10 for $1.99, 30 for $4.99, 100 for $12.99 |
| 1 Credit = | 1 AI plan gen, OR 2 refinements, OR 1 moodboard, OR 5 vendor searches | |
| Collaborators | — | 3 credits to unlock per event |
| Email Invites | — | 2 credits to unlock per event |

**Profit Margin Scenarios (at 500 users):**

| Buying Users | Avg Purchase | Monthly Revenue | Cost | Profit/Loss | Margin |
|---|---|---|---|---|---|
| 50 (10%) | $3.50 | $175 | $430 | **−$255** | −59% |
| 100 (20%) | $4.00 | $400 | $430 | **−$30** | −7% |
| 150 (30%) | $4.50 | $675 | $430 | **+$245** | +36% |
| 200 (40%) | $5.00 | $1,000 | $430 | **+$570** | +57% |

**✅ Pros:**
- Free tier enables viral growth (RSVP links, polls work free)
- Users only pay for what they use — feels fair
- Impulse-buy friendly (small dollar amounts)
- Heavy planners naturally spend more → high LTV
- No commitment anxiety (no subscription to cancel)

**❌ Cons:**
- Revenue is less predictable than subscriptions
- Credit systems can feel "nickle-and-dime"
- Complex UX — users must understand credit economy
- Hard to forecast revenue for investors
- Some users will never convert past free credits

---

## 3. Comparison Matrix

| Metric | A: Freemium + Pro | B: Pay Per Event | C: Tiered Sub | D: Free + Credits |
|---|---|---|---|---|
| **Break-even users** | ~86 paying | ~100 events | 150 MAU (all pay) | ~100 buyers |
| **Revenue predictability** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Growth friendliness** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Margin at 500 users** | −42% to +14% | +13% to +59% | +40% to +54% | −59% to +57% |
| **Implementation effort** | Medium | Medium | High | High |
| **Viral loop preserved** | ✅ | Partial | ❌ | ✅ |
| **Investor appeal** | Medium | Low | High | Medium |
| **User experience** | Great | Good | Friction | Good |
| **Scalability** | Needs volume | Natural | Predictable | Natural |
| **Best for stage** | Pre-revenue growth | Seasonal product | Post-PMF | Early monetization |

---

## 4. Recommendation

### 🏆 Recommended: **Model D (Hybrid Free + Credits)** → Transition to **Model A (Freemium + Pro)** at 1,500+ users

**Phase 1 (500–1,500 users): Credits Model**
1. Keep the free tier generous to maintain viral loops (RSVP, polls, sharing)
2. Monetize power features with credit packs
3. Give 5 free AI credits/month to let users experience value
4. Target 20–30% credit purchase rate → $400–675/month revenue
5. Use data to understand which features drive purchases

**Phase 2 (1,500+ users): Transition to Freemium + Pro**
1. Introduce Pro subscription packaging the most popular credit-purchased features
2. Grandfather early credit buyers with bonus credits
3. Target 10–15% Pro conversion → sustainable at volume
4. Keep credits available as add-ons for seasonal users

### Why This Path?

| Factor | Reasoning |
|---|---|
| **Growth** | Free tier preserves the viral RSVP/poll sharing loop — your #1 growth channel |
| **Data** | Credits reveal exactly which features users value most → informs Pro tier packaging |
| **Risk** | Low commitment from users, low risk for you — iterate pricing freely |
| **Revenue** | Positive margin achievable at 20% purchase rate |
| **Transition** | Natural evolution from credits → subscription as user base grows |

---

## 5. Key Metrics to Track

Before launching any model, instrument these metrics:

| Metric | Why It Matters |
|---|---|
| **MAU / DAU ratio** | Understand actual active usage vs registrations |
| **AI calls per user per session** | Price credits/limits accurately |
| **Feature usage frequency** | Know which features to gate vs keep free |
| **Vendor search frequency** | Largest variable cost — gate appropriately |
| **Events per user per month** | Determines if per-event pricing works |
| **Viral coefficient** | How many new users each user brings via RSVP/polls |
| **Session duration** | Correlates with willingness to pay |
| **Churn rate** | Are users coming back? |

> [!CAUTION]
> **Do not gate RSVP links or poll sharing behind a paywall.** These are your primary viral acquisition channels. Every RSVP link a host shares exposes 10–50 new potential users to PartyPal for free.
