import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { assembleContext, hasContext } from '@/lib/ai-context-server'
import { checkRateLimit, logApiCall } from '@/lib/rate-limiter'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: NextRequest) {
  try {
    // Rate limit check
    const identifier = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'anonymous'
    const rateCheck = await checkRateLimit(identifier, 'moodboard')
    if (!rateCheck.allowed) {
      return NextResponse.json({
        error: `Daily AI limit reached (${rateCheck.limit} requests/day). Try again tomorrow.`,
        rateLimit: rateCheck,
      }, { status: 429 })
    }

    const body = await req.json()
    const { theme, eventType, budget, action, currentBoard, pinnedTiles, instruction } = body

    // Build cross-portal context
    const contextBlock = hasContext(body) ? `\n${assembleContext(body, 'mood board design')}\nUse this context to align the mood board with the user's full vision.\n\n` : ''

    let prompt: string

    if (action === 'refine' && currentBoard && instruction) {
      // Refinement mode: modify existing moodboard based on user feedback
      prompt = `${contextBlock}You are refining a party mood board based on user feedback.

Current mood board: ${JSON.stringify(currentBoard)}
${pinnedTiles && pinnedTiles.length > 0 ? `Pinned tiles (user wants to KEEP these exactly as-is): ${JSON.stringify(pinnedTiles)}` : ''}

User's request: "${instruction}"

IMPORTANT:
- Keep all pinned tiles unchanged in the tiles array — same emoji, title, description, and category.
- Apply the user's requested changes to unpinned tiles and other board elements.
- Maintain the same JSON structure as the current board.
- Return 5 palette colors and 6 tiles total.

Return ONLY valid JSON, no markdown — same structure as the current board.`
    } else {
      // Generation mode: create fresh moodboard
      prompt = `${contextBlock}You are PartyPal's mood board designer. Create a rich visual inspiration board.

Theme: ${theme || 'Modern Elegant'} | Event: ${eventType || 'Birthday Party'} | Budget: ${budget || 'Flexible'}

CROSS-PORTAL INTELLIGENCE:
- If guest context indicates children, include family-friendly inspirations
- If vendor context shows shortlisted vendors, suggest decor that complements their style
- If user preference is "minimal", keep the board clean and restrained; if "detailed/lavish", go all out
- If budget is tight, suggest creative DIY alternatives alongside aspirational ideas
- If previous events are known, suggest something fresh and different

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
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const board = JSON.parse(cleaned)
    // Track API usage (fire-and-forget)
    logApiCall(action === 'refine' ? 'moodboard_refine' : 'moodboard', 'gemini', identifier)
    return NextResponse.json(board)
  } catch (error: unknown) {
    console.error('Moodboard error:', error)
    return NextResponse.json({ error: 'Failed to generate mood board' }, { status: 500 })
  }
}
