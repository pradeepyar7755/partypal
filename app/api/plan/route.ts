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

Return ONLY valid JSON, no markdown, no backticks:
{
  "summary": "2-sentence exciting summary",
  "timeline": [
    {"weeks":"6 weeks out","task":"Book venue and send save-the-dates","category":"venue","priority":"high"},
    {"weeks":"4 weeks out","task":"Send formal invitations","category":"invitations","priority":"high"},
    {"weeks":"3 weeks out","task":"Finalize catering and cake","category":"catering","priority":"medium"},
    {"weeks":"2 weeks out","task":"Order decorations and party supplies","category":"decor","priority":"medium"},
    {"weeks":"1 week out","task":"Confirm all vendors and RSVPs","category":"logistics","priority":"high"},
    {"weeks":"Day before","task":"Set up venue and prep day-of bag","category":"prep","priority":"high"}
  ],
  "checklist": [
    {"item":"Book and confirm venue","category":"venue","done":false},
    {"item":"Create and send invitations","category":"invitations","done":false},
    {"item":"Finalize catering menu","category":"food","done":false},
    {"item":"Order custom cake or desserts","category":"food","done":false},
    {"item":"Arrange decorations and theme items","category":"decor","done":false},
    {"item":"Book photographer or videographer","category":"photos","done":false},
    {"item":"Create party playlist","category":"music","done":false},
    {"item":"Plan entertainment or activities","category":"entertainment","done":false},
    {"item":"Arrange transportation if needed","category":"logistics","done":false},
    {"item":"Prepare welcome bags or party favors","category":"extras","done":false}
  ],
  "budget": {
    "total": "${budget || '$2,000'}",
    "breakdown": [
      {"category":"Venue","amount":450,"percentage":22,"color":"#2D4059"},
      {"category":"Catering","amount":400,"percentage":20,"color":"#E8896A"},
      {"category":"Decor","amount":250,"percentage":13,"color":"#4AADA8"},
      {"category":"Entertainment","amount":300,"percentage":15,"color":"#7B5EA7"},
      {"category":"Photography","amount":250,"percentage":13,"color":"#3D8C6E"},
      {"category":"Cake","amount":150,"percentage":7,"color":"#F7C948"},
      {"category":"Misc","amount":200,"percentage":10,"color":"#C4A882"}
    ]
  },
  "tips": [
    "Tip 1 specific to this party type",
    "Tip 2 specific to this theme",
    "Tip 3 for this guest count"
  ],
  "moodboard": {
    "palette": ["#F7C948","#E8896A","#4AADA8","#2D4059"],
    "keywords": ["keyword1","keyword2","keyword3","keyword4","keyword5"],
    "vibe": "2-sentence description of the aesthetic and atmosphere",
    "decorIdeas": ["idea1","idea2","idea3","idea4"],
    "tablescape": "Ideal tablescape description",
    "lighting": "Lighting recommendation",
    "musicGenre": "Music/playlist recommendation"
  }
}

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
