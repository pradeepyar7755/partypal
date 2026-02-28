import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || ''
const genAI = new GoogleGenerativeAI(GOOGLE_MAPS_API_KEY)

// Category → search query + relevant Google place types for post-search filtering
const CATEGORY_MAP: Record<string, { query: string; types?: string[]; relevantTypes: string[] }> = {
  'Venue': { query: 'best event venue banquet hall party venue', relevantTypes: ['event_venue', 'banquet_hall', 'wedding_venue', 'community_center', 'convention_center', 'meeting_room', 'cultural_center'] },
  'Decor': { query: 'event decorator party decorations balloon artist floral design', relevantTypes: ['florist', 'home_goods_store', 'furniture_store', 'interior_designer', 'art_studio'] },
  'Baker': { query: 'best bakery custom cakes birthday cakes celebration cakes', types: ['bakery'], relevantTypes: ['bakery', 'cake_shop', 'dessert_shop', 'pastry_shop'] },
  'Food': { query: 'best catering restaurant food service party catering', relevantTypes: ['restaurant', 'meal_delivery', 'meal_takeaway', 'food_court', 'catering_service', 'caterer'] },
  'Photos': { query: 'best event photographer portrait photography studio', relevantTypes: ['photographer', 'photo_studio', 'photography_studio', 'portrait_studio'] },
  'Music': { query: 'best DJ service party DJ live music entertainment', relevantTypes: ['night_club', 'performing_arts_theater', 'music_store', 'recording_studio', 'karaoke', 'concert_hall'] },
  'Drinks': { query: 'best cocktail bar sports bar lounge taproom', relevantTypes: ['bar', 'night_club', 'pub', 'wine_bar', 'cocktail_bar', 'lounge', 'brewery', 'winery'] },
  'Entertain': { query: 'party entertainment kids entertainment magician face painting', relevantTypes: ['amusement_center', 'amusement_park', 'bowling_alley', 'arcade', 'trampoline_park', 'escape_room', 'laser_tag', 'miniature_golf'] },
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

// Summarize Google reviews using Gemini
async function summarizeReviews(vendorName: string, category: string, reviews: Array<{ text: string; rating: number }>): Promise<string> {
  if (!GOOGLE_MAPS_API_KEY || reviews.length === 0) return ''
  try {
    const reviewTexts = reviews
      .filter(r => r.text && r.text.length > 10)
      .slice(0, 5)
      .map(r => `[${r.rating}★] ${r.text}`)
      .join('\n')
    if (!reviewTexts) return ''

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { maxOutputTokens: 80 } })
    const result = await model.generateContent(
      `Summarize these customer reviews for "${vendorName}" (a ${category} vendor) into ONE concise, engaging sentence (under 25 words). Focus on what customers love most. Don't mention the location or say "highly rated". Be specific about what makes them special.\n\nReviews:\n${reviewTexts}`
    )
    return result.response.text()?.trim() || ''
  } catch {
    return ''
  }
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
        categories.map(c => searchPlaces(c, loc, 4))
      )
      const merged = allVendors.flat()
      // Shuffle for variety
      for (let i = merged.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [merged[i], merged[j]] = [merged[j], merged[i]]
      }
      return NextResponse.json({ vendors: merged, source: 'google' })
    }

    const vendors = await searchPlaces(cat, loc, 15)
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
    maxResultCount: 20,
    languageCode: 'en',
    rankPreference: 'RELEVANCE',
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
    'places.reviews',
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

  // Post-filter: only keep places whose Google types overlap with this category's relevant types
  if (mapping.relevantTypes.length > 0) {
    const relevant = new Set(mapping.relevantTypes)
    places = places.filter((p: Record<string, unknown>) => {
      const types = (p.types as string[]) || []
      return types.some(t => relevant.has(t))
    })
  }

  // Sort by popularity (reviews * rating) to surface best vendors
  places.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
    const scoreA = ((a.rating as number) || 0) * Math.log2(((a.userRatingCount as number) || 1) + 1)
    const scoreB = ((b.rating as number) || 0) * Math.log2(((b.userRatingCount as number) || 1) + 1)
    return scoreB - scoreA
  })
  // Cap at requested max after filtering
  places = places.slice(0, maxResults)

  // Process all vendors, with AI summaries running in parallel
  const vendorPromises = places.map(async (place: Record<string, unknown>, idx: number) => {
    const displayName = place.displayName as { text: string } | undefined
    const editorial = place.editorialSummary as { text: string } | undefined
    const photos = place.photos as Array<{ name: string; widthPx: number; heightPx: number }> | undefined
    const rating = (place.rating as number) || 4.0
    const reviewCount = (place.userRatingCount as number) || 0
    const types = (place.types as string[]) || []
    const { price, priceLabel } = mapPrice(place.priceLevel as string | undefined)
    const googleReviews = (place.reviews as Array<{ text?: { text: string }; rating: number }>) || []

    // Generate a match score based on rating and reviews
    const matchScore = Math.min(98, Math.floor(75 + (rating * 3) + Math.min(reviewCount / 50, 5)))

    const photoUrl = photos?.[0]?.name ? getPhotoUrl(photos[0].name) : undefined
    const photoUrl2 = photos?.[1]?.name ? getPhotoUrl(photos[1].name) : undefined

    // Build description: editorial > AI review summary > generic fallback
    let description = editorial?.text || ''
    if (!description && googleReviews.length > 0) {
      const parsedReviews = googleReviews
        .filter(r => r.text?.text)
        .map(r => ({ text: r.text!.text, rating: r.rating || 5 }))
      const aiSummary = await summarizeReviews(
        displayName?.text || 'this vendor',
        category,
        parsedReviews
      )
      description = aiSummary
    }
    if (!description) {
      description = `A popular ${category.toLowerCase()} vendor in your area. Tap to view details and reviews.`
    }

    return {
      id: (place.id as string) || `g${idx}`,
      name: displayName?.text || 'Unknown Vendor',
      category,
      location: (place.formattedAddress as string) || location,
      rating: Math.round(rating * 10) / 10,
      reviews: reviewCount,
      price,
      priceLabel,
      matchScore,
      description,
      tags: cleanTypes(types),
      badge: getBadge(rating, reviewCount),
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

  return Promise.all(vendorPromises)
}
