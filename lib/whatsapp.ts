// ═══════════════════════════════════════════════════════
//  WhatsApp Cloud API Client
//  Handles sending messages, interactive elements,
//  and templates via the Meta Cloud API.
// ═══════════════════════════════════════════════════════

const WHATSAPP_API = 'https://graph.facebook.com/v21.0'
const PHONE_ID = process.env.WHATSAPP_PHONE_ID || ''
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || ''

interface WhatsAppButton {
    id: string
    title: string
}

interface WhatsAppListSection {
    title: string
    rows: { id: string; title: string; description?: string }[]
}

interface WhatsAppTemplateParam {
    type: 'text' | 'image'
    text?: string
    image?: { link: string }
}

// ── Core API Call ─────────────────────────────────────

async function callWhatsAppAPI(endpoint: string, body: object): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await fetch(`${WHATSAPP_API}/${PHONE_ID}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            console.error('[WhatsApp API]', res.status, JSON.stringify(err))
            return { success: false, error: err?.error?.message || `HTTP ${res.status}` }
        }

        return { success: true }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('[WhatsApp API] Network error:', msg)
        return { success: false, error: msg }
    }
}

// ── Send Text Message ─────────────────────────────────

export async function sendTextMessage(to: string, text: string) {
    return callWhatsAppAPI('messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: true, body: text },
    })
}

// ── Send Interactive Buttons ──────────────────────────

export async function sendButtons(to: string, body: string, buttons: WhatsAppButton[], header?: string, footer?: string) {
    return callWhatsAppAPI('messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
            type: 'button',
            ...(header ? { header: { type: 'text', text: header } } : {}),
            body: { text: body },
            ...(footer ? { footer: { text: footer } } : {}),
            action: {
                buttons: buttons.slice(0, 3).map(b => ({
                    type: 'reply',
                    reply: { id: b.id, title: b.title.slice(0, 20) },
                })),
            },
        },
    })
}

// ── Send Interactive List ─────────────────────────────

export async function sendList(to: string, body: string, buttonText: string, sections: WhatsAppListSection[], header?: string, footer?: string) {
    return callWhatsAppAPI('messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
            type: 'list',
            ...(header ? { header: { type: 'text', text: header } } : {}),
            body: { text: body },
            ...(footer ? { footer: { text: footer } } : {}),
            action: {
                button: buttonText.slice(0, 20),
                sections: sections.map(s => ({
                    title: s.title.slice(0, 24),
                    rows: s.rows.slice(0, 10).map(r => ({
                        id: r.id,
                        title: r.title.slice(0, 24),
                        ...(r.description ? { description: r.description.slice(0, 72) } : {}),
                    })),
                })),
            },
        },
    })
}

// ── Send Template Message ─────────────────────────────
// Used for proactive messages (RSVP invites, reminders)
// Templates must be pre-approved in Meta Business Manager

export async function sendTemplate(to: string, templateName: string, languageCode: string, params?: WhatsAppTemplateParam[]) {
    return callWhatsAppAPI('messages', {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
            name: templateName,
            language: { code: languageCode },
            ...(params ? {
                components: [{
                    type: 'body',
                    parameters: params,
                }],
            } : {}),
        },
    })
}

// ── Mark Message as Read ──────────────────────────────

export async function markAsRead(messageId: string) {
    return callWhatsAppAPI('messages', {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
    })
}

// ── Validate Webhook Signature ────────────────────────

export function validateSignature(payload: string, signature: string): boolean {
    const appSecret = process.env.WHATSAPP_APP_SECRET
    if (!appSecret) return false

    try {
        // Use Web Crypto API (available in Edge Runtime / Node 18+)
        const crypto = require('crypto')
        const expectedSig = crypto
            .createHmac('sha256', appSecret)
            .update(payload)
            .digest('hex')
        return `sha256=${expectedSig}` === signature
    } catch {
        console.error('[WhatsApp] Signature validation error')
        return false
    }
}

// ── Parse Incoming Webhook Payload ────────────────────

export interface IncomingMessage {
    from: string           // sender phone number
    messageId: string      // message ID for read receipts
    timestamp: string
    type: 'text' | 'button' | 'list' | 'image' | 'unknown'
    text?: string          // text body or button/list selection
    buttonId?: string      // button reply ID
    listId?: string        // list selection ID
    isGroup: boolean
    groupId?: string
}

export function parseWebhookPayload(body: Record<string, unknown>): IncomingMessage[] {
    const messages: IncomingMessage[] = []

    try {
        const entry = body.entry as { changes: { value: Record<string, unknown> }[] }[] | undefined
        if (!entry) return messages

        for (const e of entry) {
            for (const change of e.changes) {
                const value = change.value as Record<string, unknown>
                const msgArray = value.messages as Record<string, unknown>[] | undefined
                if (!msgArray) continue

                for (const msg of msgArray) {
                    const parsed: IncomingMessage = {
                        from: String(msg.from || ''),
                        messageId: String(msg.id || ''),
                        timestamp: String(msg.timestamp || ''),
                        type: 'unknown',
                        isGroup: false,
                    }

                    // Check if group message
                    if (msg.group_id) {
                        parsed.isGroup = true
                        parsed.groupId = String(msg.group_id)
                    }

                    const msgType = String(msg.type || '')

                    if (msgType === 'text') {
                        parsed.type = 'text'
                        parsed.text = String((msg.text as Record<string, unknown>)?.body || '')
                    } else if (msgType === 'interactive') {
                        const interactive = msg.interactive as Record<string, unknown>
                        const interactiveType = String(interactive?.type || '')

                        if (interactiveType === 'button_reply') {
                            parsed.type = 'button'
                            const reply = interactive?.button_reply as Record<string, unknown>
                            parsed.buttonId = String(reply?.id || '')
                            parsed.text = String(reply?.title || '')
                        } else if (interactiveType === 'list_reply') {
                            parsed.type = 'list'
                            const reply = interactive?.list_reply as Record<string, unknown>
                            parsed.listId = String(reply?.id || '')
                            parsed.text = String(reply?.title || '')
                        }
                    } else if (msgType === 'image') {
                        parsed.type = 'image'
                    }

                    if (parsed.from) messages.push(parsed)
                }
            }
        }
    } catch (err) {
        console.error('[WhatsApp] Parse error:', err)
    }

    return messages
}
