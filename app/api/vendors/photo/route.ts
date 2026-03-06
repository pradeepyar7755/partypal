import { NextRequest } from 'next/server'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || ''

// ═══ IN-MEMORY PHOTO CACHE ═══
// Caches photo binary data to avoid repeat Places Photo API calls.
// Each cached photo is ~15-40 KB (300px wide JPEG). At 500 cached photos ≈ 10-20 MB RAM.
// TTL: 1 hour — photos don't change often.
const photoCache = new Map<string, { data: ArrayBuffer; contentType: string; ts: number }>()
const PHOTO_CACHE_TTL = 60 * 60 * 1000 // 1 hour
const MAX_CACHE_ENTRIES = 500

function evictStaleEntries() {
  if (photoCache.size <= MAX_CACHE_ENTRIES) return
  const now = Date.now()
  const keysToDelete: string[] = []
  photoCache.forEach((entry, key) => {
    if (now - entry.ts > PHOTO_CACHE_TTL || photoCache.size - keysToDelete.length > MAX_CACHE_ENTRIES) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach(key => photoCache.delete(key))
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const ref = url.searchParams.get('ref') // photo resource name e.g. "places/xxx/photos/yyy"
  const width = Math.min(Number(url.searchParams.get('w')) || 300, 400)

  if (!ref || !GOOGLE_MAPS_API_KEY) {
    return new Response('Not found', { status: 404 })
  }

  const cacheKey = `${ref}:${width}`

  // Return cached photo instantly
  const cached = photoCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < PHOTO_CACHE_TTL) {
    return new Response(cached.data, {
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Photo-Source': 'cache',
      },
    })
  }

  // Fetch from Google Places Photos API
  try {
    const googleUrl = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${width}&key=${GOOGLE_MAPS_API_KEY}`
    const res = await fetch(googleUrl, { redirect: 'follow' })

    if (!res.ok) {
      return new Response('Photo unavailable', { status: 502 })
    }

    const data = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') || 'image/jpeg'

    // Cache the photo
    evictStaleEntries()
    photoCache.set(cacheKey, { data, contentType, ts: Date.now() })

    return new Response(data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Photo-Source': 'google',
      },
    })
  } catch {
    return new Response('Photo fetch failed', { status: 502 })
  }
}
