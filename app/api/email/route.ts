import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, sendBatchEmails } from '@/lib/email'
import {
    invitationEmail,
    rsvpConfirmationEmail,
    hostRsvpNotificationEmail,
    eventReminderEmail,
    welcomeEmail,
    postEventEmail,
    collaboratorInviteEmail,
    supportConfirmationEmail,
    marketingEmail,
    hostMessageEmail,
    accountDeletionEmail,
} from '@/lib/email-templates'
import { SITE_EMAILS } from '@/lib/constants'

// ═══════════════════════════════════════════════════════
//  /api/email — Unified Email API
//  Handles all email types for PartyPal
// ═══════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { action } = body

        switch (action) {

            // ── 1. Send Party Invitations ─────────────
            case 'send_invitations': {
                const { guests, hostName, eventName, eventDate, eventTime, eventLocation, eventTheme, inviteMessage, rsvpBaseLink, coverPhoto } = body

                if (!guests?.length) return NextResponse.json({ error: 'No guests' }, { status: 400 })

                const validGuests = guests.filter((g: { email: string }) => g.email?.includes('@'))

                const result = await sendBatchEmails({
                    type: 'invites',
                    recipients: validGuests,
                    subjectFn: () => `🎉 You're Invited: ${eventName}`,
                    htmlFn: (guestName: string) => invitationEmail({
                        guestName,
                        hostName: hostName || 'Your Host',
                        eventName,
                        eventDate,
                        eventTime,
                        eventLocation,
                        eventTheme,
                        inviteMessage,
                        rsvpLink: rsvpBaseLink || `https://${SITE_EMAILS.systemDomain}`,
                        coverPhoto,
                    }),
                })

                return NextResponse.json({
                    success: true,
                    ...result,
                    message: `Invitations sent to ${result.sent} guest${result.sent !== 1 ? 's' : ''}`,
                })
            }

            // ── 2. RSVP Confirmation (to guest) ───────
            case 'rsvp_confirmation': {
                const { guestName, guestEmail, eventName, eventDate, eventTime, eventLocation, response, additionalGuests, rsvpLink } = body

                if (!guestEmail) return NextResponse.json({ error: 'No email' }, { status: 400 })

                const statusText = response === 'going' ? "You're going!" : response === 'maybe' ? "Tentatively going" : "We'll miss you"

                const result = await sendEmail({
                    type: 'rsvp',
                    to: guestEmail,
                    subject: `${response === 'going' ? '🎉' : response === 'maybe' ? '🤔' : '😢'} ${statusText} — ${eventName}`,
                    html: rsvpConfirmationEmail({
                        guestName,
                        eventName,
                        eventDate,
                        eventTime,
                        eventLocation,
                        response,
                        additionalGuests,
                        rsvpLink: rsvpLink || `https://${SITE_EMAILS.systemDomain}`,
                    }),
                })

                return NextResponse.json({ success: result.success, message: 'RSVP confirmation sent' })
            }

            // ── 3. Notify Host of RSVP ────────────────
            case 'host_rsvp_notification': {
                const { hostEmail, hostName, guestName, eventName, response, additionalGuests, dietary, totalGoing, totalGuests, dashboardLink } = body

                if (!hostEmail) return NextResponse.json({ error: 'No host email' }, { status: 400 })

                const result = await sendEmail({
                    type: 'notifications',
                    to: hostEmail,
                    subject: `📬 ${guestName} ${response === 'going' ? 'is going' : response === 'maybe' ? 'might come' : 'can\'t make it'} — ${eventName}`,
                    html: hostRsvpNotificationEmail({
                        hostName: hostName || 'Host',
                        guestName,
                        eventName,
                        response,
                        additionalGuests,
                        dietary,
                        totalGoing: totalGoing || 0,
                        totalGuests: totalGuests || 0,
                        dashboardLink: dashboardLink || `https://${SITE_EMAILS.systemDomain}/dashboard`,
                    }),
                })

                return NextResponse.json({ success: result.success, message: 'Host notified' })
            }

            // ── 4. Event Reminder ─────────────────────
            case 'send_reminder': {
                const { guests, eventName, eventDate, eventTime, eventLocation, eventTheme, daysUntil, rsvpBaseLink } = body

                if (!guests?.length) return NextResponse.json({ error: 'No guests' }, { status: 400 })

                const validGuests = guests.filter((g: { email: string }) => g.email?.includes('@'))

                const urgency = daysUntil <= 1 ? '🔥' : daysUntil <= 3 ? '⏰' : '📅'
                const timeText = daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`

                const result = await sendBatchEmails({
                    type: 'notifications',
                    recipients: validGuests,
                    subjectFn: () => `${urgency} Reminder: ${eventName} is ${timeText}!`,
                    htmlFn: (guestName: string) => eventReminderEmail({
                        guestName,
                        eventName,
                        eventDate,
                        eventTime,
                        eventLocation,
                        eventTheme,
                        daysUntil,
                        rsvpLink: rsvpBaseLink || `https://${SITE_EMAILS.systemDomain}`,
                    }),
                })

                return NextResponse.json({
                    success: true,
                    ...result,
                    message: `Reminders sent to ${result.sent} guest${result.sent !== 1 ? 's' : ''}`,
                })
            }

            // ── 5. Welcome Email ──────────────────────
            case 'welcome': {
                const { userName, userEmail } = body

                if (!userEmail) return NextResponse.json({ error: 'No email' }, { status: 400 })

                const result = await sendEmail({
                    type: 'welcome',
                    to: userEmail,
                    subject: '🎈 Welcome to Party Pal! Let\'s plan something amazing',
                    html: welcomeEmail({
                        userName: userName || 'Party Planner',
                        dashboardLink: `https://${SITE_EMAILS.systemDomain}/dashboard`,
                    }),
                })

                return NextResponse.json({ success: result.success, message: 'Welcome email sent' })
            }

            // ── 6. Post-Event Thank You ───────────────
            case 'post_event': {
                const { guests, hostName, eventName, eventDate, feedbackLink } = body

                if (!guests?.length) return NextResponse.json({ error: 'No guests' }, { status: 400 })

                const validGuests = guests.filter((g: { email: string; status?: string }) =>
                    g.email?.includes('@') && g.status !== 'declined'
                )

                const result = await sendBatchEmails({
                    type: 'notifications',
                    recipients: validGuests,
                    subjectFn: () => `🥳 Thanks for celebrating ${eventName}!`,
                    htmlFn: (guestName: string) => postEventEmail({
                        guestName,
                        hostName: hostName || 'Your Host',
                        eventName,
                        eventDate,
                        feedbackLink,
                    }),
                })

                return NextResponse.json({
                    success: true,
                    ...result,
                    message: `Thank you emails sent to ${result.sent} guest${result.sent !== 1 ? 's' : ''}`,
                })
            }

            // ── 7. Collaborator Invite ────────────────
            case 'collaborator_invite': {
                const { collaboratorEmail, collaboratorName, hostName, eventName, role, acceptLink } = body

                if (!collaboratorEmail) return NextResponse.json({ error: 'No email' }, { status: 400 })

                const result = await sendEmail({
                    type: 'invites',
                    to: collaboratorEmail,
                    subject: `🤝 ${hostName} invited you to co-plan ${eventName}`,
                    html: collaboratorInviteEmail({
                        collaboratorName: collaboratorName || 'Friend',
                        hostName: hostName || 'Your Friend',
                        eventName,
                        role: role || 'Viewer',
                        acceptLink: acceptLink || `https://${SITE_EMAILS.systemDomain}/collaborate`,
                    }),
                })

                return NextResponse.json({ success: result.success, message: 'Collaborator invite sent' })
            }

            // ── 8. Support Auto-Reply ─────────────────
            case 'support_confirmation': {
                const { userName, userEmail, ticketSubject } = body

                if (!userEmail) return NextResponse.json({ error: 'No email' }, { status: 400 })

                const ticketId = Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()

                const result = await sendEmail({
                    type: 'support',
                    to: userEmail,
                    subject: `💬 We received your message — ${ticketSubject}`,
                    html: supportConfirmationEmail({
                        userName: userName || 'there',
                        ticketSubject: ticketSubject || 'Support Request',
                        ticketId,
                    }),
                    replyTo: SITE_EMAILS.support,
                })

                return NextResponse.json({ success: result.success, ticketId, message: 'Support confirmation sent' })
            }

            // ── 9. Marketing / Newsletter ─────────────
            case 'marketing': {
                const { recipients, subject, headline, bodyText, ctaText, ctaLink, features } = body

                if (!recipients?.length) return NextResponse.json({ error: 'No recipients' }, { status: 400 })

                const result = await sendBatchEmails({
                    type: 'marketing',
                    recipients,
                    subjectFn: () => subject || '🎈 What\'s New at Party Pal',
                    htmlFn: (userName: string) => marketingEmail({
                        userName,
                        subject: subject || '',
                        headline: headline || 'What\'s New',
                        bodyText: bodyText || '',
                        ctaText: ctaText || 'Check it Out',
                        ctaLink: ctaLink || `https://${SITE_EMAILS.systemDomain}`,
                        features,
                    }),
                })

                return NextResponse.json({
                    success: true,
                    ...result,
                    message: `Newsletter sent to ${result.sent} recipient${result.sent !== 1 ? 's' : ''}`,
                })
            }

            // ── 10. Host Custom Message ──────────
            case 'custom_message': {
                const { guests, hostName, eventName, message, eventDate, eventTime, eventLocation, rsvpBaseLink, coverPhoto } = body

                if (!guests?.length) return NextResponse.json({ error: 'No guests' }, { status: 400 })
                if (!message?.trim()) return NextResponse.json({ error: 'No message' }, { status: 400 })

                const validGuests = guests.filter((g: { email: string }) => g.email?.includes('@'))

                const result = await sendBatchEmails({
                    type: 'notifications',
                    recipients: validGuests,
                    subjectFn: () => `💌 Message from ${hostName || 'your host'} — ${eventName}`,
                    htmlFn: (guestName: string) => hostMessageEmail({
                        guestName,
                        hostName: hostName || 'Your Host',
                        eventName,
                        message,
                        eventDate,
                        eventTime,
                        eventLocation,
                        rsvpLink: rsvpBaseLink || undefined,
                        coverPhoto,
                    }),
                })

                return NextResponse.json({
                    success: true,
                    ...result,
                    message: `Message sent to ${result.sent} guest${result.sent !== 1 ? 's' : ''}`,
                })
            }

            // ── 11. Account Deletion Confirmation ──
            case 'account_deletion': {
                const { userName, userEmail, eventsDeleted, tenureDays } = body

                if (!userEmail) return NextResponse.json({ error: 'No email' }, { status: 400 })

                const deletionDate = new Date().toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                })

                const result = await sendEmail({
                    type: 'noreply',
                    to: userEmail,
                    subject: '👋 Your Party Pal account has been deleted',
                    html: accountDeletionEmail({
                        userName: userName || 'there',
                        deletionDate,
                        eventsDeleted: eventsDeleted || 0,
                        tenureDays: tenureDays || 0,
                    }),
                })

                return NextResponse.json({ success: result.success, message: 'Deletion confirmation sent' })
            }

            default:
                return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
        }

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Email API error:', msg)
        return NextResponse.json({ error: 'Failed to process email request', details: msg }, { status: 500 })
    }
}
