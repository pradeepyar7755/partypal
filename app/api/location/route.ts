import { NextRequest, NextResponse } from 'next/server'

interface NominatimResult {
    place_id: number
    licence: string
    osm_type: string
    osm_id: number
    lat: string
    lon: string
    class: string
    type: string
    place_rank: number
    importance: number
    addresstype: string
    name: string
    display_name: string
    address: {
        amenity?: string
        building?: string
        house_number?: string
        road?: string
        neighbourhood?: string
        suburb?: string
        city?: string
        town?: string
        village?: string
        county?: string
        state?: string
        postcode?: string
        country?: string
        country_code?: string
    }
}

function getTypeAndIcon(result: NominatimResult): { type: string; icon: string } {
    const cls = result.class
    const typ = result.type
    const addrType = result.addresstype

    // Venues
    if (cls === 'amenity' || cls === 'leisure' || cls === 'tourism') {
        if (['restaurant', 'bar', 'pub', 'cafe', 'fast_food', 'food_court', 'nightclub', 'biergarten'].includes(typ)) {
            return { type: 'venue', icon: '🍽️' }
        }
        if (['theatre', 'cinema', 'arts_centre', 'community_centre', 'events_venue', 'conference_centre', 'exhibition_centre'].includes(typ)) {
            return { type: 'venue', icon: '🏛️' }
        }
        if (['park', 'garden', 'playground', 'recreation_ground', 'sports_centre', 'stadium', 'swimming_pool'].includes(typ)) {
            return { type: 'venue', icon: '🏟️' }
        }
        if (['hotel', 'guest_house', 'hostel', 'motel', 'resort'].includes(typ)) {
            return { type: 'venue', icon: '🏨' }
        }
        if (['place_of_worship', 'church', 'chapel'].includes(typ)) {
            return { type: 'venue', icon: '⛪' }
        }
        return { type: 'poi', icon: '📍' }
    }

    // Buildings
    if (cls === 'building') {
        return { type: 'venue', icon: '🏢' }
    }

    // Shops / commercial
    if (cls === 'shop') {
        return { type: 'poi', icon: '🏪' }
    }

    // Addresses
    if (addrType === 'house' || addrType === 'building' || addrType === 'road' || addrType === 'street') {
        return { type: 'address', icon: '🏠' }
    }

    // Places (cities, towns, etc)
    if (['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood', 'municipality'].includes(addrType)) {
        return { type: 'city', icon: '🏙️' }
    }
    if (['county', 'state', 'region', 'country'].includes(addrType)) {
        return { type: 'city', icon: '🌎' }
    }

    return { type: 'address', icon: '📍' }
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
        return NextResponse.json({ results: [] })
    }

    try {
        // Use Nominatim (OpenStreetMap) - free, no API key required
        // Supports: cities, addresses, venues, businesses, POIs
        const url = new URL('https://nominatim.openstreetmap.org/search')
        url.searchParams.set('q', query)
        url.searchParams.set('format', 'json')
        url.searchParams.set('addressdetails', '1')
        url.searchParams.set('limit', '8')
        url.searchParams.set('countrycodes', 'us')       // Focus on US results
        url.searchParams.set('dedupe', '1')
        url.searchParams.set('namedetails', '1')

        const response = await fetch(url.toString(), {
            headers: {
                'User-Agent': 'PartyPal/1.0 (partypal.social)',  // Nominatim requires User-Agent
                'Accept-Language': 'en',
            },
        })

        if (!response.ok) {
            throw new Error(`Nominatim API error: ${response.status}`)
        }

        const data: NominatimResult[] = await response.json()

        const results = data.map((item) => {
            const { type, icon } = getTypeAndIcon(item)
            const addr = item.address
            const city = addr.city || addr.town || addr.village || addr.suburb || ''
            const state = addr.state || ''
            const country = addr.country || ''

            // Build a clean name
            let name = item.name || ''
            if (!name || name === city) {
                // For city-type results, use the city name
                name = city || item.display_name.split(',')[0]
            }

            // Build clean address
            const addressParts: string[] = []
            if (addr.house_number && addr.road) {
                addressParts.push(`${addr.house_number} ${addr.road}`)
            } else if (addr.road) {
                addressParts.push(addr.road)
            }
            if (city) addressParts.push(city)
            if (state) addressParts.push(state)
            const address = addressParts.join(', ') || item.display_name.split(',').slice(0, 3).join(',')

            return {
                id: item.place_id.toString(),
                name,
                address,
                city,
                state,
                country,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                type,
                icon,
            }
        })

        return NextResponse.json({ results })
    } catch (error) {
        console.error('Location search error:', error)
        return NextResponse.json({ results: [], error: 'Search failed' }, { status: 500 })
    }
}
