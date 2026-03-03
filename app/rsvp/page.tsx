import { Metadata } from 'next'
import { headers } from 'next/headers'
import RSVPClient from './RSVPClient'
import { getDb } from '@/lib/firebase'

export const dynamic = 'force-dynamic'

interface PageProps {
    searchParams: { e?: string, n?: string, event?: string, d?: string, date?: string, l?: string, location?: string, t?: string, theme?: string }
}

async function getEventDataById(eventId: string) {
    try {
        const db = getDb()
        const doc = await db.collection('events').doc(eventId).get()
        if (!doc.exists) return null

        const data = doc.data()!
        return {
            eventId: doc.id,
            eventType: data.eventType || 'Party',
            date: data.date || '',
            time: data.time || '',
            timezone: data.timezone || '',
            location: data.location || '',
            theme: data.theme || '',
            hostName: data.hostName || '',
            rsvpBy: data.rsvpBy || '',
            invite: data.invite || null,
            coverPhoto: data.invite?.coverPhoto || '',
            customImage: data.invite?.customImage || '',
        }
    } catch (error: any) {
        console.error('getEventDataById error:', error)
        return { error: error.message || 'Unknown error' } as any
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

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
    const eventId = searchParams.e || searchParams.event
    if (!eventId) {
        return {
            title: 'RSVP — PartyPal',
            description: 'RSVP to an upcoming event.',
        }
    }

    const data = await getEventDataById(eventId)

    if (!data || data.error) {
        return {
            title: 'RSVP — PartyPal',
            description: 'RSVP to an upcoming event.',
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
        } catch { }
    }
    if (data.hostName) parts.push(`Hosted by ${data.hostName}`)

    const description = parts.length > 0
        ? `You're invited! ${parts.join(' · ')}`
        : `You're invited to ${eventName}! Tap to RSVP.`

    // Build OG image URL
    const headersList = headers()
    const host = headersList.get('host') || process.env.VERCEL_URL || 'partypal.social'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}`

    const ogParams = new URLSearchParams()
    ogParams.set('title', eventName)
    if (eventEmoji) ogParams.set('emoji', eventEmoji)
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

import { Suspense } from 'react'

export default function RSVPPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa' }}>Loading...</div>}>
            <RSVPClient />
        </Suspense>
    )
}
