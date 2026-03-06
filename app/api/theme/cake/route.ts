import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { assembleContext, hasContext } from '@/lib/ai-context-server'
import { checkRateLimit, logApiCall } from '@/lib/rate-limiter'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: NextRequest) {
    try {
        const identifier = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'anonymous'
        const rateCheck = await checkRateLimit(identifier, 'cake_design')
        if (!rateCheck.allowed) {
            return NextResponse.json({
                error: `Daily AI limit reached (${rateCheck.limit} requests/day). Try again tomorrow.`,
                rateLimit: rateCheck,
            }, { status: 429 })
        }

        const body = await req.json()
        const { theme, eventType, guests, budget, action, currentConcepts, instruction } = body

        const contextBlock = hasContext(body) ? `\n${assembleContext(body, 'cake design')}\nUse this context to create cake concepts that fit the event vision.\n\n` : ''

        let prompt: string

        if (action === 'refine' && currentConcepts && instruction) {
            prompt = `${contextBlock}You are refining cake concepts based on user feedback.

Current cake concepts: ${JSON.stringify(currentConcepts)}

User's request: "${instruction}"

Modify the concepts according to the user's feedback. Keep the same JSON structure and return exactly 5 concepts.
Return ONLY valid JSON array, no markdown.`
        } else {
            prompt = `${contextBlock}You are PartyPal's cake designer AI. Design 5 unique cake concepts.

Theme: ${theme || 'Celebration'} | Event: ${eventType || 'Party'}
Guest Count: ${guests || '20-30'} | Budget: ${budget || 'Flexible'}

CROSS-PORTAL INTELLIGENCE:
- If guest dietary data shows restrictions, note which concepts can accommodate them
  (e.g., "3 guests are gluten-free — this can be made GF with almond flour base (+$25)")
- If moodboard palette exists, align cake color accents with the decor palette
- Scale tier count and servings to match the guest count
- Price estimates should be realistic and respect the overall budget proportionally
- Each concept should have a distinct personality — elegant, whimsical, rustic, modern, classic

IMPORTANT:
- servings should match or exceed the guest count
- tiers should scale: 1-2 for <20 guests, 2-3 for 20-50, 3-4 for 50+
- flavors should be specific, not generic (e.g., "Madagascar Vanilla Bean" not just "Vanilla")
- estimatedPrice should be a range (e.g., "$180-$250")
- colorAccents should be 2-3 hex colors from or complementary to the theme

Return ONLY valid JSON array (exactly 5 concepts), no markdown:
[
  {
    "id": "cake_1",
    "name": "Concept Name",
    "style": "Brief style description (e.g., Buttercream with tropical fondant accents)",
    "tiers": 3,
    "servings": "40-50",
    "flavors": ["Coconut", "Passion Fruit", "Vanilla Bean"],
    "decorationStyle": "Hand-painted tropical leaves with edible gold leaf accents",
    "dietaryNotes": "Can be made gluten-free for 3 guests (+$25)",
    "estimatedPrice": "$180-$250",
    "emoji": "🌺",
    "colorAccents": ["#F7C948", "#4AADA8", "#E8896A"],
    "description": "A showstopping three-tier cake cascading with tropical blooms and golden shimmer."
  }
]

Make each concept deeply themed and unique.`
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
        const result = await model.generateContent(prompt)
        const text = result.response.text()
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const concepts = JSON.parse(cleaned)

        logApiCall('cake_design', 'gemini', identifier)
        return NextResponse.json({ concepts: Array.isArray(concepts) ? concepts : [concepts] })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Cake design error:', msg)
        return NextResponse.json({ error: 'Failed to generate cake concepts', details: msg }, { status: 500 })
    }
}
