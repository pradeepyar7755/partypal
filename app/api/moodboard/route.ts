import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { theme, eventType, budget } = await req.json()

    const prompt = `You are PartyPal's mood board designer. Create a rich visual inspiration board.

Theme: ${theme || 'Modern Elegant'} | Event: ${eventType || 'Birthday Party'} | Budget: ${budget || 'Flexible'}

Return ONLY valid JSON, no markdown:
{
  "title": "Theme Name Mood Board",
  "vibe": "2-sentence evocative description of the overall atmosphere",
  "palette": [
    {"hex":"#F7C948","name":"Golden Sun","usage":"tablecloths, balloons"},
    {"hex":"#E8896A","name":"Coral Bliss","usage":"florals, napkins"},
    {"hex":"#4AADA8","name":"Teal Dream","usage":"accent pieces, candles"},
    {"hex":"#2D4059","name":"Midnight Navy","usage":"backdrop, linens"},
    {"hex":"#FFFFFF","name":"Crisp White","usage":"base, plates, signage"}
  ],
  "tiles": [
    {"emoji":"🌿","title":"Lush Greenery","description":"Cascading eucalyptus and ferns as centerpieces","category":"florals"},
    {"emoji":"🕯️","title":"Candlelight Magic","description":"Clusters of pillar and taper candles at varying heights","category":"lighting"},
    {"emoji":"🎂","title":"Statement Cake","description":"4-tier cake with hand-painted florals and gold leaf","category":"food"},
    {"emoji":"🎊","title":"Balloon Installation","description":"Organic balloon arch in palette colors at entrance","category":"decor"},
    {"emoji":"📸","title":"Photo Moment","description":"Floral wall backdrop with neon sign for guest photos","category":"photos"},
    {"emoji":"🎵","title":"Curated Playlist","description":"Upbeat mix of pop hits and ambient background tracks","category":"music"}
  ],
  "tablescape": "Detailed tablescape description matching the theme",
  "lighting": "Specific lighting setup recommendation",
  "welcomeSign": "Suggested welcome sign wording",
  "partyFavor": "Creative party favor idea matching the theme",
  "hashtag": "#PartyPalEvent"
}

Make everything deeply specific to the theme and event type provided.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Bad response')
    const cleaned = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const board = JSON.parse(cleaned)
    return NextResponse.json(board)
  } catch (error: unknown) {
    console.error('Moodboard error:', error)
    return NextResponse.json({ error: 'Failed to generate mood board' }, { status: 500 })
  }
}
