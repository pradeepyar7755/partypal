import { NextRequest, NextResponse } from 'next/server'
import { logApiCall } from '@/lib/rate-limiter'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || ''

// GET: Return API key (no query) or search autocomplete (with query)
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query) {
        return NextResponse.json({ apiKey: GOOGLE_MAPS_API_KEY })
    }

    // Use Google Places Autocomplete (New) REST API
    if (GOOGLE_MAPS_API_KEY) {
        try {
            const results = await searchGooglePlaces(query)
            // Track API usage (fire-and-forget)
            logApiCall('location', 'maps')
            return NextResponse.json({ results })
        } catch (error) {
            console.error('Google Places error:', error)
            // Fall through to fallback
        }
    }

    // Fallback: Nominatim
    return NextResponse.json({ results: await searchNominatim(query) })
}

// POST: Get place details (lat/lng) via Geocoding API (always enabled)
export async function POST(request: NextRequest) {
    const body = await request.json()
    const { placeId, address, latlng } = body

    if (!GOOGLE_MAPS_API_KEY) {
        return NextResponse.json({ error: 'Missing API key' }, { status: 400 })
    }

    try {
        // Use Geocoding API with place_id, address, or latlng (reverse geocode)
        const params = new URLSearchParams({ key: GOOGLE_MAPS_API_KEY })
        if (placeId) {
            params.set('place_id', placeId)
        } else if (latlng) {
            params.set('latlng', latlng)
        } else if (address) {
            params.set('address', address)
        } else {
            return NextResponse.json({ error: 'Missing placeId, address, or latlng' }, { status: 400 })
        }

        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`)
        const data = await res.json()

        if (data.status !== 'OK' || !data.results?.length) {
            console.error('Geocoding error:', data.status, data.error_message)
            return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 })
        }

        const result = data.results[0]
        let city = '', state = '', country = ''
        for (const comp of result.address_components || []) {
            if (comp.types.includes('locality')) city = comp.long_name
            if (comp.types.includes('sublocality_level_1') && !city) city = comp.long_name
            if (comp.types.includes('administrative_area_level_1')) state = comp.short_name
            if (comp.types.includes('country')) country = comp.long_name
        }

        // Track API usage (fire-and-forget)
        logApiCall('location', 'maps')

        return NextResponse.json({
            name: result.formatted_address?.split(',')[0] || '',
            address: result.formatted_address || '',
            lat: result.geometry?.location?.lat || 0,
            lng: result.geometry?.location?.lng || 0,
            city,
            state,
            country,
            types: result.types || [],
        })
    } catch (error) {
        console.error('Geocoding error:', error)
        return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 })
    }
}

// Google Places Autocomplete (New) — REST API
async function searchGooglePlaces(query: string) {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        },
        body: JSON.stringify({
            input: query,
            includedRegionCodes: ['us'],
            languageCode: 'en',
        }),
    })

    if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Places API error: ${res.status} - ${errText}`)
    }

    const data = await res.json()
    const suggestions = data.suggestions || []

    return suggestions.map((s: Record<string, unknown>) => {
        const prediction = s.placePrediction as Record<string, unknown> | undefined
        if (!prediction) return null

        const structuredFormat = prediction.structuredFormat as {
            mainText?: { text: string }
            secondaryText?: { text: string }
        } | undefined

        const types = (prediction.types as string[]) || []
        const { type, icon } = getTypeAndIcon(types)

        return {
            placeId: prediction.placeId as string || '',
            name: structuredFormat?.mainText?.text || '',
            secondary: structuredFormat?.secondaryText?.text || '',
            description: (prediction.text as { text?: string })?.text || '',
            type,
            icon,
            types,
        }
    }).filter(Boolean)
}

function getTypeAndIcon(types: string[]): { type: string; icon: string } {
    if (types.some(t => ['restaurant', 'bar', 'cafe', 'food', 'meal_delivery', 'night_club'].includes(t)))
        return { type: 'restaurant', icon: '🍽️' }
    if (types.some(t => ['lodging', 'hotel', 'resort_hotel'].includes(t)))
        return { type: 'hotel', icon: '🏨' }
    if (types.some(t => ['event_venue', 'convention_center', 'performing_arts_theater', 'movie_theater', 'community_center'].includes(t)))
        return { type: 'venue', icon: '🏛️' }
    if (types.some(t => ['stadium', 'gym', 'bowling_alley', 'amusement_park', 'sports_complex'].includes(t)))
        return { type: 'venue', icon: '🏟️' }
    if (types.some(t => ['park', 'campground', 'national_park'].includes(t)))
        return { type: 'park', icon: '🌳' }
    if (types.some(t => ['church', 'place_of_worship', 'synagogue', 'mosque', 'hindu_temple'].includes(t)))
        return { type: 'venue', icon: '⛪' }
    if (types.some(t => ['art_gallery', 'museum'].includes(t)))
        return { type: 'venue', icon: '🎨' }
    if (types.some(t => ['shopping_mall', 'store', 'supermarket'].includes(t)))
        return { type: 'business', icon: '🏪' }
    if (types.some(t => ['school', 'university', 'library'].includes(t)))
        return { type: 'venue', icon: '🏫' }
    if (types.some(t => ['establishment', 'point_of_interest'].includes(t)))
        return { type: 'venue', icon: '📍' }
    if (types.some(t => ['street_address', 'premise', 'subpremise', 'route'].includes(t)))
        return { type: 'address', icon: '🏠' }
    if (types.some(t => ['locality', 'sublocality'].includes(t)))
        return { type: 'city', icon: '🏙️' }
    if (types.some(t => ['postal_code'].includes(t)))
        return { type: 'zip code', icon: '📮' }
    if (types.some(t => ['administrative_area_level_1', 'administrative_area_level_2', 'country'].includes(t)))
        return { type: 'region', icon: '🌎' }
    if (types.some(t => ['neighborhood', 'sublocality_level_1'].includes(t)))
        return { type: 'neighborhood', icon: '🏘️' }
    return { type: 'place', icon: '📍' }
}

// Fallback: Nominatim
async function searchNominatim(query: string) {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'json')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('limit', '5')
    url.searchParams.set('countrycodes', 'us')

    const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'PartyPal/1.0 (partypal.social)', 'Accept-Language': 'en' },
    })
    const data = await res.json()
    return data.map((item: Record<string, unknown>) => ({
        placeId: String(item.place_id),
        name: String(item.name || String(item.display_name).split(',')[0]),
        secondary: String(item.display_name),
        description: String(item.display_name),
        lat: parseFloat(String(item.lat)),
        lng: parseFloat(String(item.lon)),
        type: 'place',
        icon: '📍',
    }))
}
