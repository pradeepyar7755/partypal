import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { eventType, date, guests, location, theme, budget } = await req.json()
    if (!eventType || !guests || !location) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const prompt = `You are PartyPal, an expert party planner AI. Generate a comprehensive party plan.

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

Make ALL content specific to the actual event details provided. Adjust budget percentages to make sense for the event type.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')
    const cleaned = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const plan = JSON.parse(cleaned)
    return NextResponse.json({ plan, eventType, guests, location, theme, date, budget })
  } catch (error: unknown) {
    console.error('Plan error:', error)
    const msg = error instanceof Error ? error.message : 'Failed to generate plan'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
