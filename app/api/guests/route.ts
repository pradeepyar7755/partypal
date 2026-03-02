import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { assembleContext, hasContext } from '@/lib/ai-context-server'
import { checkRateLimit } from '@/lib/rate-limiter'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: NextRequest) {
  try {
    // Rate limit check
    const identifier = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'anonymous'
    const rateCheck = await checkRateLimit(identifier, 'guests')
    if (!rateCheck.allowed) {
      return NextResponse.json({
        error: `Daily AI limit reached (${rateCheck.limit} requests/day). Try again tomorrow.`,
        rateLimit: rateCheck,
      }, { status: 429 })
    }

    const body = await req.json()
    const { action, eventDetails, guestList, temperature } = body

    // Build cross-portal context
    const contextBlock = hasContext(body) ? `\n${assembleContext(body, action === 'generate_invite' ? 'invitation writing' : action === 'refine_invite' ? 'invitation refinement' : 'guest & catering analysis')}\nUse this intelligence to personalize your response.\n\n` : ''

    let prompt = ''

    if (action === 'generate_invite') {
      prompt = `${contextBlock}Write a warm, exciting party invitation message for:
Event: ${eventDetails?.eventType || 'Birthday Party'}
Theme: ${eventDetails?.theme || 'Celebration'}
Invitation Style: ${eventDetails?.inviteTheme || 'Modern & Fun'}
Host: ${eventDetails?.hostName || 'Your Host'}

IMPORTANT: Do NOT include the event date, time, or venue/location in the message body — those details are already displayed separately on the RSVP card. Focus purely on the excitement, vibe, and what to expect.

CROSS-PORTAL INTELLIGENCE:
- If user preferences indicate a tone preference (formal/casual/playful), match it
- If a moodboard vibe is provided, let the language mirror that aesthetic
- If guest context shows children attending, make the tone family-friendly
- Reference the theme naturally in the invitation text

Return ONLY valid JSON:
{
  "subject": "Email subject line",
  "message": "Full invitation message (2-3 paragraphs, warm and exciting, matching the invitation style. Do NOT mention date, time, or location.)",
  "smsVersion": "Short 160-char SMS version (no date/location either)"
}`
    } else if (action === 'refine_invite') {
      prompt = `${contextBlock}You are refining a party invitation based on user feedback.

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
      prompt = `${contextBlock}Analyze this guest list and provide a catering brief:
Guests: ${JSON.stringify(guestList || [])}

CROSS-PORTAL INTELLIGENCE:
- If budget context is provided, factor it into menu suggestions (high budget = premium options, tight budget = creative affordable ideas)
- If vendor context shows a caterer is already shortlisted, mention coordination tips
- If the event theme is known, suggest on-theme food/drink ideas

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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { temperature: temperature || 0.7 } })
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
