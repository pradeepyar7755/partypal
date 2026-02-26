import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || ''

// Category → search query + type filter mapping
const CATEGORY_MAP: Record<string, { query: string; types?: string[] }> = {
  'Venue': { query: 'event venue banquet hall wedding venue', types: ['event_venue'] },
  'Decor': { query: 'party decorations event decorator floral design' },
  'Baker': { query: 'bakery custom cakes celebration cakes', types: ['bakery'] },
  'Food': { query: 'catering food service restaurant', types: ['restaurant', 'meal_delivery'] },
  'Photos': { query: 'event photographer photography studio' },
  'Music': { query: 'DJ music entertainment live music' },
  'Drinks': { query: 'bar bartender cocktail service', types: ['bar'] },
  'Entertain': { query: 'party entertainment performer magician' },
}

const CAT_EMOJIS: Record<string, string> = {
  Venue: '🏛️', Decor: '🎀', Baker: '🎂', Food: '🍽️',
  Photos: '📷', Music: '🎵', Drinks: '🥂', Entertain: '🤹',
}

// Map Google price_level to display values
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

// Build a photo URL from the Places photo resource name
function getPhotoUrl(photoName: string, maxWidth = 600): string {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_MAPS_API_KEY}`
}

// Clean up Google place types for display as tags
function cleanTypes(types: string[]): string[] {
  const excluded = ['point_of_interest', 'establishment', 'political', 'geocode', 'premise', 'subpremise']
  return types
    .filter(t => !excluded.includes(t))
    .map(t => t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    .slice(0, 4)
}

// Determine badge based on rating
function getBadge(rating: number, reviews: number): string {
  if (rating >= 4.7 && reviews >= 100) return '⭐ Top Rated'
  if (reviews <= 20) return 'New'
  if (reviews >= 200) return 'Popular'
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const { category, location } = await req.json()

    // If no API key, fall back to static
    if (!GOOGLE_MAPS_API_KEY) {
      return NextResponse.json({ vendors: [], source: 'none' })
    }

    const cat = category === 'Mixed party vendors' ? 'All' : category
    const loc = location || 'Atlanta, GA'

    // For "All Vendors", search multiple categories
    if (cat === 'All') {
      const categories = ['Venue', 'Baker', 'Food', 'Music', 'Drinks', 'Photos']
      const allVendors = await Promise.all(
        categories.map(c => searchPlaces(c, loc, 2))
      )
      const merged = allVendors.flat()
      // Shuffle for variety
      for (let i = merged.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [merged[i], merged[j]] = [merged[j], merged[i]]
      }
      return NextResponse.json({ vendors: merged, source: 'google' })
    }

    const vendors = await searchPlaces(cat, loc, 8)
    return NextResponse.json({ vendors, source: 'google' })
  } catch (error) {
    console.error('Vendors error:', error)
    return NextResponse.json({ vendors: [], error: 'Failed to load vendors' }, { status: 500 })
  }
}

async function searchPlaces(category: string, location: string, maxResults: number) {
  const mapping = CATEGORY_MAP[category]
  if (!mapping) return []

  const textQuery = `${mapping.query} in ${location}`

  const body: Record<string, unknown> = {
    textQuery,
    maxResultCount: maxResults,
    languageCode: 'en',
  }

  // Add type filter if available
  if (mapping.types?.length) {
    body.includedType = mapping.types[0]
  }

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
    'places.currentOpeningHours',
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
  const places = data.places || []

  return places.map((place: Record<string, unknown>, idx: number) => {
    const displayName = place.displayName as { text: string } | undefined
    const editorial = place.editorialSummary as { text: string } | undefined
    const photos = place.photos as Array<{ name: string; widthPx: number; heightPx: number }> | undefined
    const rating = (place.rating as number) || 4.0
    const reviews = (place.userRatingCount as number) || 0
    const types = (place.types as string[]) || []
    const { price, priceLabel } = mapPrice(place.priceLevel as string | undefined)

    // Generate a match score based on rating and reviews
    const matchScore = Math.min(98, Math.floor(75 + (rating * 3) + Math.min(reviews / 50, 5)))

    const photoUrl = photos?.[0]?.name ? getPhotoUrl(photos[0].name) : undefined
    const photoUrl2 = photos?.[1]?.name ? getPhotoUrl(photos[1].name) : undefined

    return {
      id: (place.id as string) || `g${idx}`,
      name: displayName?.text || 'Unknown Vendor',
      category,
      location: (place.formattedAddress as string) || location,
      rating: Math.round(rating * 10) / 10,
      reviews,
      price,
      priceLabel,
      matchScore,
      description: editorial?.text || `A highly rated ${category.toLowerCase()} vendor in ${location}. Check their Google Maps listing for more details.`,
      tags: cleanTypes(types),
      badge: getBadge(rating, reviews),
      emoji: CAT_EMOJIS[category] || '📍',
      featured: idx === 0,
      photoUrl,
      photoUrl2,
      googleMapsUri: (place.googleMapsUri as string) || '',
      websiteUri: (place.websiteUri as string) || '',
      isOpen: (place.currentOpeningHours as { openNow?: boolean })?.openNow,
      source: 'google',
    }
  })
}
