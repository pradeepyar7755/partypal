import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { category, location, theme, budget, guests } = await req.json()

    const prompt = `You are PartyPal's vendor recommendation engine. Generate realistic vendor listings.

Category: ${category || 'All'} | Location: ${location || 'Atlanta, GA'} | Theme: ${theme || 'General'} | Budget: ${budget || 'Flexible'} | Guests: ${guests || '30'}

Return ONLY valid JSON, no markdown:
{
  "vendors": [
    {
      "id": "v1",
      "name": "Vendor Name",
      "category": "${category || 'Venue'}",
      "location": "Neighborhood, ${location || 'Atlanta, GA'}",
      "rating": 4.8,
      "reviews": 124,
      "price": "$400",
      "priceLabel": "starting price",
      "matchScore": 96,
      "description": "2-sentence compelling description",
      "tags": ["tag1","tag2","tag3"],
      "badge": "Top Rated",
      "emoji": "🏛️",
      "featured": true
    }
  ]
}

Generate 6 vendors. Make names, neighborhoods, prices, and descriptions realistic for ${location || 'Atlanta, GA'}. Match scores should be 78-98. Badges: "Top Rated", "New", "Popular", or none. Emojis: venue=🏛️, decor=🎀, baker=🎂, food=🍽️, photos=📷, music=🎵, drinks=🥂, entertain=🤹, guests=💌. Only the first vendor should have featured:true.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Bad response')
    const cleaned = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const data = JSON.parse(cleaned)
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Vendors error:', error)
    return NextResponse.json({ error: 'Failed to load vendors' }, { status: 500 })
  }
}
