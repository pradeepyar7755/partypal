import { Metadata } from 'next'
import { headers } from 'next/headers'

interface JoinPageProps {
    params: { code: string }
}

async function getEventData(code: string) {
    const headersList = headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}`

    try {
        const res = await fetch(`${baseUrl}/api/join/${code}`, {
            cache: 'no-store',
        })
        if (!res.ok) return null
        return await res.json()
    } catch {
        return null
    }
}

function formatTime12h(t: string, tz?: string): string {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    const tzStr = tz ? ` ${tz}` : ''
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}${tzStr}`
}

export async function generateMetadata({ params }: JoinPageProps): Promise<Metadata> {
    const data = await getEventData(params.code)

    if (!data) {
        return {
            title: 'Event Not Found — PartyPal',
            description: 'This event invite could not be found.',
        }
    }

    const eventEmoji = data.eventType?.split(' ')[0] || '🎉'
    const eventName = data.eventType?.replace(/^[^\s]+\s/, '') || 'Party'
    const title = `${eventName} — Tap to RSVP`

    // Build description
    const parts: string[] = []
    if (data.date) {
        try {
            const formatted = new Date(data.date + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
            })
            parts.push(formatted)
        } catch {
            parts.push(data.date)
        }
    }
    if (data.time) {
        parts.push(formatTime12h(data.time, data.timezone))
    }
    if (data.location) parts.push(data.location)
    if (data.rsvpBy) {
        try {
            const rsvpDate = new Date(data.rsvpBy + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
            parts.push(`RSVP by ${rsvpDate}`)
        } catch {
            // skip
        }
    }
    if (data.hostName) parts.push(`Hosted by ${data.hostName}`)

    const description = parts.length > 0
        ? `You're invited! ${parts.join(' · ')}`
        : `You're invited to ${eventName}! Tap to RSVP.`

    // Build OG image URL
    const headersList = headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}`

    const ogParams = new URLSearchParams()
    ogParams.set('title', `${eventEmoji} ${eventName}`)
    if (data.date) ogParams.set('date', data.date)
    if (data.time) ogParams.set('time', formatTime12h(data.time, data.timezone))
    if (data.location) ogParams.set('location', data.location)
    if (data.hostName) ogParams.set('host', data.hostName)
    // Use cover photo if available (must be a proper URL, not a data: URI)
    if (data.coverPhoto && data.coverPhoto.startsWith('http')) {
        ogParams.set('image', data.coverPhoto)
    }

    const ogImageUrl = `${baseUrl}/api/og?${ogParams.toString()}`

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'website',
            images: [
                {
                    url: ogImageUrl,
                    width: 1200,
                    height: 630,
                    alt: eventName,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogImageUrl],
        },
    }
}

export default async function JoinPage({ params }: JoinPageProps) {
    const data = await getEventData(params.code)

    if (!data) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e9f0 100%)',
                fontFamily: "'Nunito', sans-serif",
            }}>
                <div style={{
                    textAlign: 'center',
                    padding: '3rem',
                    background: '#fff',
                    borderRadius: '20px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                    maxWidth: '400px',
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>😕</div>
                    <h1 style={{ fontFamily: "'Fredoka One', cursive", color: '#1a2535', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                        Invite Not Found
                    </h1>
                    <p style={{ color: '#6b7c93', fontWeight: 600 }}>
                        This invite link may have expired or the event may no longer exist.
                    </p>
                </div>
            </div>
        )
    }

    // Redirect to the branded interactive RSVP page
    const { redirect } = await import('next/navigation')
    redirect(`/rsvp?e=${data.eventId}`)
}
