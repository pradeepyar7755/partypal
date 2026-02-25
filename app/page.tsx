'use client'
import { useState } from 'react'
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

const HOW_IT_WORKS = [
  { num: '1', title: 'Tell Us About Your Party', desc: 'Enter your event type, date, guest count, location and theme into our AI wizard.' },
  { num: '2', title: 'Claude Builds Your Plan', desc: 'Our AI generates a full checklist, timeline, budget breakdown and vendor shortlist in seconds.' },
  { num: '3', title: 'Browse & Book Vendors', desc: 'Explore AI-matched venues, caterers, photographers and more — all curated for your event.' },
  { num: '4', title: 'Manage Your Guests', desc: 'Send AI-written invitations, track RSVPs and manage dietary needs all in one place.' },
  { num: '5', title: 'Get Your Mood Board', desc: 'Claude designs a custom color palette, decor ideas and tablescape vision for your theme.' },
  { num: '6', title: 'Party Time! 🎉', desc: 'Show up stress-free knowing every detail has been planned, tracked and confirmed.' },
]

export default function Home() {
  const router = useRouter()
  const [form, setForm] = useState({ eventType: '', date: '', guests: '', location: '', theme: '', budget: '' })
  const [loading, setLoading] = useState(false)
  const [showVideo, setShowVideo] = useState(false)

  const scrollToWizard = () => {
    document.getElementById('wizard')?.scrollIntoView({ behavior: 'smooth' })
  }

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
    } catch (e) {
      alert('Failed to generate plan. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main>
      {/* VIDEO MODAL */}
      <div className={`${styles.videoOverlay} ${showVideo ? styles.open : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setShowVideo(false) }}>
        <div className={styles.videoModal}>
          <div className={styles.videoHeader}>
            <div className={styles.videoTitle}>▶ How PartyPal Works — Interactive Demo</div>
            <button className={styles.videoClose} onClick={() => setShowVideo(false)}>✕</button>
          </div>
          <div className={styles.videoBody}>
            <div className={styles.videoSteps}>
              {HOW_IT_WORKS.map(s => (
                <div key={s.num} className={styles.videoStep}>
                  <div className={styles.videoStepNum}>{s.num}</div>
                  <div className={styles.videoStepTitle}>{s.title}</div>
                  <div className={styles.videoStepDesc}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroBadge}>✨ AI-Powered Party Planning</div>
          <h1 className={styles.heroTitle}>Plan the <em>Perfect</em> Party,<br />Stress-Free</h1>
          <p className={styles.heroSub}>From venue to entertainment, connect with everything you need to throw an unforgettable celebration — powered by Claude AI.</p>
          <div className={styles.heroBtns}>
            <button className="btn-primary" onClick={scrollToWizard}>🎊 Start Planning Free</button>
            <button className="btn-secondary" onClick={() => setShowVideo(true)}>▶ Watch How It Works</button>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <div className="section">
        <p className="section-label">All You Need</p>
        <h2 className="section-title">Everything for Your Party</h2>
        <p className="section-sub">Browse vendors and services across all 9 categories — curated, reviewed, and ready to book.</p>
        <div className={styles.catGrid}>
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
          <p className="section-label" style={{color:'rgba(255,255,255,0.6)'}}>Quick Start</p>
          <h2 className="section-title" style={{color:'white'}}>Plan Your Party in Minutes</h2>
          <p className="section-sub" style={{color:'rgba(255,255,255,0.6)'}}>Tell us about your event and Claude AI will generate a custom checklist, vendor shortlist, and budget plan instantly.</p>
          <div className="ai-badge"><div className="ai-dot" />AI-powered by Claude</div>
          <div className={styles.wizardForm}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Event Type *</label>
                <select value={form.eventType} onChange={e => setForm({...form, eventType: e.target.value})}>
                  <option value="">Select event type...</option>
                  <option>🎂 Birthday Party</option>
                  <option>💍 Engagement Party</option>
                  <option>🎓 Graduation Party</option>
                  <option>👶 Baby Shower</option>
                  <option>🏠 Housewarming</option>
                  <option>🎄 Holiday Party</option>
                  <option>💼 Corporate Event</option>
                  <option>🎉 Just a Party</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Event Date</label>
                <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Number of Guests *</label>
                <input type="number" placeholder="e.g. 30" min="1" value={form.guests} onChange={e => setForm({...form, guests: e.target.value})} />
              </div>
              <div className={styles.formGroup}>
                <label>Location / City *</label>
                <input type="text" placeholder="e.g. Atlanta, GA" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Party Theme</label>
                <input type="text" placeholder="e.g. Tropical, Vintage, Neon..." value={form.theme} onChange={e => setForm({...form, theme: e.target.value})} />
              </div>
              <div className={styles.formGroup}>
                <label>Estimated Budget</label>
                <select value={form.budget} onChange={e => setForm({...form, budget: e.target.value})}>
                  <option value="">Select budget range...</option>
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
                <span style={{display:'flex',alignItems:'center',gap:'0.7rem',justifyContent:'center'}}>
                  <span className="spinner" style={{width:20,height:20,borderWidth:2}} />
                  Claude is planning your party...
                </span>
              ) : '🪄 Generate My Party Plan with AI'}
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>🎊 Party<span>Pal</span></div>
        <p>AI-powered party planning for unforgettable celebrations</p>
        <p style={{marginTop:'0.5rem',fontSize:'0.75rem'}}>partypal.social</p>
      </footer>
    </main>
  )
}
