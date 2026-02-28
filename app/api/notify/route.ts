import { NextRequest, NextResponse } from 'next/server'
import { sendBatchEmails } from '@/lib/email'
import { eventUpdateEmail } from '@/lib/email-templates'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { guests, eventName, changes, eventDate, eventLocation, eventTheme, hostName } = body

        if (!guests || !Array.isArray(guests) || guests.length === 0) {
            return NextResponse.json({ error: 'No guests to notify' }, { status: 400 })
        }

        if (!changes || changes.length === 0) {
            return NextResponse.json({ error: 'No changes to notify about' }, { status: 400 })
        }

        // Filter guests that have valid emails
        const validGuests = guests.filter(
            (g: { name: string; email: string }) => g.email && g.email.includes('@')
        )

        if (validGuests.length === 0) {
            return NextResponse.json({ error: 'No guests with valid emails' }, { status: 400 })
        }

        // Format date nicely
        const formattedDate = eventDate
            ? new Date(eventDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
            })
            : 'TBD'

        // Send via centralized email system
        const result = await sendBatchEmails({
            type: 'notifications',
            recipients: validGuests.map((g: { name: string; email: string }) => ({ name: g.name, email: g.email })),
            subjectFn: () => `📋 Update: ${eventName || 'Your Event'} details have changed`,
            htmlFn: (guestName: string) => eventUpdateEmail({
                guestName,
                hostName: hostName || 'Your Host',
                eventName: eventName || 'Your Event',
                changes,
                eventDate: formattedDate,
                eventLocation: eventLocation || 'TBD',
                eventTheme: eventTheme || '',
            }),
        })

        return NextResponse.json({
            success: true,
            sent: result.sent,
            failed: result.failed,
            total: result.total,
            message: `Notifications sent to ${result.sent} guest${result.sent !== 1 ? 's' : ''}${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
        })

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Notification error:', msg)
        return NextResponse.json({ error: 'Failed to send notifications', details: msg }, { status: 500 })
    }
}
