import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { assembleContext, hasContext } from '@/lib/ai-context-server'
import { checkRateLimit, logApiCall } from '@/lib/rate-limiter'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: NextRequest) {
  try {
    // Rate limit check
    const identifier = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'anonymous'
    const rateCheck = await checkRateLimit(identifier, 'plan')
    if (!rateCheck.allowed) {
      return NextResponse.json({
        error: `Daily AI limit reached (${rateCheck.limit} requests/day). Try again tomorrow.`,
        rateLimit: rateCheck,
      }, { status: 429 })
    }

    const body = await req.json()
    const { eventType, date, guests, location, theme, budget, refinement, existingTimeline } = body
    if (!eventType || !guests || !location) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Build cross-portal context injection
    const contextBlock = hasContext(body) ? `\n${assembleContext(body, 'party planning')}\nUse the above intelligence to make your plan deeply informed by the user's full situation.\n\n` : ''

    const isRefinement = refinement && existingTimeline

    const prompt = isRefinement ? `You are PartyPal, an expert party planner AI. The user wants to refine their existing plan. Apply their request precisely.
${contextBlock}
Event: ${eventType} | Date: ${date || 'TBD'} | Guests: ${guests} | Location: ${location} | Theme: ${theme || 'Open'} | Budget: ${budget || 'Flexible'}
Today's date: ${new Date().toISOString().split('T')[0]}

UNDERSTANDING THE DATA MODEL:
- "timeline" = high-level MILESTONES (3-5 max). These are deliverables like "Book venue & catering", "Send invitations". Keep descriptions SHORT (5-8 words).
- "checklist" = specific TASKS that belong under milestones. These are actionable to-dos like "Call 3 venues for quotes", "Design invitation card".
- Every milestone MUST have at least 1 matching checklist task (matched by category field).
- Do NOT confuse milestones with tasks. If the user asks to "add tasks", add checklist items, NOT milestones.

Current Milestones:
${existingTimeline}

User's request: "${refinement}"

REFINEMENT RULES:
- Apply the user's request LITERALLY. If they say "make it concise" or "fewer items", REDUCE the number of milestones. If they say "add tasks", add CHECKLIST items.
- If the user asks about creative ideas (games, activities, entertainment, themes, decorations), focus your response on THAT topic — suggest specific, creative ideas rather than generic logistics.
- Milestone task descriptions must be SHORT (5-8 words max). Never use filler like "Review tasks below" or "Complete this milestone" — every description must be a concrete action.
- Keep existing milestones that don't conflict with the user's request. Only change what the user asked to change.
- Milestones MUST always cover venue, guests, and food (these can be combined with other items in the same milestone).
- Categories should be single-word lowercase tags: venue, vendor, food, decor, guests, music, planning, logistics, photos, entertainment, games

Return ONLY valid JSON, no markdown, no backticks:
{
  "timeline": [
    {"weeks":"time period","task":"Short 5-8 word action","category":"category","priority":"high|medium|low"}
  ],
  "checklist": [
    {"item":"Specific actionable task","category":"matching_milestone_category","done":false}
  ]
}

CHECKLIST RULES:
- Every milestone category MUST have at least 1 matching checklist item.
- If the user's request is about a specific topic (e.g. games, decorations), add detailed checklist items for that topic.
- Keep existing checklist items that are still relevant (match them by category to the milestones).
- Each item should be SHORT and actionable (e.g. "Buy card games & trivia sets" not "Research and purchase various card games and trivia question sets for the party").` : `You are PartyPal, an expert party planner AI. Generate a comprehensive party plan.
${contextBlock}
Event: ${eventType} | Date: ${date || 'TBD'} | Guests: ${guests} | Location: ${location} | Theme: ${theme || 'Open'} | Budget: ${budget || 'NOT PROVIDED — you must estimate'}
Today's date: ${new Date().toISOString().split('T')[0]}

IMPORTANT TIMELINE RULES:
- Calculate the ACTUAL time between today and the event date
- Generate timeline milestones using REALISTIC time periods (e.g. "This week", "3 days out", "2 weeks out") based on the real lead time available
- If the event is less than 2 weeks away, this is SHORT NOTICE: compress the timeline into days, flag items that need to be fast-tracked with ⚡ prefix, and add a warning note about potential blockers (vendor availability, venue constraints)
- If the event is less than 1 week away, this is RUSH PLANNING: be very aggressive with the timeline, prioritize essentials only, and note what can realistically be pulled off
- Do NOT use a generic "6 weeks out" format if the event is sooner than that
- Keep deliverables CONCISE: 3-5 milestones MAXIMUM. Fewer is better.
- Each milestone task description must be SHORT: 5-8 words max (e.g. "Book venue & photographer", "Order decor & cake")
- Combine related tasks into single milestones (e.g. "Book venue & photographer" not separate entries)
- Always include a "Final prep" milestone and an "Event Day" milestone
- CRITICAL: Milestones MUST be in chronological order (earliest date first, event day last). Never place a later date before an earlier one.

NON-NEGOTIABLE MILESTONES — these three MUST appear in every timeline:
1. 🏠 Venue (category: "venue") — If the user's location looks like a specific venue or address (not just a city), frame this as "Confirm venue details" or "Confirm venue & logistics" rather than "Book venue". Only suggest browsing/booking a new venue when the location is just a city name.
2. 💌 Guests (category: "guests") — Always include a milestone for guest management: sending invitations, tracking RSVPs, collecting dietary preferences.
3. 🍽️ Food (category: "food") — Always include a milestone for food/catering: menu planning, dietary accommodations, drinks.
These three can be combined with other related tasks in the same milestone (e.g. "Book venue & photographer"), but the core non-negotiable item MUST be present. Never omit any of these three.

VENDOR RELEVANCE — match vendors and tasks to the event type logically:
- Casual/game parties (poker, trivia, game night, board games): Skip photographer, DJ, florist. Focus on food, drinks, games, seating.
- Kid birthday parties: Skip DJ, bar service. Focus on cake, decorations, entertainment, games.
- Formal events (wedding, gala, anniversary): Include photographer, DJ/band, florist, caterer.
- Dinner parties / brunch: Focus on chef/caterer, wine/drinks, table decor. Skip DJ, photographer unless requested.
- Corporate events: Include AV/tech, catering, venue. Skip florist, DJ unless requested.
- Do NOT include vendors just to fill categories — only include what makes logical sense for the specific event type.
- Apply this same logic to budget breakdown: don't allocate budget to irrelevant vendor categories.

CROSS-PORTAL INTELLIGENCE RULES:
- If guest dietary data is provided, reflect that in food/catering budget allocation and checklist items
- If vendors are already shortlisted, reference them by name in relevant timeline tasks
- If the user has a moodboard vibe, align tip language and decor suggestions to match
- If budget is mostly spent, focus tips on cost-saving and DIY options
- If user preferences indicate a planning style, match the detail level (minimal = fewer items, detailed = comprehensive)
- IMPORTANT: Do NOT include any personal names (host name, user name) in the generated plan content.

BUDGET ESTIMATION RULES (when budget is NOT provided):
- You MUST estimate a realistic, CONSERVATIVE total budget based on: event type, guest count, location, and theme
- Use real-world pricing for the given location (e.g. Atlanta is cheaper than NYC or LA)
- CONSERVATIVE per-guest benchmarks (including ALL costs — venue, food, drinks, decor, everything):
  * Casual house party / birthday: $15-30/guest total
  * Semi-formal event / milestone birthday: $40-75/guest total
  * Formal event / wedding reception: $100-200/guest total
  * Kids birthday party: $10-20/guest total
- IMPORTANT: Most casual parties do NOT need a professional photographer, DJ, or fancy venue. Only include these if the event type warrants it.
- Do NOT inflate costs with unnecessary vendor categories. A birthday party at home doesn't need a $500 venue rental.
- For house parties: assume the host's home is free, focus budget on food, drinks, decorations, and cake
- Return a specific dollar amount (e.g. "$750") NOT a range — keep it realistic and on the lower end
- Make the breakdown amounts add up to this estimated total
- Add a tip mentioning this is an AI-suggested budget that can be adjusted

Return ONLY valid JSON, no markdown, no backticks:
{
  "summary": "1-2 short sentences. Keep it exciting but brief.",
  "timeline": [
    {"weeks":"time period","task":"Short 5-8 word action","category":"category_tag","priority":"high|medium|low"}
  ],
  "checklist": [
    {"item":"Specific actionable task","category":"matching_category","done":false}
  ],
  "budget": {
    "total": "${budget || 'ESTIMATE a realistic total budget for this event type, guest count, and location. Use a specific dollar amount like $3,500 — not a range.'}",
    "budgetEstimated": ${!budget},
    "breakdown": [
      {"category":"Category","amount":number,"percentage":number,"color":"hex_color"}
    ]
  },
  "tips": [
    "Short, actionable tip 1",
    "Short, actionable tip 2"
  ],
  "moodboard": {
    "palette": ["#hex1","#hex2","#hex3","#hex4"],
    "keywords": ["keyword1","keyword2","keyword3","keyword4","keyword5"],
    "vibe": "2-sentence description of the aesthetic and atmosphere",
    "decorIdeas": ["idea1","idea2","idea3","idea4"],
    "tablescape": "Ideal tablescape description",
    "lighting": "Lighting recommendation",
    "musicGenre": "Music/playlist recommendation"
  }
}

CHECKLIST RULES:
- Generate 4-6 specific checklist items (keep it tight, not overwhelming)
- Each item should be a SHORT, actionable task (e.g. "Book DJ" not "Research and book a DJ for the party")
- Each checklist item category MUST match one of the timeline milestone categories so they group together
- Never leave a timeline milestone without at least 1 matching checklist item
- You MUST include at least one checklist item for each non-negotiable category: venue, guests, and food
- Categories should be single-word lowercase tags like: venue, vendor, food, decor, guests, music, planning, logistics, photos

Make ALL content specific to the actual event details provided. Adjust budget percentages to make sense for the event type and the budget amount given.`

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const plan = JSON.parse(cleaned)
    // Track API usage (fire-and-forget)
    logApiCall('plan', 'gemini', identifier)
    // For refinements, the response only contains { timeline: [...] }
    // but the dashboard expects { plan: { timeline: [...] } }
    if (isRefinement) {
      const timeline = Array.isArray(plan.timeline) ? plan.timeline : Array.isArray(plan) ? plan : []
      const checklist = Array.isArray(plan.checklist) ? plan.checklist : []
      return NextResponse.json({ plan: { timeline, checklist }, eventType, guests, location, theme, date, budget })
    }
    // Validate required plan structure from Gemini response
    const validatedPlan = {
      summary: plan.summary || '',
      timeline: Array.isArray(plan.timeline) ? plan.timeline : [],
      checklist: Array.isArray(plan.checklist) ? plan.checklist : [],
      budget: {
        total: plan.budget?.total || budget || '$0',
        budgetEstimated: plan.budget?.budgetEstimated ?? !budget,
        breakdown: Array.isArray(plan.budget?.breakdown) ? plan.budget.breakdown : [],
      },
      tips: Array.isArray(plan.tips) ? plan.tips : [],
      moodboard: plan.moodboard || undefined,
    }
    return NextResponse.json({ plan: validatedPlan, eventType, guests, location, theme, date, budget })
  } catch (error: unknown) {
    console.error('Plan error:', error)
    const msg = error instanceof Error ? error.message : 'Failed to generate plan'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
