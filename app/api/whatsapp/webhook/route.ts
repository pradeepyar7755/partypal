import { NextRequest, NextResponse } from 'next/server'
import { parseWebhookPayload, validateSignature, markAsRead } from '@/lib/whatsapp'
import { handleIncomingMessage } from '@/lib/whatsapp-engine'

// ── GET: Webhook Verification ─────────────────────────
// Meta sends a GET request to verify the webhook URL.
// We validate the verify_token and return the challenge.

export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

    if (mode === 'subscribe' && token === verifyToken) {
        console.log('[WhatsApp Webhook] Verified successfully')
        return new NextResponse(challenge, { status: 200 })
    }

    console.warn('[WhatsApp Webhook] Verification failed — token mismatch')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ── POST: Incoming Messages & Status Updates ──────────
// Meta sends POST requests for incoming messages,
// delivery statuses, and read receipts.

export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text()

        console.log('[WhatsApp Webhook] POST received, body length:', rawBody.length)

        // Validate signature (skip in dev for easier testing)
        if (process.env.NODE_ENV === 'production') {
            const signature = req.headers.get('x-hub-signature-256') || ''
            if (!validateSignature(rawBody, signature)) {
                console.warn('[WhatsApp Webhook] Invalid signature')
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
            }
        }

        const body = JSON.parse(rawBody) as Record<string, unknown>
        const messages = parseWebhookPayload(body)

        console.log(`[WhatsApp Webhook] Parsed ${messages.length} message(s)`)

        if (messages.length === 0) {
            // Status update or other non-message webhook — acknowledge
            return NextResponse.json({ status: 'ok' })
        }

        // Process each message — MUST await on Vercel serverless
        // (function terminates after response, so fire-and-forget won't work)
        for (const msg of messages) {
            console.log(`[WhatsApp Webhook] Processing: from=${msg.from}, type=${msg.type}, text=${msg.text?.slice(0, 50)}`)

            // Mark as read
            markAsRead(msg.messageId).catch(() => {})

            // Process message — await to ensure it completes
            try {
                await handleIncomingMessage(msg)
            } catch (err) {
                console.error('[WhatsApp Webhook] Handler error:', err)
            }
        }

        return NextResponse.json({ status: 'ok' })
    } catch (error) {
        console.error('[WhatsApp Webhook] Error:', error)
        // Always return 200 to prevent Meta from retrying
        return NextResponse.json({ status: 'error' }, { status: 200 })
    }
}
