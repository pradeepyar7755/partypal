import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_MAPS_API_KEY || '')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, eventDetails, guestList } = body

    let prompt = ''

    if (action === 'generate_invite') {
      prompt = `Write a warm, exciting party invitation message for:
Event: ${eventDetails?.eventType || 'Birthday Party'}
Theme: ${eventDetails?.theme || 'Celebration'}
Invitation Style: ${eventDetails?.inviteTheme || 'Modern & Fun'}
Date: ${eventDetails?.date || 'TBD'}
Location: ${eventDetails?.location || 'TBD'}
Host: ${eventDetails?.hostName || 'Your Host'}

Return ONLY valid JSON:
{
  "subject": "Email subject line",
  "message": "Full invitation message (2-3 paragraphs, warm and exciting, matching the invitation style)",
  "rsvpDeadline": "Suggested RSVP deadline",
  "smsVersion": "Short 160-char SMS version"
}`
    } else if (action === 'refine_invite') {
      prompt = `You are refining a party invitation based on user feedback.

Current invitation:
Subject: ${body.currentSubject || ''}
Message: ${body.currentMessage || ''}

User's request: "${body.instruction || 'Make it better'}"

Return ONLY valid JSON with the refined invitation:
{
  "subject": "Refined email subject line",
  "message": "Refined full invitation message incorporating the user's feedback",
  "smsVersion": "Updated short 160-char SMS version"
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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return NextResponse.json(parsed)
  } catch (error: unknown) {
    console.error('Guests error:', error)
    return NextResponse.json({ error: 'Failed to process guests request' }, { status: 500 })
  }
}
