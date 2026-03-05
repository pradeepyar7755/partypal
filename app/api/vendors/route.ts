import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, logApiCall } from '@/lib/rate-limiter'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || ''

// Category → search query + relevant Google place types for post-search filtering
const CATEGORY_MAP: Record<string, { query: string; types?: string[]; relevantTypes: string[] }> = {
  'Venue': { query: 'best event venue banquet hall party venue', relevantTypes: ['event_venue', 'banquet_hall', 'wedding_venue', 'community_center', 'convention_center', 'meeting_room', 'cultural_center'] },
  'Decor': { query: 'party decorator event decorations florist flower shop balloon artist floral arrangements', relevantTypes: ['florist', 'flower_shop', 'home_goods_store', 'furniture_store', 'interior_designer', 'art_studio', 'store', 'gift_shop', 'garden_center', 'shopping_mall', 'general_contractor', 'home_improvement_store', 'wholesaler'] },
  'Baker': { query: 'best bakery custom cakes birthday cakes celebration cakes', types: ['bakery'], relevantTypes: ['bakery', 'cake_shop', 'dessert_shop', 'pastry_shop'] },
  'Food': { query: 'best catering food truck private chef party catering food service', relevantTypes: ['restaurant', 'meal_delivery', 'meal_takeaway', 'food_court', 'food_truck'] },
  'Photos': { query: 'best event photographer videographer portrait photography studio', relevantTypes: ['photographer', 'photo_studio', 'photography_studio', 'portrait_studio', 'video_production_studio'] },
  'Music': { query: 'best DJ service party DJ live music entertainment', relevantTypes: ['night_club', 'performing_arts_theater', 'music_store', 'recording_studio', 'karaoke', 'concert_hall'] },
  'Drinks': { query: 'mobile bartender event bartending service party mixologist mobile bar', relevantTypes: ['mobile_caterer', 'caterer', 'bar', 'event_planner', 'restaurant', 'food_service'] },
  'Entertain': { query: 'party entertainment kids entertainment magician face painting', relevantTypes: ['amusement_center', 'amusement_park', 'bowling_alley', 'arcade', 'trampoline_park', 'escape_room', 'laser_tag', 'miniature_golf'] },
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

function getPhotoUrl(photoName: string, maxWidth = 400): string {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_MAPS_API_KEY}`
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
    const { category, location, cuisine } = body

    if (!GOOGLE_MAPS_API_KEY) {
      return NextResponse.json({ vendors: [], source: 'none' })
    }

    const cat = category === 'Mixed party vendors' ? 'All' : category
    const loc = location || 'Atlanta, GA'

    // Check cache first — return instantly if fresh
    const cacheKey = `${cat}:${loc}:${cuisine || 'all'}`
    const cached = vendorCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ vendors: cached.data, source: 'cache' })
    }

    // For "All Vendors", search multiple categories (3 per cat to limit cost)
    if (cat === 'All') {
      const categories = ['Venue', 'Decor', 'Baker', 'Food', 'Music', 'Drinks', 'Photos', 'Entertain']
      const allVendors = await Promise.all(
        categories.map(c => searchPlaces(c, loc, 3))
      )
      const merged = allVendors.flat()
      for (let i = merged.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [merged[i], merged[j]] = [merged[j], merged[i]]
      }
      vendorCache.set(cacheKey, { data: merged, ts: Date.now() })
      return NextResponse.json({ vendors: merged, source: 'google' })
    }

    const vendors = await searchPlaces(cat, loc, 10, cuisine)
    if (vendors.length > 0) {
      vendorCache.set(cacheKey, { data: vendors, ts: Date.now() })
    }
    // Track API usage (fire-and-forget)
    logApiCall('vendors', 'maps', identifier)
    return NextResponse.json({ vendors, source: 'google' })
  } catch (error) {
    console.error('Vendors error:', error)
    return NextResponse.json({ vendors: [], error: 'Failed to load vendors' }, { status: 500 })
  }
}

async function searchPlaces(category: string, location: string, maxResults: number, cuisine?: string) {
  const mapping = CATEGORY_MAP[category]
  if (!mapping) return []

  const textQuery = cuisine && cuisine !== 'All'
    ? `${cuisine} restaurant in ${location}`
    : `${mapping.query} in ${location}`

  const body: Record<string, unknown> = {
    textQuery,
    maxResultCount: Math.min(maxResults, 10),
    languageCode: 'en',
    rankPreference: 'RELEVANCE',
  }

  if (mapping.types?.length) {
    body.includedType = mapping.types[0]
  }

  // COST-OPTIMIZED: removed places.reviews ($25/1K) and places.currentOpeningHours
  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
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
    const rating = (place.rating as number) || 4.0
    const reviewCount = (place.userRatingCount as number) || 0
    const types = (place.types as string[]) || []
    const { price, priceLabel } = mapPrice(place.priceLevel as string | undefined)

    const matchScore = Math.min(98, Math.floor(75 + (rating * 3) + Math.min(reviewCount / 50, 5)))
    const photoUrl = photos?.[0]?.name ? getPhotoUrl(photos[0].name) : undefined
    const photoUrl2 = photos?.[1]?.name ? getPhotoUrl(photos[1].name) : undefined
    const description = editorial?.text || `${cleanTypes(types).slice(0, 2).join(' · ')} in ${location}`

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
      distance: null,
      photoUrl,
      photoUrl2,
      verified: reviewCount >= 50,
      googleMapsUri: place.googleMapsUri as string,
      websiteUri: place.websiteUri as string,
    }
  })
}
