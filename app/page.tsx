'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'

const CATEGORIES = [
  { name: 'Venue', emoji: '🏛️', count: '124 options nearby', color: 'yellow', cat: 'venue' },
  { name: 'Decor', emoji: '🎀', count: '89 vendors', color: 'coral', cat: 'decor' },
  { name: 'Baker', emoji: '🎂', count: '57 bakers', color: 'yellow', cat: 'baker' },
  { name: 'Food', emoji: '🍽️', count: '210 caterers', color: 'green', cat: 'food' },
  { name: 'Photos', emoji: '📷', count: '73 photographers', color: 'slate', cat: 'photos' },
  { name: 'Music', emoji: '🎵', count: '44 DJs & bands', color: 'teal', cat: 'music' },
  { name: 'Drinks', emoji: '🥂', count: '38 bar services', color: 'dark', cat: 'drinks' },
  { name: 'Entertain', emoji: '🤹', count: '62 entertainers', color: 'yellow', cat: 'entertain' },
  { name: 'Guests', emoji: '💌', count: 'Invite & RSVP tools', color: 'sand', cat: 'guests' },
]

const FEATURES = [
  { icon: '🤖', title: 'AI Party Planner', desc: 'Get personalized checklists, timelines, and budget breakdowns based on your event details.' },
  { icon: '🎨', title: 'Theme Inspiration', desc: 'AI surfaces decor ideas, color palettes, and mood boards tailored to your theme and style.' },
  { icon: '📋', title: 'Vendor Marketplace', desc: 'Browse, compare, and book vetted vendors across all 9 categories — venues, food, music, and more.' },
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
        <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#F7C948', background: 'rgba(247,201,72,0.12)', padding: '0.3rem 0.9rem', borderRadius: 50, display: 'inline-block', marginBottom: '1rem' }}>✨ AI-Powered Party Planning</div>
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
  const [form, setForm] = useState({ eventType: '', date: '', time: '', guests: '', location: '', theme: '', budget: '' })
  const [loading, setLoading] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const [slide, setSlide] = useState(0)
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
    if (!form.eventType || !form.guests || !form.location) {
      alert('Please fill in Event Type, Number of Guests, and Location')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      localStorage.setItem('partyplan', JSON.stringify(data))
      router.push('/results')
    } catch {
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
              <div className={styles.videoTitle}>▶ How PartyPal Works <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginLeft: '0.4rem' }}>— Interactive Demo</span></div>
              <button className={styles.videoClose} onClick={closeVideo}>✕</button>
            </div>
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
          <div className={styles.heroBadge}>✨ AI-Powered Party Planning</div>
          <h1 className={styles.heroTitle}>Plan the <em>Perfect</em> Party,<br />Stress-Free</h1>
          <p className={styles.heroSub}>From venue to entertainment, connect with everything you need to throw an unforgettable celebration — powered by AI.</p>
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
        <p className="section-sub">Browse vendors and services across all 9 categories — curated, reviewed, and ready to book.</p>
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
                <label>Party Time</label>
                <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label>Number of Guests *</label>
                <input type="number" placeholder="e.g. 30" min="1" value={form.guests} onChange={e => setForm({ ...form, guests: e.target.value })} />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Location / City *</label>
                <input type="text" placeholder="e.g. Atlanta, GA" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label>Party Theme</label>
                <input type="text" placeholder="e.g. Tropical, Vintage, Neon..." value={form.theme} onChange={e => setForm({ ...form, theme: e.target.value })} />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Estimated Budget</label>
                <select value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}>
                  <option value="">Select budget range...</option>
                  <option>Under $500</option>
                  <option>$500 – $1,500</option>
                  <option>$1,500 – $5,000</option>
                  <option>$5,000 – $10,000</option>
                  <option>$10,000+</option>
                </select>
              </div>
              <div className={styles.formGroup} />
            </div>
            <button className={styles.wizardSubmit} onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', justifyContent: 'center' }}>
                  <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                  AI is planning your party...
                </span>
              ) : '🪄 Generate My Party Plan with AI'}
            </button>
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
        <div className={styles.footerLogo}>🎊 Party<span>Pal</span></div>
        <p>AI-powered party planning for unforgettable celebrations</p>
        <div className={styles.footerLinks}>
          <a href="/#wizard">Plan a Party</a>
          <a href="/vendors">Browse Vendors</a>
          <a href="/guests">Guest Management</a>
          <a href="/budget">Budget Tracker</a>
          <a href="/dashboard">My Events</a>
        </div>
        <p style={{ marginTop: '1rem', fontSize: '0.75rem' }}>partypal.social</p>
      </footer>
    </main>
  )
}
