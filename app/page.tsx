'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'
import LocationSearch from '@/components/LocationSearch'
import { userGet, userGetJSON, userSetJSON } from '@/lib/userStorage'
import { useAuth } from '@/components/AuthContext'
import { trackPlanGenerated, trackError, trackFeatureUsed } from '@/lib/analytics'

const CATEGORIES = [
  { name: 'Venue', emoji: '🏛️', count: 'Event spaces, banquet halls', color: 'yellow', cat: 'venue' },
  { name: 'Decor', emoji: '🎀', count: 'Florists, decor vendors, artists', color: 'coral', cat: 'decor' },
  { name: 'Baker', emoji: '🎂', count: 'Cakes, cupcakes, dessert bars', color: 'yellow', cat: 'baker' },
  { name: 'Food', emoji: '🍽️', count: 'Caterers, food trucks, chefs', color: 'green', cat: 'food' },
  { name: 'Photos', emoji: '📷', count: 'Photographers, videographers', color: 'slate', cat: 'photos' },
  { name: 'Music', emoji: '🎵', count: 'DJs, live bands, musicians', color: 'teal', cat: 'music' },
  { name: 'Drinks', emoji: '🥂', count: 'Bartenders, mobile bars', color: 'dark', cat: 'drinks' },
  { name: 'Entertain', emoji: '🤹', count: 'Performers, MCs, activities', color: 'yellow', cat: 'entertain' },
  { name: 'Guests', emoji: '💌', count: 'Invite & RSVP tools', color: 'sand', cat: 'guests' },
]

const FEATURES = [
  { icon: '🤖', title: 'AI Party Planner', desc: 'Get personalized checklists, timelines, and budget breakdowns based on your event details.' },
  { icon: '🎨', title: 'Theme Inspiration', desc: 'AI surfaces decor ideas, color palettes, and mood boards tailored to your theme and style.' },
  { icon: '📋', title: 'Vendor Marketplace', desc: 'Browse, compare, and book vetted vendors across various categories — venues, food, music, and more.' },
  { icon: '💌', title: 'Guest Management', desc: 'Send digital invites, track RSVPs, collect dietary preferences, and manage your guest list effortlessly.' },
  { icon: '💰', title: 'Budget Tracker', desc: 'Set a budget, track spending across categories, and get smart suggestions to stay on target.' },
  { icon: '✅', title: 'Smart Checklist', desc: 'Auto-generated to-do lists with deadlines that adapt as your event date approaches. Never miss a thing.' },
]

const DEMO_SLIDES = [
  {
    label: 'Step 1 — Welcome to PartyPal 🎉',
    url: 'partypal.social',
    content: (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#F7C948', background: 'rgba(247,201,72,0.12)', padding: '0.3rem 0.9rem', borderRadius: 50, display: 'inline-block', marginBottom: '1rem' }}>✨ AI Party Planner</div>
        <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1.6rem', color: 'white', marginBottom: '0.5rem' }}>Plan the <em style={{ color: '#F7C948', fontStyle: 'normal' }}>Perfect</em> Party</h3>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', marginBottom: '1rem' }}>From venue to entertainment — powered by AI.</p>
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
          <div style={{ background: '#F7C948', color: '#1A2535', padding: '0.5rem 1rem', borderRadius: 50, fontSize: '0.78rem', fontWeight: 800 }}>🎊 Start Planning Free</div>
          <div style={{ border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.8)', padding: '0.5rem 1rem', borderRadius: 50, fontSize: '0.78rem', fontWeight: 700 }}>▶ Watch how it works</div>
        </div>
      </div>
    )
  },
  {
    label: 'Step 2 — Browse 9 Party Categories 🗂️',
    url: 'partypal.social/#categories',
    content: (
      <div style={{ padding: '1.5rem' }}>
        <h3 style={{ fontFamily: "'Fredoka One',cursive", color: 'white', marginBottom: '1rem', textAlign: 'center' }}>Everything for Your Party</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
          {[['🏛️', 'Venue'], ['🎀', 'Decor'], ['🎂', 'Baker'], ['🍽️', 'Food'], ['📷', 'Photos'], ['🎵', 'Music'], ['🥂', 'Drinks'], ['🤹', 'Entertain'], ['💌', 'Guests']].map(([e, n]) => (
            <div key={n} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '0.6rem', textAlign: 'center', fontSize: '0.75rem', color: 'white', fontWeight: 700 }}>
              <div style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>{e}</div>{n}
            </div>
          ))}
        </div>
      </div>
    )
  },
  {
    label: 'Step 3 — Fill the AI Planning Wizard 🪄',
    url: 'partypal.social/#wizard',
    content: (
      <div style={{ padding: '1.5rem' }}>
        <h3 style={{ fontFamily: "'Fredoka One',cursive", color: 'white', marginBottom: '1rem', textAlign: 'center' }}>Plan Your Party in Minutes</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {['🎂 Birthday Party', 'March 15, 2026  ·  40 Guests', 'Atlanta, GA  ·  Tropical Theme', '$1,500 – $5,000'].map((v, i) => (
            <div key={i} style={{ background: 'rgba(247,201,72,0.08)', border: '1px solid rgba(247,201,72,0.2)', borderRadius: 8, padding: '0.5rem 0.8rem', color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', fontWeight: 700 }}>{v}</div>
          ))}
          <div style={{ background: '#F7C948', color: '#1A2535', borderRadius: 8, padding: '0.6rem', textAlign: 'center', fontSize: '0.82rem', fontWeight: 800, marginTop: '0.3rem' }}>🪄 Generate My Party Plan with AI</div>
        </div>
      </div>
    )
  },
  {
    label: 'Step 4 — Get Your AI-Generated Plan 🤖',
    url: 'partypal.social/results',
    content: (
      <div style={{ padding: '1.5rem' }}>
        <h3 style={{ fontFamily: "'Fredoka One',cursive", color: 'white', marginBottom: '1rem', textAlign: 'center' }}>Your AI Party Plan 🤖</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '0.8rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#F7C948', marginBottom: '0.4rem' }}>📅 TIMELINE</div>
            {['Book venue & photographer', 'Send invitations', 'Order decor & cake'].map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: ['#E8896A', '#F7C948', '#4AADA8'][i], flexShrink: 0 }} />
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{t}</span>
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '0.8rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#F7C948', marginBottom: '0.4rem' }}>💰 BUDGET</div>
            <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1.1rem', color: 'white' }}>$1,240</div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 50, margin: '0.3rem 0', overflow: 'hidden' }}>
              <div style={{ width: '62%', height: '100%', background: 'linear-gradient(90deg,#4AADA8,#F7C948)', borderRadius: 50 }} />
            </div>
            <div style={{ fontSize: '0.65rem', color: '#9aabbb', fontWeight: 700 }}>62% of $2,000</div>
          </div>
        </div>
      </div>
    )
  },
  {
    label: 'Step 5 — Browse AI-Matched Vendors 🛍️',
    url: 'partypal.social/vendors',
    content: (
      <div style={{ padding: '1.5rem' }}>
        <h3 style={{ fontFamily: "'Fredoka One',cursive", color: 'white', marginBottom: '1rem', textAlign: 'center' }}>Find Vendors 🔍</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[['🏛️', 'The Grand Venue', 'Midtown, Atlanta', '$800', '96% match'], ['🎂', 'Sweet Celebrations Bakery', 'Buckhead, Atlanta', '$280', '91% match']].map(([e, n, l, p, m]) => (
            <div key={n} style={{ background: 'white', borderRadius: 10, padding: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
              <div style={{ width: 36, height: 36, background: '#FFF9EE', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>{e}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#2D4059' }}>{n}</div>
                <div style={{ fontSize: '0.68rem', color: '#9aabbb', fontWeight: 600 }}>📍 {l}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: '0.9rem', color: '#2D4059' }}>{p}</div>
                <div style={{ fontSize: '0.65rem', color: '#4AADA8', fontWeight: 800 }}>{m}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },
  {
    label: 'Step 6 — Manage Guests & Send Invites 💌',
    url: 'partypal.social/guests',
    content: (
      <div style={{ padding: '1.5rem' }}>
        <h3 style={{ fontFamily: "'Fredoka One',cursive", color: 'white', marginBottom: '1rem', textAlign: 'center' }}>Guest Management 💌</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.4rem', marginBottom: '0.8rem' }}>
          {[['8', 'Going', '#3D8C6E'], ['2', 'Maybe', '#c4880a'], ['1', 'Declined', '#E8896A'], ['3', 'Pending', '#9aabbb']].map(([n, l, c]) => (
            <div key={l} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1.2rem', color: c }}>{n}</div>
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ background: 'rgba(247,201,72,0.08)', border: '1px solid rgba(247,201,72,0.2)', borderRadius: 8, padding: '0.6rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, lineHeight: 1.4 }}>
          ✉️ <strong style={{ color: '#F7C948' }}>AI Invite Ready:</strong> &quot;You&apos;re invited to Sarah&apos;s Tropical Birthday Bash! Join us March 15th...&quot;
        </div>
      </div>
    )
  },
]

const PARTICLE_COLORS = ['#F7C948', '#E8896A', '#4AADA8', '#7B5EA7', '#3D8C6E', '#C4A882']

export default function Home() {
  const router = useRouter()
  const { user } = useAuth()
  const [form, setForm] = useState({ eventType: '', date: '', guests: '', location: '', theme: '', budget: '' })
  const [locationDetails, setLocationDetails] = useState<{ lat?: number; lng?: number; name?: string; city?: string; state?: string; type?: string } | null>(null)
  const [locationTBD, setLocationTBD] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const [showDemoHover, setShowDemoHover] = useState(false)
  const [slide, setSlide] = useState(0)
  const [videoTab, setVideoTab] = useState<'interactive' | 'video'>('interactive')
  const catRef = useRef<HTMLDivElement>(null)
  const featRef = useRef<HTMLDivElement>(null)

  // Scroll reveal for cards
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const children = entry.target.querySelectorAll(`.${styles.catCard}, .${styles.featureCard}`)
            children.forEach((child, i) => {
              setTimeout(() => child.classList.add(styles.visible), i * 80)
            })
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )
    if (catRef.current) observer.observe(catRef.current)
    if (featRef.current) observer.observe(featRef.current)
    return () => observer.disconnect()
  }, [])

  const scrollToWizard = () => document.getElementById('wizard')?.scrollIntoView({ behavior: 'smooth' })

  const handleCategoryClick = (cat: string) => {
    if (cat === 'guests') { router.push('/guests'); return }
    router.push(`/vendors?cat=${cat}`)
  }

  const handleSubmit = async () => {
    if (!form.eventType || !form.guests || (!form.location && !locationTBD)) {
      alert('Please fill in Event Type, Number of Guests, and Location (or mark as TBD)')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, locationDetails }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      // Validate plan structure before storing
      if (!data.plan || !Array.isArray(data.plan.timeline) || !Array.isArray(data.plan.checklist)) {
        throw new Error('Invalid plan format received')
      }
      data.eventId = Math.random().toString(36).substring(2, 10)
      data.createdAt = new Date().toISOString()
      data.updatedAt = new Date().toISOString()
      // Store in events array for multi-event support
      const existing = userGetJSON('partypal_events', [] as Record<string, unknown>[])
      existing.push(data)
      userSetJSON('partypal_events', existing)
      // Also set as active plan for backward compat
      userSetJSON('partyplan', data)
      // Save to Firestore (include uid so sync can find this event)
      const savePayload: Record<string, unknown> = { ...data }
      if (user?.uid) savePayload.uid = user.uid
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savePayload),
      }).catch(() => { })
      trackPlanGenerated(form.eventType, form.guests, form.budget)
      router.push('/dashboard')
    } catch {
      trackError('Plan generation failed', { eventType: form.eventType })
      alert('Failed to generate plan. Please try again.')
      setLoading(false)
    }
  }

  const openVideo = () => { setSlide(0); setShowVideo(true) }
  const closeVideo = () => setShowVideo(false)
  const prevSlide = () => setSlide(s => Math.max(0, s - 1))
  const nextSlide = () => setSlide(s => Math.min(DEMO_SLIDES.length - 1, s + 1))

  // Generate confetti particles
  const particles = Array.from({ length: 20 }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    width: `${4 + Math.random() * 8}px`,
    height: `${4 + Math.random() * 8}px`,
    background: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    animationDelay: `${Math.random() * 6}s`,
    animationDuration: `${4 + Math.random() * 4}s`,
  }))

  return (
    <main className="page-enter">
      {/* VIDEO MODAL */}
      {showVideo && (
        <div className={styles.videoOverlay} onClick={(e) => { if (e.target === e.currentTarget) closeVideo() }}>
          <div className={styles.videoModal}>
            <div className={styles.videoHeader}>
              <div className={styles.videoTitle}>▶ How PartyPal Works</div>
              <button className={styles.videoClose} onClick={closeVideo}>✕</button>
            </div>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0 1rem' }}>
              <button onClick={() => setVideoTab('interactive')} style={{ flex: 1, padding: '0.5rem 0.8rem', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 800, color: videoTab === 'interactive' ? '#F7C948' : 'rgba(255,255,255,0.4)', borderBottom: videoTab === 'interactive' ? '2px solid #F7C948' : '2px solid transparent', transition: 'all 0.2s' }}>🎯 Interactive Demo</button>
              <button onClick={() => setVideoTab('video')} style={{ flex: 1, padding: '0.5rem 0.8rem', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 800, color: videoTab === 'video' ? '#F7C948' : 'rgba(255,255,255,0.4)', borderBottom: videoTab === 'video' ? '2px solid #F7C948' : '2px solid transparent', transition: 'all 0.2s' }}>🎬 Video Walkthrough</button>
            </div>
            {videoTab === 'interactive' ? (
              <>
                <div className={styles.screencast}>
                  <div className={styles.browserBar}>
                    <div className={styles.dots}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
                    </div>
                    <div className={styles.urlBar}>{DEMO_SLIDES[slide].url}</div>
                  </div>
                  <div className={styles.slideContent}>
                    {DEMO_SLIDES[slide].content}
                  </div>
                  <div className={styles.stepLabel}>{DEMO_SLIDES[slide].label}</div>
                </div>
                <div className={styles.videoControls}>
                  <button className={styles.slideBtn} onClick={prevSlide} disabled={slide === 0}>←</button>
                  <div className={styles.slideDots}>
                    {DEMO_SLIDES.map((_, i) => (
                      <div key={i} className={`${styles.slideDot} ${i === slide ? styles.slideDotActive : ''}`} onClick={() => setSlide(i)} />
                    ))}
                  </div>
                  <button className={styles.slideBtn} onClick={nextSlide} disabled={slide === DEMO_SLIDES.length - 1}>→</button>
                </div>
              </>
            ) : (
              <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: '3rem 2rem', border: '1px dashed rgba(255,255,255,0.15)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>🎬</div>
                  <h3 style={{ fontFamily: "'Fredoka One',cursive", color: 'white', marginBottom: '0.5rem' }}>Video Walkthrough Coming Soon</h3>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: 600, maxWidth: 350, margin: '0 auto' }}>We&apos;re recording a short video showing exactly how to plan your party with PartyPal. Check back soon!</p>
                  <button onClick={() => setVideoTab('interactive')} style={{ marginTop: '1rem', background: '#F7C948', color: '#1A2535', padding: '0.5rem 1.2rem', borderRadius: 50, fontSize: '0.82rem', fontWeight: 800, border: 'none', cursor: 'pointer' }}>Try the Interactive Demo →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroParticles}>
          {particles.map((p, i) => (
            <div key={i} className={styles.particle} style={p} />
          ))}
        </div>
        <div className={styles.heroInner}>
          <div className={styles.heroBadge}>✨ AI Party Planner</div>
          <h1 className={styles.heroTitle}>Plan the <em>Perfect</em> Party,<br />Stress-Free</h1>
          <p className={styles.heroSub}>From venue to entertainment, connect with everything you need to throw a memorable celebration — powered by AI.</p>
          <div className={styles.heroBtns}>
            <button className="btn-primary" onClick={scrollToWizard}>🎊 Start Planning Free</button>
            <button className="btn-secondary" onClick={openVideo}>▶ Watch how it works</button>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <div className="section">
        <p className="section-label">All You Need</p>
        <h2 className="section-title">Everything for Your Party</h2>
        <p className="section-sub">Browse vendors and services across various categories — curated, reviewed, and ready to book.</p>
        <div className={styles.catGrid} ref={catRef}>
          {CATEGORIES.map(c => (
            <div key={c.name} className={`${styles.catCard} ${styles[c.color]}`} onClick={() => handleCategoryClick(c.cat)}>
              <div className={styles.catIcon}>{c.emoji}</div>
              <div className={styles.catName}>{c.name}</div>
              <div className={styles.catCount}>{c.count}</div>
            </div>
          ))}
        </div>
      </div>


      {/* WIZARD */}
      <section className={styles.wizardSection} id="wizard">
        <div className={styles.wizardInner}>
          <p className="section-label" style={{ color: 'rgba(255,255,255,0.6)' }}>Quick Start</p>
          <h2 className="section-title" style={{ color: 'white' }}>Plan Your Party in Minutes</h2>
          <p className="section-sub" style={{ color: 'rgba(255,255,255,0.6)' }}>Tell us about your event and our AI will generate a custom checklist, vendor shortlist, and budget plan instantly.</p>
          <div className="ai-badge"><div className="ai-dot" />AI-Powered Planning</div>
          <div className={styles.wizardForm}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Event Type *</label>
                <select value={form.eventType} onChange={e => setForm({ ...form, eventType: e.target.value })}>
                  <option value="">Select event type...</option>
                  <option>🎂 Birthday Party</option>
                  <option>💍 Engagement Party</option>
                  <option>🎓 Graduation Party</option>
                  <option>👶 Baby Shower</option>
                  <option>🏠 Housewarming</option>
                  <option>🎄 Holiday Party</option>
                  <option>💼 Corporate Event</option>
                  <option>🃏 Poker Night</option>
                  <option>🎮 Game Night</option>
                  <option>👨‍👩‍👧‍👦 Family Reunion</option>
                  <option>💞 Anniversary Party</option>
                  <option>🍻 Get Together</option>
                  <option>🎉 Just a Party</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Event Date</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Number of Guests *</label>
                <input type="number" placeholder="e.g. 30" min="1" value={form.guests} onChange={e => setForm({ ...form, guests: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Location / Venue {!locationTBD && '*'}</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 700, color: locationTBD ? 'var(--teal)' : '#9aabbb', cursor: 'pointer' }}>
                    TBD
                    <input type="checkbox" checked={locationTBD} onChange={e => {
                      setLocationTBD(e.target.checked)
                      if (e.target.checked) {
                        setForm(prev => ({ ...prev, location: 'TBD' }))
                        setLocationDetails(null)
                      } else {
                        setForm(prev => ({ ...prev, location: '' }))
                      }
                    }} style={{ accentColor: 'var(--teal)' }} />
                  </label>
                </label>
                {locationTBD ? (
                  <div style={{ background: 'rgba(74,173,168,0.08)', border: '1.5px dashed rgba(74,173,168,0.3)', borderRadius: 10, padding: '1rem', textAlign: 'center', color: 'var(--teal)', fontWeight: 700, fontSize: '0.9rem' }}>
                    📍Location TBD
                  </div>
                ) : (
                  <LocationSearch
                    value={form.location}
                    onChange={(location, details) => {
                      setForm(prev => ({ ...prev, location }))
                      if (details) {
                        setLocationDetails({ lat: details.lat, lng: details.lng, name: details.name, city: details.city, state: details.state, type: details.type })
                      } else {
                        setLocationDetails(null)
                      }
                    }}
                    placeholder="Search a city, venue, or address..."
                  />
                )}
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Party Theme</label>
                <input type="text" placeholder="e.g. Tropical, Vintage, Neon..." value={form.theme} onChange={e => setForm({ ...form, theme: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label>Estimated Budget</label>
                <select value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}>
                  <option value="">AI will estimate for you...</option>
                  <option>Under $500</option>
                  <option>$500 – $1,500</option>
                  <option>$1,500 – $5,000</option>
                  <option>$5,000 – $10,000</option>
                  <option>$10,000+</option>
                </select>
              </div>
            </div>
            <button className={styles.wizardSubmit} onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', justifyContent: 'center' }}>
                  <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                  PartyPal is planning your party...
                </span>
              ) : '🪄 Generate My Party Plan with AI'}
            </button>
            {/* View Demo Plan button with hover popover */}
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginTop: '0.6rem' }}
              onMouseEnter={() => setShowDemoHover(true)}
              onMouseLeave={() => setShowDemoHover(false)}
            >
              <button onClick={() => router.push('/dashboard?demo=true')} style={{
                background: 'transparent', color: 'rgba(255,255,255,0.6)', padding: '0.5rem 1.2rem',
                borderRadius: 50, border: '1px solid rgba(255,255,255,0.2)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(74,173,168,0.5)'; e.currentTarget.style.background = 'rgba(74,173,168,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.background = 'transparent' }}
              >✨ View Demo Plan →</button>
              {showDemoHover && (
                <div style={{
                  position: 'absolute', bottom: 'calc(100% + 12px)', left: '50%', transform: 'translateX(-50%)',
                  width: 360, padding: '1.2rem 1.4rem', borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(26,37,53,0.97), rgba(45,64,89,0.97))',
                  border: '1.5px solid rgba(74,173,168,0.3)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.4)', zIndex: 50,
                  animation: 'fadeInUp 0.2s ease-out',
                  pointerEvents: 'auto',
                }}>
                  {/* Arrow */}
                  <div style={{
                    position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%) rotate(45deg)',
                    width: 12, height: 12, background: 'rgba(45,64,89,0.97)',
                    borderRight: '1.5px solid rgba(74,173,168,0.3)', borderBottom: '1.5px solid rgba(74,173,168,0.3)',
                  }} />
                  <div style={{ position: 'absolute', top: -20, right: -20, fontSize: '3.5rem', opacity: 0.06, transform: 'rotate(-15deg)' }}>🌴</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#4AADA8', background: 'rgba(74,173,168,0.15)', padding: '0.15rem 0.5rem', borderRadius: 50 }}>✨ See it in Action</span>
                  </div>
                  <h4 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1.05rem', color: 'white', marginBottom: '0.25rem' }}>Maya&apos;s 30th Birthday 🎂</h4>
                  <p style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600, fontSize: '0.78rem', marginBottom: '0.6rem', lineHeight: 1.4 }}>
                    Explore a complete AI-generated party plan — timeline, budget, vendor matches, and more.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.6rem' }}>
                    {['🎉 40 Guests', '📍 Atlanta', '🌴 Tropical', '💰 $2K'].map(tag => (
                      <span key={tag} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 50, padding: '0.15rem 0.5rem', fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{tag}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#4AADA8', fontWeight: 800, textAlign: 'center' }}>Click to explore the full demo →</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* WHY PARTYPAL */}
      <div className="section">
        <p className="section-label">Why PartyPal</p>
        <h2 className="section-title">Built to Make Planning Easy</h2>
        <p className="section-sub">Everything you need from first idea to final guest — all in one place.</p>
        <div className={styles.featuresGrid} ref={featRef}>
          {FEATURES.map(f => (
            <div key={f.title} className={styles.featureCard}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerAbout}>
            <div className={styles.footerLogo}><img src="/logo.png" alt="PartyPal" style={{ height: 36, borderRadius: 8, marginRight: '0.4rem' }} />Party<span>Pal</span></div>
            <p className={styles.footerAboutText}>
              PartyPal is your AI-powered party planning companion. We help you plan memorable celebrations by connecting you with the best vendors, managing your guests, and keeping your budget on track — all in one place.
            </p>
          </div>
          <div className={styles.footerNav}>
            <div className={styles.footerCol}>
              <h4>Plan</h4>
              <a href="/#wizard">Plan a Party</a>
              <a href="/vendors">Browse Vendors</a>
              <a href="/guests">Guest Management</a>
              <a href="/dashboard">My Events</a>
            </div>
            <div className={styles.footerCol}>
              <h4>Support</h4>
              <a href="/contact">Contact Us</a>
              <a href="/contact">FAQs</a>
              <a href="/about">About</a>
              <a href="/privacy">Privacy Policy</a>
              <a href="/terms">Terms of Service</a>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>© 2026 PartyPal · partypal.social · <a href="/privacy" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Privacy</a> · <a href="/terms" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Terms</a></p>
        </div>
      </footer>
    </main>
  )
}
