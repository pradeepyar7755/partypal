import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'PartyPal — AI Party Planner',
    description: 'Plan the perfect party with AI. Venues, vendors, guests, budget tracking, and more — all in one place.',
    openGraph: {
        title: 'PartyPal — AI Party Planner',
        description: 'From venue to entertainment, plan memorable celebrations with AI.',
        images: [
            {
                url: '/RSVP_Thumbnail.png?v=2',
                width: 1200,
                height: 630,
                alt: 'PartyPal RSVP',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'PartyPal — AI Party Planner',
        description: 'From venue to entertainment, plan memorable celebrations with AI.',
        images: ['/RSVP_Thumbnail.png?v=2'],
    },
}

export default function RSVPLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
