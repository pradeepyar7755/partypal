import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { assembleContext, hasContext } from '@/lib/ai-context-server'
import { checkRateLimit, logApiCall } from '@/lib/rate-limiter'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: NextRequest) {
    try {
        const identifier = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'anonymous'
        const rateCheck = await checkRateLimit(identifier, 'invitation_design')
        if (!rateCheck.allowed) {
            return NextResponse.json({
                error: `Daily AI limit reached (${rateCheck.limit} requests/day). Try again tomorrow.`,
                rateLimit: rateCheck,
            }, { status: 429 })
        }

        const body = await req.json()
        const { theme, eventType, eventName, date, location, hostName, action, currentDesigns, instruction } = body

        const contextBlock = hasContext(body) ? `\n${assembleContext(body, 'invitation card design')}\nUse this context to align invitation designs with the user's event vision.\n\n` : ''

        let prompt: string

        if (action === 'refine' && currentDesigns && instruction) {
            prompt = `${contextBlock}You are refining party invitation card designs based on user feedback.

Current designs: ${JSON.stringify(currentDesigns)}

User's request: "${instruction}"

Modify the designs according to the user's feedback. Keep the same JSON structure and return exactly 4 designs.
Return ONLY valid JSON array, no markdown.`
        } else {
            prompt = `${contextBlock}You are PartyPal's invitation card designer. Create 4 distinct invitation card designs.

Theme: ${theme || 'Modern Elegant'} | Event: ${eventType || 'Party'}
${eventName ? `Event Name: ${eventName}` : ''}
${date ? `Date: ${date}` : ''}
${location ? `Location: ${location}` : ''}
${hostName ? `Host: ${hostName}` : ''}

Each design should have a unique aesthetic personality — one elegant, one playful, one minimal, one bold.
The designs will be rendered as CSS/HTML cards, so all values must be CSS-compatible.

CROSS-PORTAL INTELLIGENCE:
- If moodboard palette is provided, at least 2 designs should incorporate those colors
- If user preference is "formal", lean toward serif fonts and refined designs
- If user preference is "casual" or "playful", use sans-serif or display fonts
- If event has children (from guest context), include one family-friendly design

IMPORTANT RULES FOR TEXT CONTENT:
- headerText should be the invitation headline (e.g., "You're Invited!", "Join the Celebration")
- bodyText should be 2-3 sentences of invitation copy personalized to the event
- footerText should be a warm closing line
- Do NOT include specific dates, times, or addresses in the card text — those are shown separately on the RSVP page
${eventName ? `- Reference the event name "${eventName}" naturally in at least 2 designs` : ''}

Return ONLY valid JSON array (exactly 4 designs), no markdown:
[
  {
    "id": "design_1",
    "name": "Design Name Here",
    "layout": "centered",
    "backgroundColor": "#FFFFFF",
    "backgroundGradient": "linear-gradient(135deg, #fef9ef 0%, #fff5e6 100%)",
    "accentColor": "#E8896A",
    "textColor": "#4a5568",
    "headingColor": "#2D4059",
    "fontFamily": "serif",
    "decorativeMotif": "floral-corners",
    "motifEmoji": "🌿",
    "headerText": "You're Invited!",
    "bodyText": "Join us for an unforgettable celebration filled with joy and wonderful memories.",
    "footerText": "We can't wait to see you there!",
    "borderStyle": "thin",
    "borderRadius": 16
  }
]

Layout options: "centered", "left-aligned", "split", "minimal"
Font options: "serif", "sans-serif", "script", "display"
Border options: "none", "thin", "double", "decorative"
Motif options: "floral-corners", "geometric-border", "watercolor-wash", "minimal-line", "confetti", "stars"

Make each design distinct and deeply themed.`
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { thinkingConfig: { thinkingBudget: 0 } } })
        const result = await model.generateContent(prompt)
        const text = result.response.text()
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const designs = JSON.parse(cleaned)

        logApiCall('invitation_design', 'gemini', identifier)
        return NextResponse.json({ designs: Array.isArray(designs) ? designs : [designs] })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Invitation design error:', msg)
        return NextResponse.json({ error: 'Failed to generate invitation designs', details: msg }, { status: 500 })
    }
}
