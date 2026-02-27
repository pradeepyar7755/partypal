import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_MAPS_API_KEY || '')

export async function POST(req: NextRequest) {
  try {
    const { eventType, date, guests, location, theme, budget, refinement, existingTimeline } = await req.json()
    if (!eventType || !guests || !location) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const isRefinement = refinement && existingTimeline

    const prompt = isRefinement ? `You are PartyPal, an expert party planner AI. Refine the planning timeline below based on user feedback.

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

Event: ${eventType} | Date: ${date || 'TBD'} | Guests: ${guests} | Location: ${location} | Theme: ${theme || 'Open'} | Budget: ${budget || 'Flexible'}
Today's date: ${new Date().toISOString().split('T')[0]}

IMPORTANT TIMELINE RULES:
- Calculate the ACTUAL time between today and the event date
- Generate timeline milestones using REALISTIC time periods (e.g. "This week", "3 days out", "2 weeks out") based on the real lead time available
- If the event is less than 2 weeks away, this is SHORT NOTICE: compress the timeline into days, flag items that need to be fast-tracked with ⚡ prefix, and add a warning note about potential blockers (vendor availability, venue constraints)
- If the event is less than 1 week away, this is RUSH PLANNING: be very aggressive with the timeline, prioritize essentials only, and note what can realistically be pulled off
- Do NOT use a generic "6 weeks out" format if the event is sooner than that
- Keep deliverables CONCISE (4-6 milestones max, not 10+). Each milestone should be a clear action.
- Always include a "Day before" or final prep milestone and an "Event Day" milestone

Return ONLY valid JSON, no markdown, no backticks:
{
  "summary": "2-sentence exciting summary. If short notice, acknowledge the tight timeline but stay encouraging.",
  "timeline": [
    {"weeks":"appropriate time period","task":"Concise action item","category":"category_tag","priority":"high|medium|low"}
  ],
  "checklist": [
    {"item":"Specific actionable task","category":"matching_category","done":false}
  ],
  "budget": {
    "total": "${budget || '$2,000'}",
    "breakdown": [
      {"category":"Category","amount":number,"percentage":number,"color":"hex_color"}
    ]
  },
  "tips": [
    "Tip 1 specific to this party type and timeline",
    "Tip 2 specific to this theme",
    "Tip 3 for this guest count"
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
- Generate 6-10 specific checklist items
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
