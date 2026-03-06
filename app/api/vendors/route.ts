import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, logApiCall } from '@/lib/rate-limiter'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || ''
const MILES_25_IN_METERS = 40234 // 25 miles radius

// Category → search queries (primary + alternate for pagination) + relevant Google place types
const CATEGORY_MAP: Record<string, { query: string; altQuery: string; types?: string[]; relevantTypes: string[] }> = {
  'Venue': { query: 'best event venue banquet hall party venue', altQuery: 'wedding venue reception hall conference center event space', relevantTypes: ['event_venue', 'banquet_hall', 'wedding_venue', 'community_center', 'convention_center', 'meeting_room', 'cultural_center'] },
  'Decor': { query: 'party decorator event decorations florist flower shop balloon artist floral arrangements', altQuery: 'event planner decorator floral design party supplies rental', relevantTypes: ['florist', 'flower_shop', 'home_goods_store', 'furniture_store', 'interior_designer', 'art_studio', 'store', 'gift_shop', 'garden_center', 'shopping_mall', 'general_contractor', 'home_improvement_store', 'wholesaler'] },
  'Baker': { query: 'best bakery custom cakes birthday cakes celebration cakes', altQuery: 'cake shop pastry dessert cupcakes specialty bakery', types: ['bakery'], relevantTypes: ['bakery', 'cake_shop', 'dessert_shop', 'pastry_shop'] },
  'Food': { query: 'best catering food truck private chef party catering food service', altQuery: 'event catering meal prep personal chef food delivery', relevantTypes: ['restaurant', 'meal_delivery', 'meal_takeaway', 'food_court', 'food_truck'] },
  'Photos': { query: 'best event photographer videographer portrait photography studio', altQuery: 'wedding photographer photo booth video production', relevantTypes: ['photographer', 'photo_studio', 'photography_studio', 'portrait_studio', 'video_production_studio'] },
  'Music': { query: 'best DJ service party DJ live music entertainment', altQuery: 'live band karaoke music entertainment performer', relevantTypes: ['night_club', 'performing_arts_theater', 'music_store', 'recording_studio', 'karaoke', 'concert_hall'] },
  'Drinks': { query: 'mobile bartender event bartending service party mixologist mobile bar', altQuery: 'cocktail catering bar service beverage catering', relevantTypes: ['mobile_caterer', 'caterer', 'bar', 'event_planner', 'restaurant', 'food_service'] },
  'Entertain': { query: 'party entertainment kids entertainment magician face painting', altQuery: 'fun center arcade bowling trampoline escape room activities', relevantTypes: ['amusement_center', 'amusement_park', 'bowling_alley', 'arcade', 'trampoline_park', 'escape_room', 'laser_tag', 'miniature_golf'] },
}

const CAT_EMOJIS: Record<string, string> = {
  Venue: '🏛️', Decor: '🎀', Baker: '🎂', Food: '🍽️',
  Photos: '📷', Music: '🎵', Drinks: '🥂', Entertain: '🤹',
}

function mapPrice(priceLevel?: string): { price: string; priceLabel: string } {
  switch (priceLevel) {
    case 'PRICE_LEVEL_FREE': return { price: 'Free', priceLabel: '' }
    case 'PRICE_LEVEL_INEXPENSIVE': return { price: '$', priceLabel: 'budget-friendly' }
    case 'PRICE_LEVEL_MODERATE': return { price: '$$', priceLabel: 'moderate' }
    case 'PRICE_LEVEL_EXPENSIVE': return { price: '$$$', priceLabel: 'premium' }
    case 'PRICE_LEVEL_VERY_EXPENSIVE': return { price: '$$$$', priceLabel: 'luxury' }
    default: return { price: '$$', priceLabel: 'varies' }
  }
}

function getPhotoUrl(photoName: string): string {
  // Proxy through our own API to enable server-side caching and avoid
  // exposing the API key to the browser. Each unique photo is fetched
  // from Google once, then served from memory cache for 1 hour.
  return `/api/vendors/photo?ref=${encodeURIComponent(photoName)}&w=300`
}

function cleanTypes(types: string[]): string[] {
  const excluded = ['point_of_interest', 'establishment', 'political', 'geocode', 'premise', 'subpremise']
  return types
    .filter(t => !excluded.includes(t))
    .map(t => t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    .slice(0, 4)
}

function getBadge(rating: number, reviews: number): string {
  if (rating >= 4.7 && reviews >= 100) return '⭐ Top Rated'
  if (reviews <= 20) return 'New'
  if (reviews >= 200) return 'Popular'
  return ''
}

// ═══ IN-MEMORY CACHE (5 min TTL) — avoids repeat API calls ═══
const vendorCache = new Map<string, { data: unknown[]; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000

// Geocode cache — avoid repeat geocoding of the same location
const geocodeCache = new Map<string, { lat: number; lng: number; ts: number }>()

async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  const cached = geocodeCache.get(location)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { lat: cached.lat, lng: cached.lng }
  }
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GOOGLE_MAPS_API_KEY}`
    )
    const data = await res.json()
    if (data.results?.[0]?.geometry?.location) {
      const { lat, lng } = data.results[0].geometry.location
      geocodeCache.set(location, { lat, lng, ts: Date.now() })
      return { lat, lng }
    }
  } catch (err) {
    console.warn('Geocode failed for:', location, err)
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const identifier = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'anonymous'
    // Rate limit — fail open (don't block vendors if Firestore is down)
    try {
      const rateCheck = await checkRateLimit(identifier, 'vendors')
      if (!rateCheck.allowed) {
        return NextResponse.json({
          error: `Daily limit reached (${rateCheck.limit} requests/day). Try again tomorrow.`,
          vendors: [],
          rateLimit: rateCheck,
        }, { status: 429 })
      }
    } catch (rateLimitErr) {
      console.warn('Rate limiter unavailable, allowing request:', rateLimitErr)
    }

    const body = await req.json()
    const { category, location, cuisine, page = 1 } = body
    const pageNum = Math.max(1, Math.min(page, 3)) // Max 3 pages (up to 60 results)

    if (!GOOGLE_MAPS_API_KEY) {
      return NextResponse.json({ vendors: [], source: 'none', hasMore: false })
    }

    const cat = category === 'Mixed party vendors' ? 'All' : category
    const loc = location || 'Atlanta, GA'

    // Geocode the location for radius-based search
    const coords = await geocodeLocation(loc)

    // Check cache first — return instantly if fresh
    const cacheKey = `${cat}:${loc}:${cuisine || 'all'}:p${pageNum}`
    const cached = vendorCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      // Check if there could be more results
      const nextCacheKey = `${cat}:${loc}:${cuisine || 'all'}:p${pageNum + 1}`
      const hasMore = pageNum < 3 && !vendorCache.has(nextCacheKey) // Assume more unless we know otherwise
      return NextResponse.json({ vendors: cached.data, source: 'cache', hasMore, page: pageNum })
    }

    // For "All Vendors", search multiple categories (3 per cat to limit cost)
    if (cat === 'All') {
      const categories = ['Venue', 'Decor', 'Baker', 'Food', 'Music', 'Drinks', 'Photos', 'Entertain']
      const allVendors = await Promise.all(
        categories.map(c => searchPlaces(c, loc, 3, undefined, coords))
      )
      const merged = allVendors.flat()
      for (let i = merged.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [merged[i], merged[j]] = [merged[j], merged[i]]
      }
      vendorCache.set(cacheKey, { data: merged, ts: Date.now() })
      return NextResponse.json({ vendors: merged, source: 'google', hasMore: false, page: 1 })
    }

    // Page 1: relevance-ranked, 20 results
    // Page 2: distance-ranked, 20 results (different ordering = different results)
    // Page 3: alternate query, 20 results (different keywords = different results)
    const rankPref = pageNum === 2 ? 'DISTANCE' : 'RELEVANCE'
    const useAltQuery = pageNum >= 3
    const vendors = await searchPlaces(cat, loc, 20, cuisine, coords, rankPref, useAltQuery)

    const hasMore = pageNum < 3 && vendors.length >= 10

    if (vendors.length > 0) {
      vendorCache.set(cacheKey, { data: vendors, ts: Date.now() })
    }
    // Track API usage (fire-and-forget)
    logApiCall('vendors', 'maps', identifier)
    return NextResponse.json({ vendors, source: 'google', hasMore, page: pageNum })
  } catch (error) {
    console.error('Vendors error:', error)
    return NextResponse.json({ vendors: [], error: 'Failed to load vendors', hasMore: false }, { status: 500 })
  }
}

async function searchPlaces(
  category: string,
  location: string,
  maxResults: number,
  cuisine?: string,
  coords?: { lat: number; lng: number } | null,
  rankPreference: string = 'RELEVANCE',
  useAltQuery: boolean = false,
) {
  const mapping = CATEGORY_MAP[category]
  if (!mapping) return []

  const baseQuery = useAltQuery ? mapping.altQuery : mapping.query
  const textQuery = cuisine && cuisine !== 'All'
    ? `${cuisine} restaurant in ${location}`
    : `${baseQuery} in ${location}`

  const body: Record<string, unknown> = {
    textQuery,
    maxResultCount: Math.min(maxResults, 20),
    languageCode: 'en',
    rankPreference,
  }

  // Add 25-mile radius location bias when we have coordinates
  if (coords) {
    body.locationBias = {
      circle: {
        center: { latitude: coords.lat, longitude: coords.lng },
        radius: MILES_25_IN_METERS,
      },
    }
  }

  if (mapping.types?.length) {
    body.includedType = mapping.types[0]
  }

  // COST-OPTIMIZED: removed places.reviews ($25/1K) and places.currentOpeningHours
  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.location',
    'places.rating',
    'places.userRatingCount',
    'places.priceLevel',
    'places.types',
    'places.editorialSummary',
    'places.photos',
    'places.googleMapsUri',
    'places.websiteUri',
    'places.businessStatus',
  ].join(',')

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error(`Places search error for ${category}:`, errText)
    return []
  }

  const data = await res.json()
  let places = data.places || []
  console.log(`[vendor-search] ${category} in ${location}: API returned ${places.length} places, query="${textQuery}"`)

  // Soft filter: prefer matching types but keep all results if too few match
  if (mapping.relevantTypes.length > 0) {
    const relevant = new Set(mapping.relevantTypes)
    const matching = places.filter((p: Record<string, unknown>) => {
      const types = (p.types as string[]) || []
      return types.some(t => relevant.has(t))
    })
    if (matching.length >= 3) {
      places = matching
    }
    // Otherwise keep all results — better to show something than nothing
  }

  // Cuisine boost: sort cuisine-matching results to top
  if (cuisine && cuisine !== 'All') {
    const cuisineLower = cuisine.toLowerCase()
    const scored = places.map((p: Record<string, unknown>) => {
      const name = ((p.displayName as { text: string })?.text || '').toLowerCase()
      const editorial = ((p.editorialSummary as { text: string })?.text || '').toLowerCase()
      const types = ((p.types as string[]) || []).join(' ').toLowerCase()
      let score = 0
      if (name.includes(cuisineLower)) score += 3
      if (editorial.includes(cuisineLower)) score += 2
      if (types.includes(cuisineLower)) score += 1
      return { place: p, score }
    })
    scored.sort((a: { score: number }, b: { score: number }) => b.score - a.score)
    places = scored.map((s: { place: Record<string, unknown> }) => s.place)
  }

  // Sort by popularity
  places.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
    const scoreA = ((a.rating as number) || 0) * Math.log2(((a.userRatingCount as number) || 1) + 1)
    const scoreB = ((b.rating as number) || 0) * Math.log2(((b.userRatingCount as number) || 1) + 1)
    return scoreB - scoreA
  })
  places = places.slice(0, maxResults)

  // Map to vendor objects — NO Gemini AI calls, use editorial summaries
  return places.map((place: Record<string, unknown>, idx: number) => {
    const displayName = place.displayName as { text: string } | undefined
    const editorial = place.editorialSummary as { text: string } | undefined
    const photos = place.photos as Array<{ name: string; widthPx: number; heightPx: number }> | undefined
    const placeLocation = place.location as { latitude: number; longitude: number } | undefined
    const rating = (place.rating as number) || 4.0
    const reviewCount = (place.userRatingCount as number) || 0
    const types = (place.types as string[]) || []
    const { price, priceLabel } = mapPrice(place.priceLevel as string | undefined)

    const matchScore = Math.min(98, Math.floor(75 + (rating * 3) + Math.min(reviewCount / 50, 5)))
    const photoUrl = photos?.[0]?.name ? getPhotoUrl(photos[0].name) : undefined
    const description = editorial?.text || `${cleanTypes(types).slice(0, 2).join(' · ')} in ${location}`

    // Calculate actual distance if we have both coordinates
    let distanceMiles: number | null = null
    if (coords && placeLocation) {
      distanceMiles = haversineDistance(coords.lat, coords.lng, placeLocation.latitude, placeLocation.longitude)
    }

    return {
      id: (place.id as string) || `v-${idx}`,
      name: displayName?.text || 'Unknown Vendor',
      category,
      emoji: CAT_EMOJIS[category] || '🎉',
      location: (place.formattedAddress as string) || location,
      rating,
      reviews: reviewCount,
      price,
      priceLabel,
      tags: cleanTypes(types),
      description,
      matchScore,
      badge: getBadge(rating, reviewCount),
      isNew: reviewCount <= 20,
      distance: distanceMiles,
      photoUrl,
      verified: reviewCount >= 50,
      googleMapsUri: place.googleMapsUri as string,
      websiteUri: place.websiteUri as string,
    }
  })
}

// Haversine formula — returns distance in miles between two lat/lng points
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
