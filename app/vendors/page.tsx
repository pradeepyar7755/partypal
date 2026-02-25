'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './vendors.module.css'

const CATS = ['All Vendors','Venue','Decor','Baker','Food','Photos','Music','Drinks','Entertain','Guests']
const CAT_EMOJIS: Record<string,string> = {
  'All Vendors':'🌟','Venue':'🏛️','Decor':'🎀','Baker':'🎂','Food':'🍽️','Photos':'📷','Music':'🎵','Drinks':'🥂','Entertain':'🤹','Guests':'💌'
}

interface Vendor {
  id: string; name: string; category: string; location: string; rating: number
  reviews: number; price: string; priceLabel: string; matchScore: number
  description: string; tags: string[]; badge: string; emoji: string; featured: boolean
}

function VendorsContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [activecat, setActivecat] = useState('All Vendors')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [planData, setPlanData] = useState<{location?:string;theme?:string;budget?:string;guests?:string}>({})

  useEffect(() => {
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
    fetchVendors(activecat)
  }, [activecat, planData])

  const fetchVendors = async (cat: string) => {
    if (cat === 'Guests') { router.push('/guests'); return }
    setLoading(true)
    setVendors([])
    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: cat === 'All Vendors' ? 'Mixed party vendors' : cat,
          location: params.get('location') || planData.location || 'Atlanta, GA',
          theme: planData.theme || '',
          budget: planData.budget || '',
          guests: planData.guests || '30',
        }),
      })
      const data = await res.json()
      setVendors(data.vendors || [])
    } catch { setVendors([]) }
    setLoading(false)
  }

  const filtered = vendors.filter(v =>
    !search || v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.description.toLowerCase().includes(search.toLowerCase()) ||
    v.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <main>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <button className="back-btn" onClick={() => router.back()}>← Back</button>
          <div className={styles.breadcrumb}>
            <a href="/">Home</a> › <span>{activecat === 'All Vendors' ? 'All Vendors' : activecat + ' Vendors'}</span>
          </div>
          <h1 className={styles.headerTitle} id="pageHeading">
            {activecat === 'All Vendors' ? 'Find Vendors 🔍' : `Find ${CAT_EMOJIS[activecat]} ${activecat} Vendors`}
          </h1>
          <p className={styles.headerSub}>AI-curated vendors in {params.get('location') || planData.location || 'Atlanta, GA'} — reviewed and ready to book.</p>
          <div className={styles.filterTabs}>
            {CATS.map(c => (
              <button key={c} className={`${styles.filterTab} ${activecat === c ? styles.filterTabActive : ''}`} onClick={() => setActivecat(c)}>
                {CAT_EMOJIS[c]} {c}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.searchRow}>
          <input className={styles.search} placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} />
          <span className={styles.count}>{filtered.length} vendors</span>
        </div>

        {loading ? (
          <div className={styles.loading}>
            <div className="spinner" />
            <p>Claude is finding the best vendors for you...</p>
          </div>
        ) : (
          <div className={styles.vendorGrid}>
            {filtered.map(v => (
              <div key={v.id} className={`${styles.vendorCard} ${v.featured ? styles.featured : ''}`}>
                {v.badge && <div className={styles.badge}>{v.badge}</div>}
                {v.matchScore >= 90 && <div className={styles.matchBadge}>🎯 {v.matchScore}% match</div>}
                <div className={styles.vendorTop}>
                  <div className={styles.vendorIcon}>{v.emoji}</div>
                  <div>
                    <div className={styles.vendorCat}>{v.category}</div>
                    <h3 className={styles.vendorName}>{v.name}</h3>
                    <div className={styles.vendorLoc}>📍 {v.location}</div>
                  </div>
                </div>
                <div className={styles.vendorRating}>
                  {'★'.repeat(Math.round(v.rating))}{'☆'.repeat(5-Math.round(v.rating))}
                  <span>{v.rating} ({v.reviews} reviews)</span>
                </div>
                <p className={styles.vendorDesc}>{v.description}</p>
                <div className={styles.vendorTags}>
                  {v.tags.map((t,i) => <span key={i} className={styles.tag}>{t}</span>)}
                </div>
                <div className={styles.vendorBottom}>
                  <div>
                    <span className={styles.price}>{v.price}</span>
                    <span className={styles.priceLabel}> {v.priceLabel}</span>
                  </div>
                  <button className={styles.bookBtn}>Book Now</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

export default function Vendors() {
  return <Suspense fallback={<div style={{textAlign:'center',padding:'4rem'}}><div className="spinner" style={{margin:'0 auto'}} /></div>}>
    <VendorsContent />
  </Suspense>
}
