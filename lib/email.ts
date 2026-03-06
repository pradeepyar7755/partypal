import { Resend } from 'resend'
import { SITE_EMAILS } from '@/lib/constants'

// ═══════════════════════════════════════════════════════
//  PartyPal Email Configuration
//  Professional email system like Evite
// ═══════════════════════════════════════════════════════

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const DOMAIN = 'partypal.social'

// Initialize Resend client
export const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

// ── Sender Addresses ──────────────────────────────────
// Each address serves a specific purpose for deliverability & trust
export const SENDERS = {
    /** Party invitations & RSVP links */
    invites: `PartyPal Invites <invites@${DOMAIN}>`,
    /** Event updates, changes, reminders */
    notifications: `PartyPal <notifications@${DOMAIN}>`,
    /** RSVP confirmations sent to guests */
    rsvp: `PartyPal RSVP <rsvp@${DOMAIN}>`,
    /** Welcome & onboarding emails */
    welcome: `PartyPal <welcome@${DOMAIN}>`,
    /** Help & support responses */
    support: `PartyPal Support <support@${DOMAIN}>`,
    /** System/transactional emails */
    noreply: `PartyPal <noreply@${DOMAIN}>`,
    /** Marketing, newsletters, feature updates */
    marketing: `PartyPal <${SITE_EMAILS.marketing}>`,
    /** Sales and enterprise inquiries */
    sales: `PartyPal Sales <${SITE_EMAILS.sales}>`,
    /** User feedback and bug reports */
    feedback: `PartyPal Feedback <${SITE_EMAILS.feedback}>`,
    /** Job applications and careers */
    jobs: `PartyPal Careers <${SITE_EMAILS.jobs}>`,
} as const

// Fallback sender when domain isn't verified yet
const FALLBACK_SENDER = 'PartyPal <onboarding@resend.dev>'

// ── Email Types ───────────────────────────────────────
export type EmailType = keyof typeof SENDERS

// ── Core Send Function ────────────────────────────────
export async function sendEmail(params: {
    type: EmailType
    to: string | string[]
    subject: string
    html: string
    replyTo?: string
    tags?: { name: string; value: string }[]
}): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!resend) {
        console.log(`[Email Preview] Would send "${params.subject}" to ${Array.isArray(params.to) ? params.to.join(', ') : params.to}`)
        return { success: false, error: 'RESEND_API_KEY not configured' }
    }

    try {
        const from = SENDERS[params.type] || SENDERS.noreply
        const result = await resend.emails.send({
            from,
            to: Array.isArray(params.to) ? params.to : [params.to],
            subject: params.subject,
            html: params.html,
            replyTo: params.replyTo,
            tags: params.tags,
        })

        if (result.error) {
            // If domain not verified, fall back to resend.dev sender
            if (result.error.message?.includes('not verified') || result.error.message?.includes('not found')) {
                console.log(`[Email] Domain not verified, falling back to default sender`)
                const fallbackResult = await resend.emails.send({
                    from: FALLBACK_SENDER,
                    to: Array.isArray(params.to) ? params.to : [params.to],
                    subject: params.subject,
                    html: params.html,
                    replyTo: params.replyTo,
                })
                if (fallbackResult.error) {
                    return { success: false, error: fallbackResult.error.message }
                }
                return { success: true, id: fallbackResult.data?.id }
            }
            return { success: false, error: result.error.message }
        }

        return { success: true, id: result.data?.id }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[Email Error]`, msg)
        return { success: false, error: msg }
    }
}

// ── Batch Send (for notifying multiple guests) ────────
export async function sendBatchEmails(params: {
    type: EmailType
    recipients: { email: string; name: string }[]
    subjectFn: (name: string) => string
    htmlFn: (name: string) => string
    replyTo?: string
}): Promise<{ sent: number; failed: number; total: number; errors: string[] }> {
    const results = await Promise.allSettled(
        params.recipients.map(r =>
            sendEmail({
                type: params.type,
                to: r.email,
                subject: params.subjectFn(r.name),
                html: params.htmlFn(r.name),
                replyTo: params.replyTo,
            })
        )
    )

    const errors: string[] = []
    let sent = 0
    let failed = 0

    results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value.success) {
            sent++
        } else {
            failed++
            const err = r.status === 'rejected' ? String(r.reason) : (r.value as { error?: string }).error || 'Unknown error'
            errors.push(`${params.recipients[i].name}: ${err}`)
        }
    })

    return { sent, failed, total: params.recipients.length, errors }
}
