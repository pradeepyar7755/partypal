'use client'
import { userGet } from '@/lib/userStorage'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './results.module.css'

interface ChecklistItem { item: string; category: string; done: boolean }
interface TimelineItem { weeks: string; task: string; category: string; priority: string }
interface BudgetItem { category: string; amount: number; percentage: number; color: string }
interface MoodTile { emoji: string; title: string; description: string; category: string }
interface PaletteColor { hex: string; name: string; usage: string }

interface PartyPlan {
  summary: string
  timeline: TimelineItem[]
  checklist: ChecklistItem[]
  budget: { total: string; breakdown: BudgetItem[] }
  tips: string[]
  moodboard: {
    palette: string[]
    keywords: string[]
    vibe: string
    decorIdeas: string[]
    tablescape: string
    lighting: string
    musicGenre: string
  }
}

interface PlanData {
  plan: PartyPlan
  eventType: string
  guests: string
  location: string
  theme: string
  date: string
  budget: string
}

interface MoodboardData {
  title: string
  vibe: string
  palette: PaletteColor[]
  tiles: MoodTile[]
  tablescape: string
  lighting: string
  welcomeSign: string
  partyFavor: string
  hashtag: string
}

export default function Results() {
  const router = useRouter()
  const [data, setData] = useState<PlanData | null>(null)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [activeTab, setActiveTab] = useState<'plan' | 'moodboard' | 'vendors'>('plan')
  const [moodboard, setMoodboard] = useState<MoodboardData | null>(null)
  const [loadingMood, setLoadingMood] = useState(false)

  useEffect(() => {
    const stored = userGet('partyplan')
    if (!stored) { router.push('/'); return }
    const parsed: PlanData = JSON.parse(stored)
    setData(parsed)
    setChecklist(parsed.plan.checklist)
  }, [router])

  const loadMoodboard = async () => {
    if (moodboard || !data) return
    setLoadingMood(true)
    try {
      const res = await fetch('/api/moodboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: data.theme, eventType: data.eventType, budget: data.budget }),
      })
      const mb = await res.json()
      setMoodboard(mb)
    } catch { /* ignore */ }
    setLoadingMood(false)
  }

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab)
    if (tab === 'moodboard') loadMoodboard()
  }

  const toggleCheck = (i: number) => {
    setChecklist(prev => prev.map((item, idx) => idx === i ? { ...item, done: !item.done } : item))
  }

  const allocatedAmount = data?.plan.budget.breakdown.reduce((s, b) => s + b.amount, 0) ?? 0
  const totalBudget = parseInt(data?.budget?.replace(/[^0-9]/g, '') || '2000') || 2000
  const pct = Math.min(100, Math.round((allocatedAmount / totalBudget) * 100))
  const done = checklist.filter(c => c.done).length

  if (!data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '1rem' }}>
      <div className="spinner" />
      <p style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>Loading your party plan...</p>
    </div>
  )

  return (
    <main>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.eventBadge}>🤖 AI Generated Plan</div>
          <h1 className={styles.headerTitle}>{data.eventType} <em>Plan</em></h1>
          <p className={styles.headerSub}>{data.guests} guests · {data.location}{data.date ? ` · ${new Date(data.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}{data.theme ? ` · ${data.theme} theme` : ''}</p>
          <div className={styles.tabs}>
            {(['plan', 'moodboard', 'vendors'] as const).map(t => (
              <button key={t} className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`} onClick={() => handleTabChange(t)}>
                {t === 'plan' ? '📋 Party Plan' : t === 'moodboard' ? '🎨 Mood Board' : '🛍️ Vendors'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {activeTab === 'plan' && (
        <div className={styles.planLayout}>
          <div className={styles.mainCol}>
            {/* Summary */}
            <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg,rgba(247,201,72,0.08),rgba(232,137,106,0.05))' }}>
              <p style={{ fontWeight: 700, lineHeight: 1.6, color: 'var(--navy)' }}>{data.plan.summary}</p>
            </div>

            {/* Timeline */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 className={styles.cardTitle}>📅 Planning Timeline</h3>
              {data.plan.timeline.map((t, i) => (
                <div key={i} className={styles.timelineItem}>
                  <div className={styles.tlDot} style={{ background: t.priority === 'high' ? 'var(--coral)' : t.priority === 'medium' ? 'var(--yellow)' : 'var(--teal)' }} />
                  <div className={styles.tlContent}>
                    <div className={styles.tlWeeks}>{t.weeks}</div>
                    <div className={styles.tlTask}>{t.task}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Checklist */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 className={styles.cardTitle}>✅ Checklist</h3>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--teal)' }}>{done}/{checklist.length} done</span>
              </div>
              {checklist.map((item, i) => (
                <div key={i} className={styles.checkItem} onClick={() => toggleCheck(i)} style={{ opacity: item.done ? 0.55 : 1 }}>
                  <div className={styles.checkbox} style={{ background: item.done ? 'var(--green)' : 'transparent', borderColor: item.done ? 'var(--green)' : 'var(--border)' }}>
                    {item.done && <span style={{ color: 'white', fontSize: '0.7rem' }}>✓</span>}
                  </div>
                  <span style={{ textDecoration: item.done ? 'line-through' : 'none', fontWeight: 600 }}>{item.item}</span>
                </div>
              ))}
            </div>

            {/* Tips */}
            <div className="card">
              <h3 className={styles.cardTitle}>💡 AI Tips for Your Party</h3>
              {data.plan.tips.map((tip, i) => (
                <div key={i} className={styles.tip}>
                  <span className={styles.tipNum}>{i + 1}</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className={styles.sidebar}>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 className={styles.cardTitle}>💰 Budget Breakdown</h3>
              <div className={styles.budgetTotal}>${allocatedAmount.toLocaleString()} <span>allocated</span></div>
              <div className={styles.budgetBar}>
                <div className={styles.budgetFill} style={{ width: `${pct}%` }} />
              </div>
              <div style={{ fontSize: '0.75rem', color: '#9aabbb', fontWeight: 700, marginBottom: '1rem' }}>{pct}% of {data.plan.budget.total} · ${(totalBudget - allocatedAmount).toLocaleString()} remaining</div>
              {data.plan.budget.breakdown.map((b, i) => (
                <div key={i} className={styles.budgetRow}>
                  <div className={styles.budgetDot} style={{ background: b.color }} />
                  <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 700 }}>{b.category}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--navy)' }}>${b.amount}</span>
                </div>
              ))}
            </div>

            <div className="card">
              <h3 className={styles.cardTitle}>⚡ Quick Actions</h3>
              <button className={styles.qaBtn} onClick={() => router.push(`/vendors?cat=venue&location=${data.location}`)}>🏛️ Browse Venues<span>›</span></button>
              <button className={styles.qaBtn} onClick={() => router.push('/guests')}>💌 Manage Guests<span>›</span></button>
              <button className={styles.qaBtn} onClick={() => router.push('/budget')}>💰 Budget Tracker<span>›</span></button>
              <button className={styles.qaBtn} onClick={() => handleTabChange('moodboard')}>🎨 View Mood Board<span>›</span></button>
              <button className={styles.qaBtn} onClick={() => router.push('/dashboard')}>📊 Dashboard<span>›</span></button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'moodboard' && (
        <div className="section">
          {loadingMood ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 700, color: 'var(--navy)' }}>Designing your mood board...</p>
            </div>
          ) : moodboard ? (
            <div>
              <h2 className="section-title">{moodboard.title}</h2>
              <p style={{ color: '#6b7f94', fontWeight: 600, marginBottom: '2rem', maxWidth: 600 }}>{moodboard.vibe}</p>
              <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>🎨 Color Palette</h3>
              <div className={styles.palette}>
                {moodboard.palette.map((c, i) => (
                  <div key={i} className={styles.paletteColor}>
                    <div className={styles.paletteSwab} style={{ background: c.hex }} />
                    <div className={styles.paletteName}>{c.name}</div>
                    <div className={styles.paletteUse}>{c.usage}</div>
                  </div>
                ))}
              </div>
              <h3 className={styles.cardTitle} style={{ margin: '2rem 0 1rem' }}>✨ Inspiration Tiles</h3>
              <div className={styles.moodGrid}>
                {moodboard.tiles.map((t, i) => (
                  <div key={i} className={styles.moodTile}>
                    <span className={styles.moodEmoji}>{t.emoji}</span>
                    <h4 className={styles.moodTileTitle}>{t.title}</h4>
                    <p className={styles.moodTileDesc}>{t.description}</p>
                  </div>
                ))}
              </div>
              <div className={styles.moodDetails}>
                {[{ label: '🍽️ Tablescape', val: moodboard.tablescape }, { label: '💡 Lighting', val: moodboard.lighting }, { label: '🎁 Party Favor', val: moodboard.partyFavor }, { label: '🪧 Welcome Sign', val: moodboard.welcomeSign }].map((d, i) => (
                  <div key={i} className="card">
                    <div style={{ fontWeight: 800, color: 'var(--navy)', marginBottom: '0.4rem' }}>{d.label}</div>
                    <p style={{ color: '#6b7f94', fontWeight: 600, lineHeight: 1.5 }}>{d.val}</p>
                  </div>
                ))}
              </div>
              <div className={styles.hashtag}>{moodboard.hashtag}</div>
            </div>
          ) : <div style={{ textAlign: 'center', padding: '3rem' }}><p>Click the Mood Board tab to generate your inspiration.</p></div>}
        </div>
      )}

      {activeTab === 'vendors' && (
        <div className="section" style={{ textAlign: 'center', padding: '4rem 2.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛍️</div>
          <h2 className="section-title">Browse Vendors</h2>
          <p className="section-sub" style={{ margin: '0 auto 2rem' }}>Find the perfect vendors for your {data.eventType} in {data.location}.</p>
          <button className="btn-primary" onClick={() => router.push(`/vendors?location=${data.location}&theme=${data.theme || ''}`)}>Browse All Vendors →</button>
        </div>
      )}
    </main>
  )
}
