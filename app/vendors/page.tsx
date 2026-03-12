'use client'
import { userGet, userGetJSON, userSetJSON } from '@/lib/userStorage'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './vendors.module.css'
import LocationSearch from '@/components/LocationSearch'
import { recordInteraction } from '@/lib/ai-memory'
import { showToast } from '@/components/Toast'
import { trackVendorSearch, trackVendorShortlisted } from '@/lib/analytics'
import { useAuth } from '@/components/AuthContext'

const CATS = ['Venue', 'Decor', 'Baker', 'Food', 'Photos', 'Music', 'Drinks', 'Entertain']
const CAT_EMOJIS: Record<string, string> = {
  Venue: '🏛️', Decor: '🎀', Baker: '🎂', Food: '🍽️', Photos: '📷', Music: '🎵', Drinks: '🥂', Entertain: '🤹'
}

const GRADIENTS: Record<string, string> = {
  Venue: 'linear-gradient(135deg, #2D4059, #1A2535)',
  Photography: 'linear-gradient(135deg, #3B5068, #2D4059)',
  Music: 'linear-gradient(135deg, #4AADA8, #2D7D7A)',
  Baker: 'linear-gradient(135deg, #F7C948, #E8A020)',
  Decor: 'linear-gradient(135deg, #E8896A, #C96040)',
  Catering: 'linear-gradient(135deg, #3D8C6E, #256048)',
  Food: 'linear-gradient(135deg, #3D8C6E, #256048)',
  Drinks: 'linear-gradient(135deg, #7B5EA7, #5A3A8A)',
  Entertain: 'linear-gradient(135deg, #E8896A, #C96040)',
  Photos: 'linear-gradient(135deg, #3B5068, #2D4059)',
}

interface Vendor {
  id: string; name: string; category: string; location: string; rating: number
  reviews: number; price: string; priceLabel: string; matchScore: number
  description: string; tags: string[]; badge: string; emoji: string; featured: boolean
  photoUrl?: string; googleMapsUri?: string; websiteUri?: string
  isOpen?: boolean; source?: string; distance?: number | null
}

function VendorsContent() {
  const router = useRouter()
  const params = useSearchParams()
  const { user } = useAuth()
  const [activecat, setActivecat] = useState('Venue')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('Best Match')
  const [planData, setPlanData] = useState<{ location?: string; theme?: string; budget?: string; guests?: string }>({})
  const [shortlist, setShortlist] = useState<string[]>([])
  const [showShortlistOnly, setShowShortlistOnly] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const VENDORS_PER_PAGE = 10
  const [showSidebar, setShowSidebar] = useState(false)
  const [priceMax, setPriceMax] = useState(1000)
  const [ratingFilter, setRatingFilter] = useState(4)
  const [detectedLocation, setDetectedLocation] = useState('')
  const [displayLocation, setDisplayLocation] = useState('')
  const [locationReady, setLocationReady] = useState(false)
  const [isAutoDetected, setIsAutoDetected] = useState(false)
  const [usedGeoLocation, setUsedGeoLocation] = useState(false)
  const [cuisine, setCuisine] = useState('All')
  const [distanceFilter, setDistanceFilter] = useState('all')
  const [activeEvents, setActiveEvents] = useState<{ eventId: string; eventType: string }[]>([])
  const [addToEventVendor, setAddToEventVendor] = useState<string | null>(null)
  const [showEventPicker, setShowEventPicker] = useState(false)
  const [showSignupPrompt, setShowSignupPrompt] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [apiPage, setApiPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)

  const isGuest = !user || user.isAnonymous

  const CUISINES = ['Indian', 'Mexican', 'Italian', 'Chinese', 'Thai', 'BBQ', 'Mediterranean', 'Japanese', 'Soul Food', 'American']

  // Auto-detect user location on mount
  useEffect(() => {
    const saved = userGetJSON('partypal_shortlist', [] as string[])
    setShortlist(saved)
    // Load active events (non-past, non-demo)
    const events = userGetJSON<any[]>('partypal_events', [])
    const now = new Date()
    const active = events.filter((e: any) => {
      if (!e.eventId || e.eventId === 'demo') return false
      const d = e.date ? new Date(e.date + 'T12:00:00') : null
      return !d || d >= now
    }).map((e: any) => ({ eventId: e.eventId, eventType: e.eventType || 'Event' }))
    setActiveEvents(active)
    const stored = userGet('partyplan')
    if (stored) {
      const p = JSON.parse(stored)
      setPlanData({ location: p.location, theme: p.theme, budget: p.budget, guests: p.guests })
    }
    const cat = params.get('cat')
    if (cat) {
      const match = CATS.find(c => c.toLowerCase() === cat.toLowerCase())
      if (match) setActivecat(match)
    }

    // Also fetch shared events so collaborators can add vendors to them
    if (user && !user.isAnonymous) {
      fetch(`/api/events/shared?uid=${user.uid}&email=${encodeURIComponent(user.email || '')}`)
        .then(r => r.json())
        .then(d => {
          const shared = (d.events || [])
            .filter((e: any) => {
              if (!e.eventId || e.eventId === 'demo') return false
              const eDate = e.date ? new Date(e.date + 'T12:00:00') : null
              return !eDate || eDate >= now
            })
            .map((e: any) => ({ eventId: e.eventId, eventType: (e.eventType || 'Event') + ' (Shared)' }))
          if (shared.length > 0) {
            setActiveEvents(prev => {
              const existingIds = new Set(prev.map(e => e.eventId))
              return [...prev, ...shared.filter((e: any) => !existingIds.has(e.eventId))]
            })
          }
        })
        .catch(() => {})
    }

    // Pull shortlist from cloud if logged in
    if (user && !user.isAnonymous) {
      fetch(`/api/user-data?uid=${user.uid}`)
        .then(r => r.json())
        .then(({ data }) => {
          if (data?.shortlist && Array.isArray(data.shortlist) && data.shortlist.length > 0) {
            setShortlist(data.shortlist)
            userSetJSON('partypal_shortlist', data.shortlist)
          }
          if (data?.shortlistData && Object.keys(data.shortlistData).length > 0) {
            userSetJSON('partypal_shortlist_data', data.shortlistData)
          }
          if (data?.shortlistFull && Object.keys(data.shortlistFull).length > 0) {
            userSetJSON('partypal_shortlist_full', data.shortlistFull)
          }
        })
        .catch(() => { })
    }

    // If we already have a location from URL params or plan, skip detection
    const rawLoc = params.get('location') || (stored ? JSON.parse(stored).location : '')
    const existingLoc = rawLoc && rawLoc !== 'TBD' ? rawLoc : ''
    if (existingLoc) {
      setDetectedLocation(existingLoc)
      setDisplayLocation(existingLoc)
      setIsAutoDetected(true)
      setLocationReady(true)
      return
    }

    // Try browser geolocation first, then IP fallback
    detectLocation()
  }, [params])

  const detectLocation = async () => {
    const isNativePlatform = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform()

    // 1. Try browser Geolocation API
    // Use a longer timeout on native to allow the iOS permission dialog to appear
    if ('geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: isNativePlatform ? 15000 : 5000,
            maximumAge: 300000, // Cache for 5 min
          })
        })
        const { latitude, longitude } = pos.coords

        // Reverse geocode via server to get city + zipcode
        try {
          const geoRes = await fetch('/api/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latlng: `${latitude},${longitude}` }),
          })
          const geoData = await geoRes.json()
          if (geoData.city || geoData.name) {
            const locationStr = geoData.city && geoData.state ? `${geoData.city}, ${geoData.state}` : geoData.address || geoData.name
            setDetectedLocation(locationStr)
            setDisplayLocation('📍 Current Location')
            setUsedGeoLocation(true)
            setIsAutoDetected(true)
            setLocationReady(true)
            return
          }
        } catch { /* fall through */ }

        // If reverse geocode failed, still use coords
        setDetectedLocation(`${latitude},${longitude}`)
        setDisplayLocation('📍 Current Location')
        setUsedGeoLocation(true)
        setIsAutoDetected(true)
        setLocationReady(true)
        return
      } catch {
        // Geolocation denied or failed — prompt user on native
        if (isNativePlatform) {
          showToast('📍 Enable Location in Settings for better vendor results', 'info')
        }
      }
    }

    // 2. Fallback: IP-based geolocation — show zipcode
    try {
      const res = await fetch('/api/geolocation')
      const data = await res.json()
      if (data.label) {
        setDetectedLocation(data.label)
        // Try to extract or use zipcode for display
        const zipMatch = data.zip || data.postal || (data.label as string).match(/\b\d{5}\b/)?.[0]
        setDisplayLocation(zipMatch ? `📍 ${zipMatch}` : `📍 ${data.label}`)
        setIsAutoDetected(true)
        setLocationReady(true)
        return
      }
    } catch { /* ignore */ }

    // 3. Final fallback
    setDetectedLocation('Atlanta, GA')
    setDisplayLocation('📍 Atlanta, GA')
    setIsAutoDetected(true)
    setLocationReady(true)
  }

  useEffect(() => {
    if (!locationReady) return
    fetchVendors(activecat)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activecat, planData, locationReady, detectedLocation, cuisine])

  const fetchVendors = async (cat: string, page = 1, append = false) => {
    if (page === 1) {
      setLoading(true)
      setVendors([])
      setApiPage(1)
    } else {
      setLoadingMore(true)
    }
    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: cat === 'All Vendors' ? 'Mixed party vendors' : cat,
          location: (() => { const l = detectedLocation || params.get('location') || planData.location || ''; return l && l !== 'TBD' ? l : 'Atlanta, GA' })(),
          theme: planData.theme || '', budget: planData.budget || '', guests: planData.guests || '30',
          cuisine: cat === 'Food' && cuisine !== 'All' ? cuisine : undefined,
          page,
        }),
      })
      const data = await res.json()
      const newVendors = data.vendors || []
      setHasMore(data.hasMore ?? false)
      setApiPage(page)
      if (append && page > 1) {
        // Deduplicate by vendor ID
        setVendors(prev => {
          const existingIds = new Set(prev.map(v => v.id))
          const unique = newVendors.filter((v: Vendor) => !existingIds.has(v.id))
          return [...prev, ...unique]
        })
      } else {
        setVendors(newVendors)
      }
      trackVendorSearch(cat, detectedLocation || planData.location || 'unknown')
    } catch { /* keep current vendors */ }
    setLoading(false)
    setLoadingMore(false)
  }

  const loadMoreVendors = () => {
    if (loadingMore || !hasMore) return
    fetchVendors(activecat, apiPage + 1, true)
  }

  const toggleShortlist = (vendorId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (isGuest) { setShowSignupPrompt(true); return }
    setShortlist(prev => {
      const updated = prev.includes(vendorId) ? prev.filter(id => id !== vendorId) : [...prev, vendorId]
      userSetJSON('partypal_shortlist', updated)
      // Also persist full vendor details for dashboard use
      const vendor = vendors.find(v => v.id === vendorId)
      if (vendor) {
        const savedData = userGetJSON<Record<string, { name: string; category: string; price: string; emoji: string; websiteUri?: string; googleMapsUri?: string }>>('partypal_shortlist_data', {})
        const savedFull = userGetJSON<Record<string, Vendor>>('partypal_shortlist_full', {})
        if (updated.includes(vendorId)) {
          savedData[vendorId] = { name: vendor.name, category: vendor.category, price: vendor.price, emoji: vendor.emoji, websiteUri: vendor.websiteUri, googleMapsUri: vendor.googleMapsUri }
          savedFull[vendorId] = vendor
        } else {
          delete savedData[vendorId]
          delete savedFull[vendorId]
        }
        userSetJSON('partypal_shortlist_data', savedData)
        userSetJSON('partypal_shortlist_full', savedFull)
      }
      showToast(updated.includes(vendorId) ? 'Added to shortlist ❤️' : 'Removed from shortlist', updated.includes(vendorId) ? 'success' : 'info')
      if (vendor && updated.includes(vendorId)) {
        recordInteraction({ type: 'vendor_shortlisted', category: vendor.category, vendorName: vendor.name })
        trackVendorShortlisted(vendor.name, vendor.category)
      }
      // Sync shortlist to cloud
      if (user && !user.isAnonymous) {
        const savedData = userGetJSON<Record<string, { name: string; category: string; price: string; emoji: string; websiteUri?: string; googleMapsUri?: string }>>('partypal_shortlist_data', {})
        const savedFull = userGetJSON<Record<string, Vendor>>('partypal_shortlist_full', {})
        fetch('/api/user-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid, shortlist: updated, shortlistData: savedData, shortlistFull: savedFull }),
        }).catch(() => { })
      }
      return updated
    })
  }

  // When shortlist filter is active, merge in saved shortlist vendors that aren't in current results
  const vendorsForFilter = (() => {
    if (!showShortlistOnly) return vendors
    const savedFull = userGetJSON<Record<string, Vendor>>('partypal_shortlist_full', {})
    const currentIds = new Set(vendors.map(v => v.id))
    const missingVendors = shortlist
      .filter(id => !currentIds.has(id) && savedFull[id])
      .map(id => savedFull[id])
    return [...vendors, ...missingVendors]
  })()

  const filtered = vendorsForFilter.filter(v => {
    if (showShortlistOnly && !shortlist.includes(v.id)) return false
    // Rating filter
    if (v.rating < ratingFilter) return false
    // Price filter
    const priceVal = v.price === 'Free' ? 0 : v.price === '$$$$' ? 2000 : v.price === '$$$' ? 1000 : v.price === '$$' ? 500 : v.price === '$' ? 250 : 500
    if (priceVal > priceMax) return false
    // Distance filter — use actual distance from API, fall back to heuristic
    if (distanceFilter !== 'all') {
      let estMiles: number
      if (v.distance != null) {
        estMiles = v.distance
      } else {
        const loc = (detectedLocation || planData.location || '').toLowerCase()
        const vLoc = v.location.toLowerCase()
        const locCity = loc.split(',')[0].trim()
        const cityInAddress = locCity.length > 2 && vLoc.includes(locCity)
        const locParts = loc.split(',').map(p => p.trim())
        const locState = locParts.length >= 2 ? locParts[locParts.length - 1].trim() : ''
        const stateInAddress = locState.length >= 2 && vLoc.includes(locState.toLowerCase())
        estMiles = cityInAddress ? 3 : stateInAddress ? 15 : 30
      }
      if (distanceFilter === '<5' && estMiles > 5) return false
      if (distanceFilter === '<10' && estMiles > 10) return false
      if (distanceFilter === '<25' && estMiles > 25) return false
    }
    if (!search) return true
    return v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.description.toLowerCase().includes(search.toLowerCase()) ||
      v.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  }).sort((a, b) => {
    if (sort === 'Nearest') {
      const loc = (detectedLocation || planData.location || '').toLowerCase()
      const getDistance = (v: Vendor) => {
        if (v.distance != null) return v.distance
        const vLoc = v.location.toLowerCase()
        const locCity = loc.split(',')[0].trim()
        const cityInAddress = locCity.length > 2 && vLoc.includes(locCity)
        const locParts = loc.split(',').map(p => p.trim())
        const locState = locParts.length >= 2 ? locParts[locParts.length - 1].trim() : ''
        const stateInAddress = locState.length >= 2 && vLoc.includes(locState.toLowerCase())
        return cityInAddress ? 3 : stateInAddress ? 15 : 30
      }
      return getDistance(a) - getDistance(b)
    }
    if (sort === 'Top Rated') return b.rating - a.rating
    if (sort === 'Price: Low to High') return parseInt(a.price.replace(/[^0-9]/g, '')) - parseInt(b.price.replace(/[^0-9]/g, ''))
    if (sort === 'Price: High to Low') return parseInt(b.price.replace(/[^0-9]/g, '')) - parseInt(a.price.replace(/[^0-9]/g, ''))
    if (sort === 'Most Reviews') return b.reviews - a.reviews
    return b.matchScore - a.matchScore
  })

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / VENDORS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedVendors = filtered.slice((safePage - 1) * VENDORS_PER_PAGE, safePage * VENDORS_PER_PAGE)
  const startItem = filtered.length > 0 ? (safePage - 1) * VENDORS_PER_PAGE + 1 : 0
  const endItem = Math.min(safePage * VENDORS_PER_PAGE, filtered.length)

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1) }, [activecat, search, sort, ratingFilter, priceMax, showShortlistOnly, cuisine, distanceFilter])

  const location = (() => { const l = detectedLocation || params.get('location') || planData.location || ''; return l && l !== 'TBD' ? l : 'Atlanta, GA' })()

  return (
    <main className="page-enter">
      {/* ══ HEADER ══ */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
            {activeEvents.length > 0 && (
              activeEvents.length === 1 ? (
                <button className="back-btn" onClick={() => router.push(`/dashboard?event=${activeEvents[0].eventId}&tab=vendors`)} style={{ background: 'rgba(74,173,168,0.1)', color: 'var(--teal)', border: '1.5px solid rgba(74,173,168,0.25)' }}>← Back to My Events</button>
              ) : (
                <div style={{ position: 'relative' }}>
                  <button className="back-btn" onClick={() => setShowEventPicker(p => !p)} style={{ background: 'rgba(74,173,168,0.1)', color: 'var(--teal)', border: '1.5px solid rgba(74,173,168,0.25)' }}>← Back to My Events</button>
                  {showEventPicker && (
                    <div style={{ position: 'absolute', top: '110%', left: 0, background: 'white', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1.5px solid var(--border)', padding: '0.5rem', zIndex: 100, minWidth: 200 }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#9aabbb', padding: '0.2rem 0.4rem', marginBottom: '0.3rem' }}>Select event:</div>
                      {activeEvents.map(ev => (
                        <button key={ev.eventId} onClick={() => { setShowEventPicker(false); router.push(`/dashboard?event=${ev.eventId}&tab=vendors`) }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '0.4rem 0.5rem', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy)', cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(74,173,168,0.08)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >{ev.eventType}</button>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
          <h1 className={styles.headerTitle}>
            {activecat === 'All Vendors' ? 'Find Your Perfect Vendors 🔍' : `Find ${CAT_EMOJIS[activecat]} ${activecat} Vendors`}
          </h1>
          <p className={styles.headerSub}>Browse vetted vendors in your area — ready to make your party memorable.</p>
          <div className={styles.filterTabs}>
            {CATS.map(c => (
              <button key={c} className={`${styles.filterTab} ${activecat === c ? styles.filterTabActive : ''}`} onClick={() => { setActivecat(c); if (c !== 'Food') setCuisine('All') }}>
                {CAT_EMOJIS[c]} {c}
              </button>
            ))}
          </div>

        </div>
      </header>

      {/* ══ SEARCH BAR ══ */}
      <div className={styles.searchBarWrap}>
        <div className={styles.searchBarInner}>
          <div className={styles.searchInputWrap} style={{ maxWidth: 280, flex: '0 0 auto' }}>
            <LocationSearch
              value={isAutoDetected ? '' : detectedLocation}
              placeholder={isAutoDetected ? displayLocation || '📍 Current Location' : 'Search city, venue, zip...'}
              className={styles.searchInput}
              onChange={(loc, details) => {
                if (loc) {
                  const locationStr = details?.city && details?.state ? `${details.city}, ${details.state}` : loc
                  setDetectedLocation(locationStr)
                  setDisplayLocation(loc)
                  setIsAutoDetected(false)
                  setUsedGeoLocation(false)
                  setLocationReady(true)
                }
              }}
            />
          </div>
          <div className={styles.searchInputWrap}>
            <input className={styles.searchInput} type="text" placeholder="Search vendors, styles, services…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className={`${styles.filterBtn} ${showSidebar ? styles.filterBtnActive : ''}`} onClick={() => setShowSidebar(!showSidebar)}>⚙️ Filters</button>
          <button className={`${styles.shortlistToggle} ${showShortlistOnly ? styles.shortlistActive : ''}`} onClick={() => { if (isGuest) { setShowSignupPrompt(true); return } setShowShortlistOnly(!showShortlistOnly) }}>
            ❤️ Shortlist ({shortlist.length})
          </button>
          <select className={styles.sortSelect} value={sort} onChange={e => setSort(e.target.value)}>
            <option>Best Match</option>
            <option>Nearest</option>
            <option>Top Rated</option>
            <option>Price: Low to High</option>
            <option>Price: High to Low</option>
            <option>Most Reviews</option>
          </select>
        </div>
      </div>

      {/* Cuisine filter pills — shown below search when Food tab is active */}
      {activecat === 'Food' && (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0.5rem 1rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9aabbb', marginRight: '0.3rem' }}>🍽️ Cuisine:</span>
            {CUISINES.map(c => (
              <button key={c} onClick={() => setCuisine(c)} style={{ padding: '0.3rem 0.7rem', borderRadius: 20, border: cuisine === c ? '2px solid var(--teal)' : '1.5px solid var(--border)', background: cuisine === c ? 'rgba(74,173,168,0.1)' : 'white', color: cuisine === c ? 'var(--teal)' : 'var(--navy)', fontSize: '0.72rem', fontWeight: cuisine === c ? 800 : 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══ MAIN LAYOUT ══ */}
      <div className={styles.main} style={showSidebar ? {} : { gridTemplateColumns: '1fr' }}>
        {/* ── Sidebar Filters ── */}
        {showSidebar && (
          <>
          <div className={styles.sidebarOverlay} onClick={() => setShowSidebar(false)} />
          <div className={styles.sidebarFilters}>
            <div className={styles.sidebarHeader}>
              <h3>Filters</h3>
              <button className={styles.sidebarClose} onClick={() => setShowSidebar(false)}>✕</button>
            </div>
            <div className={styles.filterSection}>
              <h3>Price Range</h3>
              <div className={styles.priceRange}>
                <input type="range" min="0" max="2000" value={priceMax} onChange={e => setPriceMax(Number(e.target.value))} />
                <div className={styles.priceLabels}><span>$0</span><span>Up to ${priceMax.toLocaleString()}</span></div>
              </div>
            </div>
            <div className={styles.filterDivider} />

            <div className={styles.filterSection}>
              <h3>Rating</h3>
              <div>
                {[5, 4, 3].map(r => (
                  <label key={r} className={styles.filterCheck}>
                    <input type="radio" name="rating" checked={ratingFilter === r} onChange={() => setRatingFilter(r)} />
                    <span className={styles.starsSm}>{'★'.repeat(r)}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--navy)' }}>{r === 5 ? '5 stars only' : `${r}+ stars`}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.filterDivider} />

            <div className={styles.filterSection}>
              <h3>Distance</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {[{ label: 'Any Distance', value: 'all' }, { label: '< 5 miles', value: '<5' }, { label: '< 10 miles', value: '<10' }, { label: '< 25 miles', value: '<25' }].map(d => (
                  <label key={d.value} className={styles.filterCheck}>
                    <input type="radio" name="distance" checked={distanceFilter === d.value} onChange={() => setDistanceFilter(d.value)} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--navy)' }}>{d.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          </>
        )}

        {/* ── Vendor Cards ── */}
        <div>
          <div className={styles.resultsCount}>Showing <span>top {filtered.length}</span> vendors within {distanceFilter === '<5' ? '5' : distanceFilter === '<10' ? '10' : '25'} mi of {usedGeoLocation ? '📍 Current Location' : displayLocation || location}{totalPages > 1 && <span style={{ marginLeft: '0.5rem', color: '#9aabbb' }}>• Page {safePage} of {totalPages}</span>}</div>

          {loading ? (
            <div className={styles.loading}>
              <div className="spinner" />
              <p>Finding the best vendors for you...</p>
            </div>
          ) : (
            <div className={styles.vendorGrid}>
              {paginatedVendors.map((v, idx) => (
                <div key={v.id} className={`${styles.vendorCard} ${v.featured ? `${styles.featured} ${styles.featuredRow}` : ''}`} onClick={() => setSelectedVendor(v)}>
                    {/* Image Area */}
                    <div className={styles.vendorCardImg} style={v.photoUrl ? { background: '#1A2535', padding: 0 } : { background: GRADIENTS[v.category] || 'linear-gradient(135deg, #2D4059, #1A2535)' }}>
                      {v.photoUrl ? (
                        <img src={v.photoUrl} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                      ) : v.emoji}
                      <div className={styles.vendorBadgeWrap}>
                        {v.badge === '⭐ Top Rated' && <span className={styles.badgeTop}>⭐ Top Rated</span>}
                        {v.badge === 'New' && <span className={styles.badgeNew}>New</span>}
                        {v.badge === 'Popular' && <span className={styles.badgeNew} style={{ background: '#7B5EA7' }}>Popular</span>}
                        {v.matchScore >= 85 && <span className={styles.badgeMatch}>{v.matchScore}% match</span>}
                        {v.isOpen !== undefined && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: 50, background: v.isOpen ? 'rgba(61,140,110,0.9)' : 'rgba(200,60,60,0.9)', color: 'white' }}>
                            {v.isOpen ? 'Open Now' : 'Closed'}
                          </span>
                        )}
                      </div>
                      <button className={`${styles.favBtn} ${shortlist.includes(v.id) ? styles.favBtnActive : ''}`} onClick={(e) => toggleShortlist(v.id, e)}>
                        {shortlist.includes(v.id) ? '❤️' : '🤍'}
                      </button>
                    </div>
                    {/* Body */}
                    <div className={styles.vendorCardBody}>
                      <div className={styles.vendorCatTag}>{v.emoji} {v.category}</div>
                      <div className={styles.vendorName}>{v.name}</div>
                      <div className={styles.vendorLocation}>📍 {v.location}{v.distance != null && <span className={styles.distanceTag}> · {v.distance < 1 ? '< 1' : v.distance.toFixed(1)} mi</span>}</div>
                      <div className={styles.vendorRating}>
                        <span className="stars">{'★'.repeat(Math.floor(v.rating))}{'☆'.repeat(5 - Math.floor(v.rating))}</span>
                        <span className={styles.ratingNum}>{v.rating}</span>
                        <span className={styles.reviewCount}>({v.reviews} reviews)</span>
                      </div>
                      <div className={styles.vendorDesc}>{v.description}</div>
                      <div className={styles.vendorTags}>
                        {v.tags.map((t, i) => <span key={i} className={styles.vtag}>{t}</span>)}
                      </div>
                      <div className={styles.vendorCardFooter}>
                        <div className={styles.vendorPrice}>
                          <div className={styles.priceFrom}>Starting from</div>
                          <div className={styles.priceAmount}>{v.price} {v.priceLabel}</div>
                        </div>
                        <a href={v.websiteUri || v.googleMapsUri || '#'} target="_blank" rel="noopener noreferrer" className={styles.bookBtn} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none', color: 'inherit', background: 'var(--light-bg)', border: '1.5px solid var(--border)' }}>Visit →</a>
                        {activeEvents.length > 0 && (
                          <div style={{ position: 'relative' }}>
                            <button onClick={(e) => { e.stopPropagation(); setAddToEventVendor(addToEventVendor === v.id ? null : v.id) }} className={styles.bookBtn}>+ Event</button>
                            {addToEventVendor === v.id && (
                              <div style={{ position: 'absolute', bottom: '110%', right: 0, background: 'white', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1.5px solid var(--border)', padding: '0.5rem', zIndex: 100, minWidth: 180 }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#9aabbb', padding: '0.2rem 0.4rem', marginBottom: '0.3rem' }}>Add to event:</div>
                                {activeEvents.map(ev => (
                                  <button key={ev.eventId} onClick={(e) => {
                                    e.stopPropagation()
                                    const existingVendors = userGetJSON<any[]>(`partypal_vendors_${ev.eventId}`, [])
                                    if (existingVendors.some((vn: any) => vn.name === v.name)) {
                                      showToast(`${v.name} is already in ${ev.eventType}`, 'info')
                                      setAddToEventVendor(null)
                                      return
                                    }
                                    const newVendor = { name: v.name, category: v.category, notes: `${v.rating}★ · ${v.price} · ${v.location}`, confirmed: false, costEstimate: undefined, websiteUri: v.websiteUri, googleMapsUri: v.googleMapsUri }
                                    const updated = [...existingVendors, newVendor]
                                    userSetJSON(`partypal_vendors_${ev.eventId}`, updated)
                                    // Sync to cloud
                                    fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: ev.eventId, vendors: updated }) }).catch(() => { })
                                    showToast(`Added ${v.name} to ${ev.eventType}!`, 'success')
                                    setAddToEventVendor(null)
                                  }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '0.4rem 0.5rem', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy)', cursor: 'pointer' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(74,173,168,0.08)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                  >{ev.eventType}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
              ))}
            </div>
          )}

          {/* ── Pagination Controls ── */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                disabled={safePage <= 1}
                onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 300, behavior: 'smooth' }) }}
              >
                ← Prev
              </button>
              <div className={styles.pageNumbers}>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | 'dots')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('dots')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) =>
                    p === 'dots' ? (
                      <span key={`dots-${i}`} className={styles.pageDots}>…</span>
                    ) : (
                      <button
                        key={p}
                        className={`${styles.pageNum} ${safePage === p ? styles.pageNumActive : ''}`}
                        onClick={() => { setCurrentPage(p); window.scrollTo({ top: 300, behavior: 'smooth' }) }}
                      >
                        {p}
                      </button>
                    )
                  )}
              </div>
              <button
                className={styles.pageBtn}
                disabled={safePage >= totalPages}
                onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 300, behavior: 'smooth' }) }}
              >
                Next →
              </button>
            </div>
          )}

          {/* ── Load More Vendors (fires API call on demand) ── */}
          {hasMore && safePage >= totalPages && !loading && (
            <div className={styles.loadMoreWrap}>
              <button
                className={styles.loadMoreBtn}
                onClick={loadMoreVendors}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    Loading more vendors…
                  </>
                ) : (
                  <>🔍 Load More Vendors (within 25 mi)</>
                )}
              </button>
              <p className={styles.loadMoreHint}>
                Showing {vendors.length} vendors · Click to discover more nearby options
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ══ VENDOR DETAIL MODAL ══ */}
      {selectedVendor && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setSelectedVendor(null) }}>
          <div className={styles.modalCard}>
            {/* Modal photo banner */}
            {selectedVendor.photoUrl && (
              <div style={{ width: '100%', height: 200, borderRadius: '16px 16px 0 0', overflow: 'hidden', position: 'relative' }}>
                <img src={selectedVendor.photoUrl} alt={selectedVendor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <div className={styles.modalHeader}>
              <div className={styles.modalVendorIcon} style={{ background: GRADIENTS[selectedVendor.category] || 'var(--light-bg)' }}>
                {selectedVendor.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div className={styles.vendorCatTag}>{selectedVendor.category}</div>
                <h2 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1.4rem', color: 'var(--navy)', marginBottom: '0.2rem' }}>{selectedVendor.name}</h2>
                <div className={styles.vendorLocation}>📍 {selectedVendor.location}{selectedVendor.distance != null && <span className={styles.distanceTag}> · {selectedVendor.distance < 1 ? '< 1' : selectedVendor.distance.toFixed(1)} mi away</span>}</div>
                <div className={styles.vendorRating} style={{ marginTop: '0.3rem', marginBottom: 0 }}>
                  <span className="stars">{'★'.repeat(Math.floor(selectedVendor.rating))}{'☆'.repeat(5 - Math.floor(selectedVendor.rating))}</span>
                  <span className={styles.ratingNum}>{selectedVendor.rating}</span>
                  <span className={styles.reviewCount}>({selectedVendor.reviews} reviews)</span>
                  {selectedVendor.isOpen !== undefined && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: 50, marginLeft: '0.5rem', background: selectedVendor.isOpen ? 'rgba(61,140,110,0.12)' : 'rgba(200,60,60,0.1)', color: selectedVendor.isOpen ? '#3D8C6E' : '#c83c3c' }}>
                      {selectedVendor.isOpen ? '● Open Now' : '● Closed'}
                    </span>
                  )}
                </div>
              </div>
              <button className={styles.modalClose} onClick={() => setSelectedVendor(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalSection}>
                <div className={styles.modalSectionTitle}>About</div>
                <p style={{ color: '#6b7f94', fontWeight: 600, lineHeight: 1.7 }}>{selectedVendor.description}</p>
              </div>
              <div className={styles.modalSection}>
                <div className={styles.modalSectionTitle}>Specialties</div>
                <div className={styles.vendorTags} style={{ marginBottom: 0 }}>
                  {selectedVendor.tags.map((t, i) => <span key={i} className={styles.vtag}>{t}</span>)}
                </div>
              </div>
              <div className={styles.modalSection}>
                <div className={styles.modalSectionTitle}>Pricing</div>
                <div className={styles.priceAmount}>{selectedVendor.price} <span style={{ fontSize: '0.9rem', color: '#9aabbb', fontFamily: 'Nunito' }}>{selectedVendor.priceLabel}</span></div>
              </div>
              {selectedVendor.matchScore >= 80 && (
                <div className={styles.modalSection}>
                  <div className={styles.matchBadge} style={{ fontSize: '0.82rem', padding: '0.3rem 0.8rem' }}>🎯 {selectedVendor.matchScore}% match for your party</div>
                </div>
              )}
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                {selectedVendor.googleMapsUri && (
                  <a href={selectedVendor.googleMapsUri} target="_blank" rel="noopener noreferrer" className={styles.contactBtn} style={{ textDecoration: 'none', textAlign: 'center', flex: 1 }}>
                    📍 View on Maps
                  </a>
                )}
                {selectedVendor.websiteUri && (
                  <a href={selectedVendor.websiteUri} target="_blank" rel="noopener noreferrer" className={styles.contactBtn} style={{ textDecoration: 'none', textAlign: 'center', background: 'var(--teal)', flex: 1 }}>
                    🌐 Website
                  </a>
                )}
                <button
                  className={styles.contactBtn}
                  style={{ background: shortlist.includes(selectedVendor.id) ? 'var(--coral)' : 'var(--light-bg)', color: shortlist.includes(selectedVendor.id) ? 'white' : 'var(--navy)', flex: '0 0 auto', padding: '0.85rem 1.2rem' }}
                  onClick={(e) => toggleShortlist(selectedVendor.id, e)}
                >
                  {shortlist.includes(selectedVendor.id) ? '❤️' : '🤍'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Signup Prompt Modal */}
      {showSignupPrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={() => setShowSignupPrompt(false)}>
          <div className="card" style={{ padding: '2.5rem', width: '100%', maxWidth: 420, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '3rem', marginBottom: '0.8rem' }}>❤️</div>
            <h2 style={{ fontFamily: "'Fredoka One',cursive", color: 'var(--navy)', marginBottom: '0.5rem', fontSize: '1.3rem' }}>Save Your Favorites</h2>
            <p style={{ fontSize: '0.88rem', color: '#6b7c93', fontWeight: 600, lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Create a free account to shortlist vendors, compare options, and share your favorites with co-planners!
            </p>
            <a href="/login?redirect=/vendors" style={{
              display: 'inline-block', padding: '0.7rem 2rem', borderRadius: 50,
              background: 'linear-gradient(135deg, var(--teal), #3D8C6E)',
              color: 'white', fontWeight: 800, fontSize: '0.92rem',
              textDecoration: 'none', fontFamily: "'Fredoka One', cursive",
              transition: 'transform 0.15s',
              boxShadow: '0 4px 15px rgba(74,173,168,0.3)',
            }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              🔗 Sign Up Free
            </a>
            <div style={{ marginTop: '0.8rem' }}>
              <button onClick={() => setShowSignupPrompt(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9aabbb', fontSize: '0.82rem', fontWeight: 700,
              }}>Maybe Later</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default function Vendors() {
  return <Suspense fallback={<div style={{ textAlign: 'center', padding: '4rem' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}>
    <VendorsContent />
  </Suspense>
}
