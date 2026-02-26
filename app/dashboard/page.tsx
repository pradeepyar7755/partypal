'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './dashboard.module.css'
import { showToast } from '@/components/Toast'

interface ChecklistItem { item: string; category: string; done: boolean; due?: string; urgent?: boolean }
interface TimelineItem { weeks: string; task: string; category: string; priority: string; emoji?: string }
interface BudgetItem { category: string; amount: number; percentage: number; color: string }

interface PlanData {
    eventId?: string; eventType: string; guests: string; location: string; theme: string; date: string; budget: string; time?: string
    plan: {
        summary: string
        timeline: TimelineItem[]
        checklist: ChecklistItem[]
        budget: { total: string; breakdown: BudgetItem[] }
        tips: string[]
        moodboard?: { palette?: string[]; keywords?: string[]; vibe?: string; decorIdeas?: string[] }
    }
}

const TIMELINE_EMOJIS = ['📋', '💌', '🎀', '🍽️', '✅', '🎉']
const TIMELINE_DOTS = ['coral', 'yellow', 'teal', 'green', 'navy', 'coral']



const DEFAULT_VENDORS = [
    { emoji: '🏛️', name: 'The Loft ATL', cat: 'Venue · Midtown Atlanta', match: 98, stars: 5, price: 'From $450 / event' },
    { emoji: '📷', name: 'Lens & Light Co.', cat: 'Photography · Buckhead', match: 95, stars: 5, price: 'From $320 / event' },
    { emoji: '🎵', name: 'DJ Tropicana', cat: 'Music · DJ Services', match: 91, stars: 4.5, price: 'From $280 / event' },
    { emoji: '🎂', name: 'Sugar Blooms Bakery', cat: 'Baker · Custom Cakes', match: 89, stars: 5, price: 'From $150 / cake' },
]

const DEFAULT_PLAN: PlanData = {
    eventType: "Maya's 30th Birthday 🎂",
    guests: '40',
    location: 'Atlanta, GA',
    theme: 'Tropical',
    date: '2026-03-15',
    budget: '$2,000',
    time: '7:00 PM',
    plan: {
        summary: 'A vibrant tropical-themed birthday celebration for 40 guests in Atlanta, featuring island-inspired decor, a custom tiki bar, live DJ, and tropical cuisine.',
        timeline: [
            { weeks: 'Now — 6 Weeks Out', task: 'Lock in the Big Three', category: 'Book your venue, photographer, and DJ first — these fill up fastest. Request quotes from at least 2 vendors per category.', priority: 'high' },
            { weeks: '4 Weeks Out', task: 'Send Invitations', category: 'Send digital invites and request RSVPs by 2 weeks out. Collect dietary preferences in the RSVP form.', priority: 'medium' },
            { weeks: '3 Weeks Out', task: 'Order Decor & Cake', category: 'Place orders for tropical decor bundles and confirm your cake design with the baker. Include a tasting session if possible.', priority: 'medium' },
            { weeks: '2 Weeks Out', task: 'Finalize Food & Drinks', category: 'Confirm final headcount with caterer. Finalize your cocktail and mocktail menu. Arrange for specialty drinks if any guests need them.', priority: 'low' },
            { weeks: 'Day Before', task: 'Final Confirmations', category: 'Call each vendor to confirm arrival times. Prepare a run-of-show document and share it with your key helpers.', priority: 'low' },
        ],
        checklist: [
            { item: 'Set overall party budget', category: 'budget', done: true },
            { item: 'Choose event date & time', category: 'planning', done: true },
            { item: 'Book venue', category: 'venue', done: false },
            { item: 'Hire photographer / videographer', category: 'vendor', done: false },
            { item: 'Book DJ or live music', category: 'vendor', done: false },
            { item: 'Send digital invitations', category: 'guests', done: false },
            { item: 'Order tropical decor bundle', category: 'decor', done: false },
            { item: 'Order birthday cake from baker', category: 'food', done: false },
            { item: 'Confirm food & catering headcount', category: 'food', done: false },
            { item: 'Create party playlist backup', category: 'music', done: false },
        ],
        budget: {
            total: '$2,000',
            breakdown: [
                { category: 'Venue', amount: 450, percentage: 23, color: '#4AADA8' },
                { category: 'Catering', amount: 320, percentage: 16, color: '#E8896A' },
                { category: 'Photography', amount: 200, percentage: 10, color: '#F7C948' },
                { category: 'Music / DJ', amount: 180, percentage: 9, color: '#3D8C6E' },
                { category: 'Decor', amount: 90, percentage: 4, color: '#7B5EA7' },
            ],
        },
        tips: [
            'Book popular vendors at least 6 weeks in advance — Atlanta venues fill up fast',
            'Set aside 10% of your budget as a contingency fund for day-of surprises',
            'Create a shared playlist beforehand so your DJ knows your vibe',
        ],
    },
}

export default function Dashboard() {
    const router = useRouter()
    const [data, setData] = useState<PlanData>(DEFAULT_PLAN)
    const [allEvents, setAllEvents] = useState<PlanData[]>([])
    const [checklist, setChecklist] = useState<ChecklistItem[]>([])
    const [isDemo, setIsDemo] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editData, setEditData] = useState<{ eventType: string; date: string; guests: string; location: string; theme: string; budget: string; time?: string }>({ eventType: '', date: '', guests: '', location: '', theme: '', budget: '' })
    const [editTimeline, setEditTimeline] = useState<TimelineItem[]>([])
    const [selectedTab, setSelectedTab] = useState<'plan' | 'theme' | 'vendors' | 'guests'>('plan')
    const progressRefs = useRef<HTMLDivElement[]>([])

    const loadEvent = (plan: PlanData, demo: boolean) => {
        setData(plan)
        setIsDemo(demo)
        if (!demo) localStorage.setItem('partyplan', JSON.stringify(plan))
        const TIMELINE_LABELS = ['6 wks out', '6 wks out', '4 wks out', '4 wks out', '3 wks out', '3 wks out', '2 wks out', '2 wks out', '1 wk out', 'Day before']
        const enriched = (plan.plan.checklist || []).map((item, i) => ({
            ...item,
            due: TIMELINE_LABELS[i] || `${Math.max(1, 6 - i)} wks out`,
        }))
        setChecklist(enriched)
    }

    useEffect(() => {
        // Load all events from localStorage
        const storedEvents: PlanData[] = JSON.parse(localStorage.getItem('partypal_events') || '[]')
        // Ensure each event has an ID
        storedEvents.forEach(ev => {
            if (!ev.eventId) ev.eventId = Math.random().toString(36).substring(2, 10)
        })
        setAllEvents(storedEvents)

        // Load the active plan
        const stored = localStorage.getItem('partyplan')
        const parsed: PlanData = stored ? JSON.parse(stored) : DEFAULT_PLAN
        if (stored && !parsed.eventId) {
            parsed.eventId = Math.random().toString(36).substring(2, 10)
            localStorage.setItem('partyplan', JSON.stringify(parsed))
        }
        loadEvent(parsed, !stored)
    }, [])

    // Animate progress bars on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            progressRefs.current.forEach(bar => {
                if (bar) {
                    const targetWidth = bar.dataset.width || '0%'
                    bar.style.width = targetWidth
                }
            })
        }, 300)
        return () => clearTimeout(timer)
    }, [data])

    const toggleCheck = (i: number) => {
        setChecklist(prev => {
            const updated = prev.map((item, idx) => idx === i ? { ...item, done: !item.done } : item)
            const stored = localStorage.getItem('partyplan')
            if (stored) {
                const d = JSON.parse(stored)
                d.plan.checklist = updated.map(c => ({ item: c.item, category: c.category, done: c.done }))
                localStorage.setItem('partyplan', JSON.stringify(d))
            }
            showToast(updated[i].done ? `"${updated[i].item}" completed ✓` : `"${updated[i].item}" unmarked`, 'info')
            return updated
        })
    }

    const startEditing = () => {
        setEditData({ eventType: data.eventType, date: data.date, guests: data.guests, location: data.location, theme: data.theme, budget: data.budget, time: data.time })
        setEditTimeline(data.plan.timeline.map(t => ({ ...t })))
        setIsEditing(true)
    }

    const saveEdits = () => {
        const updated = {
            ...data,
            eventType: editData.eventType,
            date: editData.date,
            guests: editData.guests,
            location: editData.location,
            theme: editData.theme,
            budget: editData.budget,
            time: editData.time,
            plan: { ...data.plan, timeline: editTimeline },
        }
        setData(updated)
        localStorage.setItem('partyplan', JSON.stringify(updated))
        // Sync to Firestore
        if (updated.eventId) {
            fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) }).catch(() => { })
        }
        setIsEditing(false)
        showToast('Plan updated ✓', 'success')
    }

    const cancelEdits = () => setIsEditing(false)

    const allocatedAmount = data.plan.budget.breakdown.reduce((s, b) => s + b.amount, 0)
    const totalBudget = parseInt(data.budget?.replace(/[^0-9]/g, '') || '2000') || 2000
    const budgetPct = Math.min(100, Math.round((allocatedAmount / totalBudget) * 100))
    const remaining = totalBudget - allocatedAmount
    const checkDone = checklist.filter(c => c.done).length
    const checkTotal = checklist.length
    const checkPct = checkTotal > 0 ? Math.round((checkDone / checkTotal) * 100) : 0

    const progressItems = [
        { name: 'Venue', pct: 0, color: '#4AADA8' },
        { name: 'Vendors Booked', pct: 25, color: '#E8896A' },
        { name: 'Invitations', pct: 0, color: '#F7C948' },
        { name: 'Checklist', pct: checkPct, color: '#3D8C6E' },
        { name: 'Budget Set', pct: 100, color: '#7B5EA7' },
    ]

    const deleteEvent = (eventId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Delete this event?')) return
        const updated = allEvents.filter(ev => ev.eventId !== eventId)
        setAllEvents(updated)
        localStorage.setItem('partypal_events', JSON.stringify(updated))
        if (data.eventId === eventId) {
            loadEvent(DEFAULT_PLAN, true)
            localStorage.removeItem('partyplan')
        }
        showToast('Event deleted', 'success')
    }

    return (
        <main className="page-enter">
            {/* ══ HEADER ══ */}
            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <div className="breadcrumb">
                        <a href="/">🏠 Home</a> › <span className="breadcrumb current">My Events</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                        <button className="back-btn" onClick={() => router.push('/')}>← Back to Home</button>
                        {!isEditing ? (
                            <button onClick={startEditing} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '0.4rem 1rem', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>✏️ Edit Plan</button>
                        ) : (
                            <>
                                <button onClick={saveEdits} style={{ background: 'linear-gradient(135deg, #3D8C6E, #2D7050)', border: 'none', borderRadius: 8, padding: '0.4rem 1rem', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>💾 Save</button>
                                <button onClick={cancelEdits} style={{ background: 'rgba(232,137,106,0.2)', border: '1px solid rgba(232,137,106,0.4)', borderRadius: 8, padding: '0.4rem 1rem', color: '#E8896A', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>✕ Cancel</button>
                            </>
                        )}
                    </div>
                    <div className={styles.eventBadge}>🤖 AI Generated Plan</div>
                </div>
            </header>

            {/* ══ EVENT CARDS ══ */}
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem 1.5rem 0' }}>
                <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'thin' }}>
                    {/* Demo card: Maya's 30th */}
                    <div
                        onClick={() => loadEvent(DEFAULT_PLAN, true)}
                        style={{
                            minWidth: 200, padding: '1rem 1.2rem', borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s',
                            background: isDemo ? 'linear-gradient(135deg, rgba(247,201,72,0.15), rgba(232,137,106,0.1))' : 'rgba(0,0,0,0.03)',
                            border: isDemo ? '2px solid rgba(247,201,72,0.5)' : '1.5px solid rgba(0,0,0,0.08)',
                        }}
                    >
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>🎂</div>
                        <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: '0.85rem', color: 'var(--navy)', marginBottom: '0.2rem' }}>Maya&apos;s 30th Birthday</div>
                        <div style={{ fontSize: '0.7rem', color: '#9aabbb', fontWeight: 600 }}>Mar 15 · Atlanta, GA · Demo</div>
                    </div>
                    {/* User events */}
                    {allEvents.map(ev => (
                        <div
                            key={ev.eventId}
                            onClick={() => loadEvent(ev, false)}
                            style={{
                                minWidth: 200, padding: '1rem 1.2rem', borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s', position: 'relative' as const,
                                background: !isDemo && data.eventId === ev.eventId ? 'linear-gradient(135deg, rgba(74,173,168,0.15), rgba(61,140,110,0.1))' : 'rgba(0,0,0,0.03)',
                                border: !isDemo && data.eventId === ev.eventId ? '2px solid rgba(74,173,168,0.5)' : '1.5px solid rgba(0,0,0,0.08)',
                            }}
                        >
                            <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>{ev.eventType?.split(' ')[0] || '🎉'}</div>
                            <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: '0.85rem', color: 'var(--navy)', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{ev.eventType?.replace(/^[^\s]+\s/, '') || 'Party'}</div>
                            <div style={{ fontSize: '0.7rem', color: '#9aabbb', fontWeight: 600 }}>
                                {ev.date ? new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'} · {ev.location || 'TBD'}
                            </div>
                            <button
                                onClick={(e) => deleteEvent(ev.eventId!, e)}
                                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(232,137,106,0.1)', border: '1px solid rgba(232,137,106,0.3)', borderRadius: 6, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.65rem', color: '#E8896A', padding: 0, lineHeight: 1 }}
                                title="Delete event"
                            >✕</button>
                        </div>
                    ))}
                    {/* + New Party card */}
                    <div
                        onClick={() => router.push('/#wizard')}
                        style={{
                            minWidth: 160, padding: '1rem 1.2rem', borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s',
                            background: 'rgba(0,0,0,0.02)', border: '1.5px dashed rgba(0,0,0,0.12)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                        }}
                    >
                        <div style={{ fontSize: '1.5rem', opacity: 0.5 }}>➕</div>
                        <div style={{ fontSize: '0.78rem', color: '#9aabbb', fontWeight: 700 }}>Plan a Party</div>
                    </div>
                </div>
            </div>

            {/* ══ TABS ══ */}
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0.8rem 1.5rem 0' }}>
                <div style={{ display: 'flex', gap: '0.3rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 0 }}>
                    {([['plan', '📋 Plan'], ['theme', '🎨 Theme'], ['vendors', '🏪 Vendors'], ['guests', '👥 Guests']] as const).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => {
                                if (key === 'vendors') { router.push('/vendors'); return }
                                if (key === 'guests') { router.push('/guests'); return }
                                setSelectedTab(key)
                            }}
                            style={{
                                padding: '0.6rem 1.2rem', border: 'none', borderBottom: selectedTab === key ? '2.5px solid var(--teal)' : '2.5px solid transparent',
                                background: 'transparent', color: selectedTab === key ? 'var(--navy)' : '#9aabbb',
                                fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s', borderRadius: '8px 8px 0 0',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ══ DEMO DISCLAIMER ══ */}
            {isDemo && selectedTab === 'plan' && (
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(247,201,72,0.12), rgba(232,137,106,0.08))',
                        border: '1.5px solid rgba(247,201,72,0.35)',
                        borderRadius: 12,
                        padding: '1rem 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        marginBottom: '0.5rem',
                        marginTop: '-0.5rem',
                    }}>
                        <span style={{ fontSize: '1.4rem' }}>💡</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: '0.85rem', color: '#F7C948', marginBottom: 2 }}>For Illustration Purposes Only</div>
                            <div style={{ fontSize: '0.78rem', color: '#6b7c93', fontWeight: 600, lineHeight: 1.4 }}>
                                This is a sample AI-generated plan for &quot;Maya&apos;s 30th Birthday.&quot; To create your personalized party plan, use the AI planner on the homepage.
                            </div>
                        </div>
                        <button
                            onClick={() => router.push('/#wizard')}
                            style={{
                                background: 'linear-gradient(135deg, #F7C948, #E8A020)',
                                color: '#1A2535',
                                border: 'none',
                                borderRadius: 8,
                                padding: '0.6rem 1.2rem',
                                fontFamily: "'Fredoka One', cursive",
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            ✨ Create My Plan
                        </button>
                    </div>
                </div>
            )}

            {/* ══ THEME TAB ══ */}
            {selectedTab === 'theme' && (
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem' }}>
                    <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎨</div>
                        <h2 style={{ fontFamily: "'Fredoka One', cursive", color: 'var(--navy)', marginBottom: '0.5rem' }}>{data.theme ? `${data.theme} Theme` : 'Party Theme'}</h2>
                        <p style={{ color: '#9aabbb', fontWeight: 600, fontSize: '0.85rem', marginBottom: '1.5rem' }}>Mood board, color palette, and decor inspiration for your event</p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {['🌴 Tropical Vibes', '✨ Gold Accents', '🎈 Balloon Arch', '🌺 Floral Centerpieces', '🕯️ Ambient Lighting', '🍹 Tiki Bar Setup'].map((idea, i) => (
                                <div key={i} style={{ background: 'rgba(74,173,168,0.08)', borderRadius: 10, padding: '0.6rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--teal)' }}>{idea}</div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ══ PLAN TAB (MAIN GRID) ══ */}
            {selectedTab === 'plan' && (
                <>

                    {/* ══ MAIN GRID ══ */}
                    <div className={styles.main}>
                        {/* LEFT COLUMN */}
                        <div>
                            {/* ── Planning Timeline ── */}
                            <div className={styles.sectionCard}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardTitleGroup}>
                                        <span className={styles.cardIcon}>🗓️</span>
                                        <h2>Planning Timeline</h2>
                                    </div>
                                    <span className={`${styles.sourceBadge} ${styles.claudeBadge}`}>AI Generated</span>
                                </div>
                                <div className={styles.timeline}>
                                    {(isEditing ? editTimeline : data.plan.timeline).map((t, i) => (
                                        <div key={i} className={styles.timelineItem}>
                                            <div className={styles.tlLeft}>
                                                <div className={`${styles.tlDot} ${styles[`tlDot${TIMELINE_DOTS[i % TIMELINE_DOTS.length].charAt(0).toUpperCase() + TIMELINE_DOTS[i % TIMELINE_DOTS.length].slice(1)}` as keyof typeof styles]}`}>
                                                    {TIMELINE_EMOJIS[i % TIMELINE_EMOJIS.length]}
                                                </div>
                                                <div className={styles.tlLine} />
                                            </div>
                                            <div className={styles.tlContent}>
                                                {isEditing ? (
                                                    <>
                                                        <input value={t.weeks} onChange={e => setEditTimeline(prev => prev.map((item, idx) => idx === i ? { ...item, weeks: e.target.value } : item))} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(74,173,168,0.3)', borderRadius: 6, padding: '0.25rem 0.5rem', color: '#4AADA8', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.06em', width: '100%', outline: 'none', marginBottom: 4 }} />
                                                        <input value={t.task} onChange={e => setEditTimeline(prev => prev.map((item, idx) => idx === i ? { ...item, task: e.target.value } : item))} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '0.3rem 0.5rem', color: '#1A2535', fontSize: '0.9rem', fontWeight: 800, width: '100%', outline: 'none', marginBottom: 4 }} />
                                                        <textarea value={t.category} onChange={e => setEditTimeline(prev => prev.map((item, idx) => idx === i ? { ...item, category: e.target.value } : item))} rows={2} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '0.3rem 0.5rem', color: '#6b7c93', fontSize: '0.78rem', fontWeight: 600, width: '100%', outline: 'none', resize: 'vertical' as const }} />
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className={styles.tlTime}>{t.weeks}</div>
                                                        <div className={styles.tlTitle}>{t.task}</div>
                                                        {t.category && <div className={styles.tlDesc}>{t.category}</div>}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Smart Checklist ── */}
                            <div className={styles.sectionCard}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardTitleGroup}>
                                        <span className={styles.cardIcon}>✅</span>
                                        <h2>Smart Checklist</h2>
                                    </div>
                                    <span className={`${styles.sourceBadge} ${styles.claudeBadge}`}>AI Generated</span>
                                </div>
                                <div className={styles.checklist}>
                                    {checklist.map((item, i) => (
                                        <div key={i} className={`${styles.checkItem} ${item.done ? styles.checkItemDone : ''}`} onClick={() => toggleCheck(i)}>
                                            <div className={`${styles.checkBox} ${item.done ? styles.checkBoxDone : ''}`}>
                                                {item.done ? '✓' : ''}
                                            </div>
                                            <div className={`${styles.checkLabel} ${item.done ? styles.checkLabelDone : ''}`}>{item.item}</div>
                                            {item.due && <span className={styles.checkDue}>{item.due}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Top Vendor Matches ── */}
                            <div className={styles.sectionCard}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardTitleGroup}>
                                        <span className={styles.cardIcon}>⭐</span>
                                        <h2>Top Vendor Matches</h2>
                                    </div>
                                    <span className={`${styles.sourceBadge} ${styles.claudeBadge}`}>AI Generated</span>
                                </div>
                                <div className={styles.vendorRecs}>
                                    {DEFAULT_VENDORS.map((v, i) => (
                                        <div key={i} className={styles.vendorRecCard} onClick={() => router.push(`/vendors?cat=${v.cat.split(' ')[0].toLowerCase()}`)}>
                                            <div className={styles.vrecTop}>
                                                <span className={styles.vrecIcon}>{v.emoji}</span>
                                                <span className={styles.vrecMatch}>{v.match}% match</span>
                                            </div>
                                            <div className={styles.vrecName}>{v.name}</div>
                                            <div className={styles.vrecCat}>{v.cat}</div>
                                            <div className={styles.stars}>{'★'.repeat(Math.floor(v.stars))}{'½' === (v.stars % 1 ? '½' : '') ? '½' : ''}</div>
                                            <div className={styles.vrecPrice}>{v.price}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>


                        </div>

                        {/* RIGHT SIDEBAR */}
                        <div>
                            {/* ── Budget Breakdown ── */}
                            <div className={styles.sidebarCard}>
                                <div className={styles.sidebarTitle}>💰 Budget Breakdown</div>
                                <div className={styles.budgetTotal}>
                                    <div className={styles.budgetAmount}>${allocatedAmount.toLocaleString()}</div>
                                    <div className={styles.budgetLabel}>of ${totalBudget.toLocaleString()} allocated</div>
                                </div>
                                <div className={styles.budgetBarWrap}>
                                    <div className={styles.budgetBar} style={{ width: `${budgetPct}%` }} />
                                </div>
                                <div className={styles.budgetSpent}>
                                    <span>{budgetPct}% allocated</span>
                                    <span>${remaining.toLocaleString()} remaining</span>
                                </div>
                                <div className={styles.budgetItems}>
                                    {data.plan.budget.breakdown.map((b, i) => (
                                        <div key={i} className={styles.budgetItem}>
                                            <div className={styles.budgetDot} style={{ background: b.color }} />
                                            <div className={styles.budgetName}>{b.category}</div>
                                            <div className={styles.budgetVal}>${b.amount.toLocaleString()}</div>
                                            <div className={styles.budgetPct}>{b.percentage}%</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Planning Progress ── */}
                            <div className={styles.sidebarCard}>
                                <div className={styles.sidebarTitle}>📊 Planning Progress</div>
                                <div className={styles.progressList}>
                                    {progressItems.map((p, i) => (
                                        <div key={i} className={styles.progItem}>
                                            <div className={styles.progTop}>
                                                <span className={styles.progName}>{p.name}</span>
                                                <span className={styles.progPct}>{p.pct}%</span>
                                            </div>
                                            <div className={styles.progBarWrap}>
                                                <div
                                                    className={styles.progBar}
                                                    ref={el => { if (el) progressRefs.current[i] = el }}
                                                    data-width={`${p.pct}%`}
                                                    style={{ width: 0, background: p.color }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Quick Actions ── */}
                            <div className={styles.sidebarCard}>
                                <div className={styles.sidebarTitle}>⚡ Quick Actions</div>
                                <div className={styles.quickActions}>
                                    <button className={styles.qaBtn} onClick={() => router.push(`/vendors?cat=venue&location=${data.location}`)}>
                                        <span>🏛️</span><span>Browse Venues Near {data.location?.split(',')[0]}</span><span>›</span>
                                    </button>
                                    <button className={styles.qaBtn} onClick={() => router.push('/guests')}>
                                        <span>💌</span><span>Send Invitations Now</span><span>›</span>
                                    </button>
                                    <button className={styles.qaBtn} onClick={() => router.push('/budget')}>
                                        <span>🤖</span><span>Ask AI to Adjust Budget</span><span>›</span>
                                    </button>
                                    <button className={styles.qaBtn} onClick={() => { showToast('Export coming soon!', 'info') }}>
                                        <span>📋</span><span>Export Plan as PDF</span><span>›</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </main>
    )
}
