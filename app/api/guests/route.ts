import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { action, eventDetails, guestList } = await req.json()

    let prompt = ''

    if (action === 'generate_invite') {
      prompt = `Write a warm, exciting party invitation message for:
Event: ${eventDetails?.eventType || 'Birthday Party'}
Theme: ${eventDetails?.theme || 'Celebration'}
Date: ${eventDetails?.date || 'TBD'}
Location: ${eventDetails?.location || 'TBD'}
Host: ${eventDetails?.hostName || 'Your Host'}

Return ONLY valid JSON:
{
  "subject": "Email subject line",
  "message": "Full invitation message (2-3 paragraphs, warm and exciting)",
  "rsvpDeadline": "Suggested RSVP deadline",
  "shareableLink": "https://partypal.social/rsvp/ABC123",
  "smsVersion": "Short 160-char SMS version"
}`
    } else if (action === 'dietary_summary') {
      prompt = `Analyze this guest list and provide a catering brief:
Guests: ${JSON.stringify(guestList || [])}

Return ONLY valid JSON:
{
  "totalGuests": 0,
  "dietaryBreakdown": [
    {"type":"No restrictions","count":0,"percentage":0,"emoji":"🍽️"},
    {"type":"Vegetarian","count":0,"percentage":0,"emoji":"🥗"},
    {"type":"Vegan","count":0,"percentage":0,"emoji":"🌱"},
    {"type":"Gluten-Free","count":0,"percentage":0,"emoji":"🌾"},
    {"type":"Nut Allergy","count":0,"percentage":0,"emoji":"⚠️"}
  ],
  "cateringNotes": "2-sentence brief for the caterer",
  "menuSuggestions": ["suggestion1","suggestion2","suggestion3"]
}`
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Bad response')
    const cleaned = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(cleaned)
    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Guests error:', error)
    return NextResponse.json({ error: 'Failed to process guests request' }, { status: 500 })
  }
}
