'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './vendors.module.css'
import { showToast } from '@/components/Toast'

const CATS = ['All Vendors', 'Venue', 'Decor', 'Baker', 'Food', 'Photos', 'Music', 'Drinks', 'Entertain', 'Guests']
const CAT_EMOJIS: Record<string, string> = {
  'All Vendors': '🌟', Venue: '🏛️', Decor: '🎀', Baker: '🎂', Food: '🍽️', Photos: '📷', Music: '🎵', Drinks: '🥂', Entertain: '🤹', Guests: '💌'
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
}

const STATIC_VENDORS: Vendor[] = [
  { id: 'v1', name: 'The Loft ATL', category: 'Venue', location: 'Midtown Atlanta, GA', rating: 4.9, reviews: 312, price: '$450', priceLabel: '/ event', matchScore: 98, description: 'A stunning industrial-chic loft in the heart of Midtown. Features exposed brick, Edison bulb lighting, a full catering kitchen, and a rooftop terrace. Perfect for intimate parties of 20–80 guests.', tags: ['Tropical-friendly', 'Rooftop', 'Indoor+Outdoor', 'Catering Kitchen', 'AV Equipment'], badge: '⭐ Top Rated', emoji: '🏛️', featured: true },
  { id: 'v2', name: 'Lens & Light Co.', category: 'Photography', location: 'Buckhead, Atlanta', rating: 4.8, reviews: 178, price: '$320', priceLabel: '/ event', matchScore: 95, description: 'Award-winning event photographers specializing in vibrant, candid party photography. Includes 4-hr coverage, 200+ edited photos, and online gallery.', tags: ['Candid Style', 'Same-day Previews', 'Video Add-on'], badge: '', emoji: '📷', featured: false },
  { id: 'v3', name: 'DJ Tropicana', category: 'Music', location: 'East Atlanta Village', rating: 4.6, reviews: 94, price: '$280', priceLabel: '/ event', matchScore: 91, description: 'Specializes in tropical, reggaeton, and Afrobeats vibes. Brings full sound system, lighting rig, and a custom playlist curated for your theme.', tags: ['Tropical Vibes', 'Sound System', 'Custom Playlist'], badge: 'New', emoji: '🎵', featured: false },
  { id: 'v4', name: 'Sugar Blooms Bakery', category: 'Baker', location: 'Decatur, Atlanta', rating: 5.0, reviews: 256, price: '$150', priceLabel: '/ cake', matchScore: 89, description: 'Custom celebration cakes with stunning tropical and floral designs. Offers tasting sessions, tiered cakes, and cupcake towers. Gluten-free and vegan options available.', tags: ['Custom Design', 'Vegan Options', 'Tasting Session'], badge: '⭐ Top Rated', emoji: '🎂', featured: false },
  { id: 'v5', name: 'Island Dreams Decor', category: 'Decor', location: 'Smyrna, Atlanta', rating: 4.4, reviews: 112, price: '$220', priceLabel: '/ event', matchScore: 87, description: 'Full-service tropical event decoration. Palm trees, flamingo centerpieces, tiki torches, floral arches, and table settings. Setup and teardown included.', tags: ['Full Setup', 'Rentals Available', 'Floral Arches'], badge: '', emoji: '🎀', featured: false },
  { id: 'v6', name: 'Tropical Bites Catering', category: 'Catering', location: 'Sandy Springs, Atlanta', rating: 4.5, reviews: 89, price: '$18', priceLabel: '/ person', matchScore: 84, description: 'Caribbean and Latin-inspired catering with vibrant tropical flavors. Buffet and plated options available. Includes serving staff, plates, and utensils.', tags: ['Caribbean Menu', 'Staff Included', 'Dietary Options'], badge: '', emoji: '🍽️', featured: false },
]

function VendorsContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [activecat, setActivecat] = useState('All Vendors')
  const [vendors, setVendors] = useState<Vendor[]>(STATIC_VENDORS)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('Best Match')
  const [planData, setPlanData] = useState<{ location?: string; theme?: string; budget?: string; guests?: string }>({})
  const [shortlist, setShortlist] = useState<string[]>([])
  const [showShortlistOnly, setShowShortlistOnly] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)
  const [priceMax, setPriceMax] = useState(1000)
  const [ratingFilter, setRatingFilter] = useState(4)

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('partypal_shortlist') || '[]')
    setShortlist(saved)
    const stored = localStorage.getItem('partyplan')
    if (stored) {
      const p = JSON.parse(stored)
      setPlanData({ location: p.location, theme: p.theme, budget: p.budget, guests: p.guests })
    }
    const cat = params.get('cat')
    if (cat) {
      const match = CATS.find(c => c.toLowerCase() === cat.toLowerCase())
      if (match) setActivecat(match)
    }
  }, [params])

  useEffect(() => {
    if (activecat === 'Guests') { router.push('/guests'); return }
    fetchVendors(activecat)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activecat, planData])

  const fetchVendors = async (cat: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: cat === 'All Vendors' ? 'Mixed party vendors' : cat,
          location: params.get('location') || planData.location || 'Atlanta, GA',
          theme: planData.theme || '', budget: planData.budget || '', guests: planData.guests || '30',
        }),
      })
      const data = await res.json()
      if (data.vendors?.length > 0) setVendors(data.vendors)
      else setVendors(STATIC_VENDORS)
    } catch { setVendors(STATIC_VENDORS) }
    setLoading(false)
  }

  const toggleShortlist = (vendorId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setShortlist(prev => {
      const updated = prev.includes(vendorId) ? prev.filter(id => id !== vendorId) : [...prev, vendorId]
      localStorage.setItem('partypal_shortlist', JSON.stringify(updated))
      showToast(updated.includes(vendorId) ? 'Added to shortlist ❤️' : 'Removed from shortlist', updated.includes(vendorId) ? 'success' : 'info')
      return updated
    })
  }

  const filtered = vendors.filter(v => {
    if (showShortlistOnly && !shortlist.includes(v.id)) return false
    if (!search) return true
    return v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.description.toLowerCase().includes(search.toLowerCase()) ||
      v.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  }).sort((a, b) => {
    if (sort === 'Top Rated') return b.rating - a.rating
    if (sort === 'Price: Low to High') return parseInt(a.price.replace(/[^0-9]/g, '')) - parseInt(b.price.replace(/[^0-9]/g, ''))
    if (sort === 'Price: High to Low') return parseInt(b.price.replace(/[^0-9]/g, '')) - parseInt(a.price.replace(/[^0-9]/g, ''))
    if (sort === 'Most Reviews') return b.reviews - a.reviews
    return b.matchScore - a.matchScore
  })

  const location = params.get('location') || planData.location || 'Atlanta, GA'

  return (
    <main className="page-enter">
      {/* ══ HEADER ══ */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <button className="back-btn" onClick={() => router.back()}>← Back</button>
          <div className={styles.breadcrumb}>
            <a href="/">🏠 Home</a> › <span>{activecat === 'All Vendors' ? 'Vendors' : activecat + ' Vendors'}</span>
          </div>
          <h1 className={styles.headerTitle}>
            {activecat === 'All Vendors' ? 'Find Your Perfect Vendors 🔍' : `Find ${CAT_EMOJIS[activecat]} ${activecat} Vendors`}
          </h1>
          <p className={styles.headerSub}>Browse {filtered.length > 0 ? filtered.length : 697} vetted vendors in {location} — ready to make your party unforgettable.</p>
          <div className={styles.filterTabs}>
            {CATS.map(c => (
              <button key={c} className={`${styles.filterTab} ${activecat === c ? styles.filterTabActive : ''}`} onClick={() => setActivecat(c)}>
                {CAT_EMOJIS[c]} {c}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ══ SEARCH BAR ══ */}
      <div className={styles.searchBarWrap}>
        <div className={styles.searchBarInner}>
          <div className={styles.searchInputWrap}>
            <input className={styles.searchInput} type="text" placeholder="Search vendors, styles, services…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className={styles.filterBtn} onClick={() => setShowSidebar(!showSidebar)}>⚙️ Filters</button>
          <button className={`${styles.shortlistToggle} ${showShortlistOnly ? styles.shortlistActive : ''}`} onClick={() => setShowShortlistOnly(!showShortlistOnly)}>
            ❤️ Shortlist ({shortlist.length})
          </button>
          <select className={styles.sortSelect} value={sort} onChange={e => setSort(e.target.value)}>
            <option>Best Match</option>
            <option>Top Rated</option>
            <option>Price: Low to High</option>
            <option>Price: High to Low</option>
            <option>Most Reviews</option>
          </select>
        </div>
      </div>

      {/* ══ MAIN LAYOUT ══ */}
      <div className={styles.main} style={showSidebar ? {} : { gridTemplateColumns: '1fr' }}>
        {/* ── Sidebar Filters ── */}
        {showSidebar && (
          <div className={styles.sidebarFilters}>
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
              <h3>Availability</h3>
              <label className={styles.filterCheck}><input type="checkbox" defaultChecked /><label>Available for event</label><span className={styles.filterCount}>142</span></label>
              <label className={styles.filterCheck}><input type="checkbox" /><label>Weekend only</label><span className={styles.filterCount}>89</span></label>
              <label className={styles.filterCheck}><input type="checkbox" /><label>Instant Book</label><span className={styles.filterCount}>203</span></label>
            </div>
            <div className={styles.filterDivider} />

            <div className={styles.filterSection}>
              <h3>Party Size</h3>
              <label className={styles.filterCheck}><input type="checkbox" defaultChecked /><label>Up to 50 guests</label><span className={styles.filterCount}>312</span></label>
              <label className={styles.filterCheck}><input type="checkbox" /><label>50–100 guests</label><span className={styles.filterCount}>187</span></label>
              <label className={styles.filterCheck}><input type="checkbox" /><label>100+ guests</label><span className={styles.filterCount}>93</span></label>
            </div>
            <div className={styles.filterDivider} />

            <div className={styles.filterSection}>
              <h3>Style</h3>
              <label className={styles.filterCheck}><input type="checkbox" defaultChecked /><label>Tropical</label><span className={styles.filterCount}>47</span></label>
              <label className={styles.filterCheck}><input type="checkbox" /><label>Modern</label><span className={styles.filterCount}>124</span></label>
              <label className={styles.filterCheck}><input type="checkbox" /><label>Vintage / Retro</label><span className={styles.filterCount}>61</span></label>
              <label className={styles.filterCheck}><input type="checkbox" /><label>Minimalist</label><span className={styles.filterCount}>88</span></label>
              <label className={styles.filterCheck}><input type="checkbox" /><label>Bohemian</label><span className={styles.filterCount}>39</span></label>
            </div>
          </div>
        )}

        {/* ── Vendor Cards ── */}
        <div>
          <div className={styles.resultsCount}>Showing <span>{filtered.length} of {vendors.length}</span> vendors near {location}</div>

          {loading ? (
            <div className={styles.loading}>
              <div className="spinner" />
              <p>Finding the best vendors for you...</p>
            </div>
          ) : (
            <div className={styles.vendorGrid}>
              {filtered.map(v => (
                <div key={v.id} className={`${styles.vendorCard} ${v.featured ? `${styles.featured} ${styles.featuredRow}` : ''}`} onClick={() => setSelectedVendor(v)}>
                  {/* Image Area */}
                  <div className={styles.vendorCardImg} style={{ background: GRADIENTS[v.category] || 'linear-gradient(135deg, #2D4059, #1A2535)' }}>
                    {v.emoji}
                    <div className={styles.vendorBadgeWrap}>
                      {v.badge === '⭐ Top Rated' && <span className={styles.badgeTop}>⭐ Top Rated</span>}
                      {v.badge === 'New' && <span className={styles.badgeNew}>New</span>}
                      {v.matchScore >= 85 && <span className={styles.badgeMatch}>{v.matchScore}% match</span>}
                    </div>
                    <button className={`${styles.favBtn} ${shortlist.includes(v.id) ? styles.favBtnActive : ''}`} onClick={(e) => toggleShortlist(v.id, e)}>
                      {shortlist.includes(v.id) ? '❤️' : '🤍'}
                    </button>
                  </div>
                  {/* Body */}
                  <div className={styles.vendorCardBody}>
                    <div className={styles.vendorCatTag}>{v.emoji} {v.category}</div>
                    <div className={styles.vendorName}>{v.name}</div>
                    <div className={styles.vendorLocation}>📍 {v.location}</div>
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
                      <button className={styles.bookBtn} onClick={(e) => { e.stopPropagation(); showToast(`Booking request sent for ${v.name}!`, 'success') }}>Book Now →</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ VENDOR DETAIL MODAL ══ */}
      {selectedVendor && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setSelectedVendor(null) }}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div className={styles.modalVendorIcon} style={{ background: GRADIENTS[selectedVendor.category] || 'var(--light-bg)' }}>
                {selectedVendor.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div className={styles.vendorCatTag}>{selectedVendor.category}</div>
                <h2 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1.4rem', color: 'var(--navy)', marginBottom: '0.2rem' }}>{selectedVendor.name}</h2>
                <div className={styles.vendorLocation}>📍 {selectedVendor.location}</div>
                <div className={styles.vendorRating} style={{ marginTop: '0.3rem', marginBottom: 0 }}>
                  <span className="stars">{'★'.repeat(Math.floor(selectedVendor.rating))}{'☆'.repeat(5 - Math.floor(selectedVendor.rating))}</span>
                  <span className={styles.ratingNum}>{selectedVendor.rating}</span>
                  <span className={styles.reviewCount}>({selectedVendor.reviews} reviews)</span>
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
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <button className={styles.contactBtn} onClick={() => { showToast(`Booking request sent for ${selectedVendor.name}!`, 'success'); setSelectedVendor(null) }}>
                  📞 Contact & Book
                </button>
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
    </main>
  )
}

export default function Vendors() {
  return <Suspense fallback={<div style={{ textAlign: 'center', padding: '4rem' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}>
    <VendorsContent />
  </Suspense>
}
