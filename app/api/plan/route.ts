import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { assembleContext, hasContext } from '@/lib/ai-context-server'
import { checkRateLimit } from '@/lib/rate-limiter'

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

    const prompt = isRefinement ? `You are PartyPal, an expert party planner AI. Refine the planning timeline below based on user feedback.
${contextBlock}
Event: ${eventType} | Date: ${date || 'TBD'} | Guests: ${guests} | Location: ${location} | Theme: ${theme || 'Open'} | Budget: ${budget || 'Flexible'}
Today's date: ${new Date().toISOString().split('T')[0]}

Current Timeline:
${existingTimeline}

User's refinement request: "${refinement}"

Return ONLY valid JSON with the updated timeline applying the user's feedback. Keep items that don't need changing. The format must be:
{
  "timeline": [
    {"weeks":"time period","task":"description","category":"category","priority":"high|medium|low"}
  ]
}

Return ONLY valid JSON, no markdown, no backticks.` : `You are PartyPal, an expert party planner AI. Generate a comprehensive party plan.
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

CROSS-PORTAL INTELLIGENCE RULES:
- If guest dietary data is provided, reflect that in food/catering budget allocation and checklist items
- If vendors are already shortlisted, reference them by name in relevant timeline tasks
- If the user has a moodboard vibe, align tip language and decor suggestions to match
- If budget is mostly spent, focus tips on cost-saving and DIY options
- If user preferences indicate a planning style, match the detail level (minimal = fewer items, detailed = comprehensive)

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
- Categories should be single-word lowercase tags like: venue, vendor, food, decor, guests, music, planning, logistics, photos

Make ALL content specific to the actual event details provided. Adjust budget percentages to make sense for the event type and the budget amount given.`

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const plan = JSON.parse(cleaned)
    // For refinements, the response only contains { timeline: [...] }
    // but the dashboard expects { plan: { timeline: [...] } }
    if (isRefinement) {
      return NextResponse.json({ plan: { timeline: plan.timeline || plan }, eventType, guests, location, theme, date, budget })
    }
    return NextResponse.json({ plan, eventType, guests, location, theme, date, budget })
  } catch (error: unknown) {
    console.error('Plan error:', error)
    const msg = error instanceof Error ? error.message : 'Failed to generate plan'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
