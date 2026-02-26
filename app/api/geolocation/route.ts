import { NextRequest, NextResponse } from 'next/server'

// Get user's location from IP address using free ipapi.co service
export async function GET(request: NextRequest) {
    try {
        // Get client IP from headers (Vercel/proxy sets these)
        const forwarded = request.headers.get('x-forwarded-for')
        const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || ''

        // Use ipapi.co for free IP geolocation (no API key needed, 1000 req/day)
        const url = ip && ip !== '127.0.0.1' && ip !== '::1'
            ? `https://ipapi.co/${ip}/json/`
            : 'https://ipapi.co/json/' // Uses requester's IP

        const res = await fetch(url, {
            headers: { 'User-Agent': 'PartyPal/1.0' },
        })

        if (!res.ok) throw new Error(`ipapi error: ${res.status}`)

        const data = await res.json()

        if (data.error) throw new Error(data.reason || 'IP lookup failed')

        return NextResponse.json({
            city: data.city || '',
            region: data.region || '',
            country: data.country_name || '',
            lat: data.latitude || 0,
            lng: data.longitude || 0,
            label: [data.city, data.region].filter(Boolean).join(', ') || 'Unknown',
        })
    } catch (error) {
        console.error('Geolocation error:', error)
        // Default fallback
        return NextResponse.json({
            city: 'Atlanta',
            region: 'Georgia',
            country: 'United States',
            lat: 33.749,
            lng: -84.388,
            label: 'Atlanta, GA',
        })
    }
}
