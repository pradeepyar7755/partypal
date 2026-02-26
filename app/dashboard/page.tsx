'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './dashboard.module.css'
import { showToast } from '@/components/Toast'
import LocationSearch from '@/components/LocationSearch'

interface ChecklistItem { item: string; category: string; done: boolean; due?: string; urgent?: boolean }
interface TimelineItem { weeks: string; task: string; category: string; priority: string; emoji?: string }
interface BudgetItem { category: string; amount: number; percentage: number; color: string }
interface EventGuest { name: string; email: string; status: 'invited' | 'confirmed' | 'declined' }
interface EventVendor { name: string; category: string; notes: string; confirmed: boolean }

interface PlanData {
    eventId?: string; eventType: string; guests: string; location: string; theme: string; date: string; budget: string; time?: string; createdAt?: string
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
    const [eventGuests, setEventGuests] = useState<EventGuest[]>([])
    const [eventVendors, setEventVendors] = useState<EventVendor[]>([])
    const [guestForm, setGuestForm] = useState({ name: '', email: '' })
    const [vendorForm, setVendorForm] = useState({ name: '', category: '', notes: '' })
    const progressRefs = useRef<HTMLDivElement[]>([])

    const loadEvent = (plan: PlanData, demo: boolean) => {
        setData(plan)
        setIsDemo(demo)
        setSelectedTab('plan')
        if (!demo) localStorage.setItem('partyplan', JSON.stringify(plan))
        const TIMELINE_LABELS = ['6 wks out', '6 wks out', '4 wks out', '4 wks out', '3 wks out', '3 wks out', '2 wks out', '2 wks out', '1 wk out', 'Day before']
        const enriched = (plan.plan.checklist || []).map((item, i) => ({
            ...item,
            due: TIMELINE_LABELS[i] || `${Math.max(1, 6 - i)} wks out`,
        }))
        setChecklist(enriched)
        // Load per-event guests & vendors
        if (!demo && plan.eventId) {
            setEventGuests(JSON.parse(localStorage.getItem(`partypal_guests_${plan.eventId}`) || '[]'))
            setEventVendors(JSON.parse(localStorage.getItem(`partypal_vendors_${plan.eventId}`) || '[]'))
        } else {
            setEventGuests([])
            setEventVendors([])
        }
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
        // Sync to allEvents array
        if (updated.eventId) {
            const updatedEvents = allEvents.map(ev => ev.eventId === updated.eventId ? updated : ev)
            setAllEvents(updatedEvents)
            localStorage.setItem('partypal_events', JSON.stringify(updatedEvents))
            // Sync to Firestore
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

    // Guest management
    const addGuest = () => {
        if (!guestForm.name.trim()) return
        const updated = [...eventGuests, { name: guestForm.name.trim(), email: guestForm.email.trim(), status: 'invited' as const }]
        setEventGuests(updated)
        if (data.eventId) localStorage.setItem(`partypal_guests_${data.eventId}`, JSON.stringify(updated))
        setGuestForm({ name: '', email: '' })
        showToast('Guest added', 'success')
    }
    const removeGuest = (idx: number) => {
        const updated = eventGuests.filter((_, i) => i !== idx)
        setEventGuests(updated)
        if (data.eventId) localStorage.setItem(`partypal_guests_${data.eventId}`, JSON.stringify(updated))
    }
    const updateGuestStatus = (idx: number, status: EventGuest['status']) => {
        const updated = eventGuests.map((g, i) => i === idx ? { ...g, status } : g)
        setEventGuests(updated)
        if (data.eventId) localStorage.setItem(`partypal_guests_${data.eventId}`, JSON.stringify(updated))
    }

    // Vendor management
    const addVendor = () => {
        if (!vendorForm.name.trim() || !vendorForm.category.trim()) return
        const updated = [...eventVendors, { name: vendorForm.name.trim(), category: vendorForm.category.trim(), notes: vendorForm.notes.trim(), confirmed: false }]
        setEventVendors(updated)
        if (data.eventId) localStorage.setItem(`partypal_vendors_${data.eventId}`, JSON.stringify(updated))
        setVendorForm({ name: '', category: '', notes: '' })
        showToast('Vendor added', 'success')
    }
    const removeVendor = (idx: number) => {
        const updated = eventVendors.filter((_, i) => i !== idx)
        setEventVendors(updated)
        if (data.eventId) localStorage.setItem(`partypal_vendors_${data.eventId}`, JSON.stringify(updated))
    }
    const toggleVendorConfirmed = (idx: number) => {
        const updated = eventVendors.map((v, i) => i === idx ? { ...v, confirmed: !v.confirmed } : v)
        setEventVendors(updated)
        if (data.eventId) localStorage.setItem(`partypal_vendors_${data.eventId}`, JSON.stringify(updated))
    }

    // Countdown calculation
    const today = new Date()
    const eventDate = data.date ? new Date(data.date + 'T12:00:00') : null
    const createdDate = data.createdAt ? new Date(data.createdAt) : null
    const daysLeft = eventDate ? Math.max(0, Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))) : null
    const totalSpan = (eventDate && createdDate) ? Math.max(1, Math.ceil((eventDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))) : 42
    const elapsed = (createdDate) ? Math.max(0, Math.ceil((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))) : 0
    const countdownPct = Math.min(100, Math.max(0, Math.round((elapsed / totalSpan) * 100)))

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
                            minWidth: 200, padding: '1rem 1.2rem', borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s', position: 'relative' as const, overflow: 'hidden',
                            background: isDemo
                                ? 'repeating-linear-gradient(135deg, rgba(0,0,0,0.03), rgba(0,0,0,0.03) 8px, rgba(0,0,0,0.06) 8px, rgba(0,0,0,0.06) 16px)'
                                : 'rgba(0,0,0,0.03)',
                            border: isDemo ? '2px solid rgba(155,155,155,0.4)' : '1.5px solid rgba(0,0,0,0.08)',
                            opacity: isDemo ? 1 : 0.7,
                        }}
                    >
                        <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 4, padding: '0.1rem 0.4rem', fontSize: '0.58rem', fontWeight: 900, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>DEMO</div>
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>🎂</div>
                        <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: '0.85rem', color: isDemo ? 'var(--navy)' : '#999', marginBottom: '0.2rem' }}>Maya&apos;s 30th Birthday</div>
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
                                {ev.date ? new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'} · {ev.location || 'TBD'}
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

            {/* ══ EVENT DETAILS STRIP ══ */}
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0.5rem 1.5rem 0' }}>
                {isDemo ? (
                    /* Demo: compact disclaimer banner */
                    <div style={{
                        background: 'repeating-linear-gradient(135deg, rgba(0,0,0,0.02), rgba(0,0,0,0.02) 8px, rgba(0,0,0,0.04) 8px, rgba(0,0,0,0.04) 16px)',
                        border: '1.5px solid rgba(155,155,155,0.3)',
                        borderRadius: 10, padding: '0.6rem 1.2rem',
                        display: 'flex', alignItems: 'center', gap: '0.8rem',
                    }}>
                        <span style={{ fontSize: '1rem' }}>💡</span>
                        <div style={{ flex: 1, fontSize: '0.78rem', fontWeight: 700, color: '#888' }}>
                            For Illustration Purposes Only — this is a sample AI-generated plan.
                        </div>
                        <button onClick={() => router.push('/#wizard')} style={{
                            background: 'linear-gradient(135deg, var(--teal), #3D8C6E)', color: '#fff', border: 'none',
                            borderRadius: 8, padding: '0.4rem 1rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
                        }}>✨ Create My Plan</button>
                    </div>
                ) : (
                    /* Real event: editable details strip */
                    <div style={{
                        background: 'rgba(74,173,168,0.04)', border: '1.5px solid rgba(74,173,168,0.15)',
                        borderRadius: 12, padding: '0.8rem 1.2rem',
                    }}>
                        {!isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                                <div style={{ fontFamily: "'Fredoka One', cursive", color: 'var(--navy)', fontSize: '0.95rem', marginRight: '0.5rem' }}>
                                    {data.eventType}
                                </div>
                                {data.date && <div style={{ background: 'rgba(74,173,168,0.08)', borderRadius: 20, padding: '0.25rem 0.7rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--teal)' }}>📅 {new Date(data.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
                                <div style={{ background: 'rgba(74,173,168,0.08)', borderRadius: 20, padding: '0.25rem 0.7rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--teal)' }}>👥 {data.guests} guests</div>
                                <div style={{ background: 'rgba(74,173,168,0.08)', borderRadius: 20, padding: '0.25rem 0.7rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--teal)' }}>📍 {data.location}</div>
                                {data.theme && <div style={{ background: 'rgba(74,173,168,0.08)', borderRadius: 20, padding: '0.25rem 0.7rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--teal)' }}>🎨 {data.theme}</div>}
                                {data.budget && <div style={{ background: 'rgba(74,173,168,0.08)', borderRadius: 20, padding: '0.25rem 0.7rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--teal)' }}>💰 {data.budget}</div>}
                                <button onClick={startEditing} style={{ marginLeft: 'auto', background: 'rgba(74,173,168,0.1)', border: '1.5px solid rgba(74,173,168,0.25)', borderRadius: 8, padding: '0.3rem 0.8rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--teal)', cursor: 'pointer' }}>✏️ Edit</button>
                            </div>
                        ) : (
                            <div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem', marginBottom: '0.6rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 2, display: 'block' }}>Event Name</label>
                                        <input value={editData.eventType} onChange={e => setEditData(p => ({ ...p, eventType: e.target.value }))} style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 8, border: '1.5px solid rgba(74,173,168,0.3)', fontSize: '0.82rem', fontWeight: 700, outline: 'none', color: 'var(--navy)' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 2, display: 'block' }}>Date</label>
                                        <input type="date" value={editData.date} onChange={e => setEditData(p => ({ ...p, date: e.target.value }))} style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 8, border: '1.5px solid rgba(74,173,168,0.3)', fontSize: '0.82rem', fontWeight: 700, outline: 'none', color: 'var(--navy)' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 2, display: 'block' }}>Guests</label>
                                        <input type="number" value={editData.guests} onChange={e => setEditData(p => ({ ...p, guests: e.target.value }))} style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 8, border: '1.5px solid rgba(74,173,168,0.3)', fontSize: '0.82rem', fontWeight: 700, outline: 'none', color: 'var(--navy)' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 2, display: 'block' }}>Location</label>
                                        <LocationSearch
                                            value={editData.location}
                                            onChange={(loc) => setEditData(p => ({ ...p, location: loc }))}
                                            placeholder="Search location..."
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 2, display: 'block' }}>Theme</label>
                                        <input value={editData.theme} onChange={e => setEditData(p => ({ ...p, theme: e.target.value }))} style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 8, border: '1.5px solid rgba(74,173,168,0.3)', fontSize: '0.82rem', fontWeight: 700, outline: 'none', color: 'var(--navy)' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 2, display: 'block' }}>Budget</label>
                                        <select value={editData.budget} onChange={e => setEditData(p => ({ ...p, budget: e.target.value }))} style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 8, border: '1.5px solid rgba(74,173,168,0.3)', fontSize: '0.82rem', fontWeight: 700, outline: 'none', color: 'var(--navy)' }}>
                                            <option value="">Select...</option>
                                            <option>Under $500</option><option>$500 – $1,500</option><option>$1,500 – $5,000</option><option>$5,000 – $10,000</option><option>$10,000+</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                    <button onClick={cancelEdits} style={{ background: 'rgba(232,137,106,0.1)', border: '1.5px solid rgba(232,137,106,0.3)', borderRadius: 8, padding: '0.35rem 0.8rem', fontSize: '0.75rem', fontWeight: 800, color: '#E8896A', cursor: 'pointer' }}>✕ Cancel</button>
                                    <button onClick={saveEdits} style={{ background: 'linear-gradient(135deg, var(--teal), #3D8C6E)', border: 'none', borderRadius: 8, padding: '0.35rem 1rem', fontSize: '0.75rem', fontWeight: 800, color: '#fff', cursor: 'pointer' }}>💾 Save</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0.8rem 1.5rem 0' }}>
                <div style={{ display: 'flex', gap: '0.3rem', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: 0 }}>
                    {([['plan', '📋 Plan'], ['theme', '🎨 Theme'], ['vendors', '🏪 Vendors'], ['guests', '👥 Guests']] as const).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setSelectedTab(key)}
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



            {/* ══ THEME TAB ══ */}
            {
                selectedTab === 'theme' && (
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
                )
            }

            {/* ══ VENDORS TAB ══ */}
            {selectedTab === 'vendors' && (
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem' }}>
                    {isDemo ? (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                                {DEFAULT_VENDORS.map((v, i) => (
                                    <div key={i} className="card" style={{ padding: '1.2rem', cursor: 'pointer' }} onClick={() => router.push(`/vendors?cat=${v.cat.split(' ')[0].toLowerCase()}`)}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '1.8rem' }}>{v.emoji}</span>
                                            <span style={{ background: 'rgba(74,173,168,0.1)', color: 'var(--teal)', padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 800 }}>{v.match}% match</span>
                                        </div>
                                        <div style={{ fontFamily: "'Fredoka One', cursive", color: 'var(--navy)', fontSize: '0.95rem', marginBottom: '0.2rem' }}>{v.name}</div>
                                        <div style={{ color: '#9aabbb', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.4rem' }}>{v.cat}</div>
                                        <div style={{ color: '#F7C948', fontSize: '0.85rem', letterSpacing: 1 }}>{'★'.repeat(Math.floor(v.stars))}</div>
                                        <div style={{ color: 'var(--teal)', fontSize: '0.78rem', fontWeight: 800, marginTop: '0.4rem' }}>{v.price}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                                <button onClick={() => router.push('/vendors')} style={{ background: 'linear-gradient(135deg, var(--teal), #3D8C6E)', color: '#fff', border: 'none', borderRadius: 10, padding: '0.7rem 2rem', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>Browse All Vendors →</button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            {/* Add Vendor Form */}
                            <div className="card" style={{ padding: '1.2rem', marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '0.8rem' }}>➕ Add Vendor</div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <input placeholder="Vendor name" value={vendorForm.name} onChange={e => setVendorForm(p => ({ ...p, name: e.target.value }))} style={{ flex: 1, minWidth: 150, padding: '0.5rem 0.8rem', borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: '0.82rem', fontWeight: 600, outline: 'none' }} />
                                    <select value={vendorForm.category} onChange={e => setVendorForm(p => ({ ...p, category: e.target.value }))} style={{ padding: '0.5rem 0.8rem', borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: '0.82rem', fontWeight: 600, outline: 'none', color: vendorForm.category ? 'var(--navy)' : '#9aabbb' }}>
                                        <option value="">Category...</option>
                                        <option>Venue</option><option>Photography</option><option>Music / DJ</option><option>Catering</option><option>Baker</option><option>Florist</option><option>Decor</option><option>Other</option>
                                    </select>
                                    <input placeholder="Notes (optional)" value={vendorForm.notes} onChange={e => setVendorForm(p => ({ ...p, notes: e.target.value }))} style={{ flex: 1, minWidth: 120, padding: '0.5rem 0.8rem', borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: '0.82rem', fontWeight: 600, outline: 'none' }} />
                                    <button onClick={addVendor} style={{ background: 'linear-gradient(135deg, var(--teal), #3D8C6E)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}>Add</button>
                                </div>
                            </div>
                            {/* Vendor List */}
                            {eventVendors.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                                    {eventVendors.map((v, i) => (
                                        <div key={i} className="card" style={{ padding: '1.2rem', position: 'relative' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                <span style={{ fontFamily: "'Fredoka One', cursive", color: 'var(--navy)', fontSize: '0.9rem' }}>{v.name}</span>
                                                <button onClick={() => toggleVendorConfirmed(i)} style={{ background: v.confirmed ? 'rgba(61,140,110,0.1)' : 'rgba(0,0,0,0.04)', border: `1.5px solid ${v.confirmed ? 'rgba(61,140,110,0.3)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 6, padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 800, color: v.confirmed ? '#3D8C6E' : '#9aabbb', cursor: 'pointer' }}>
                                                    {v.confirmed ? '✅ Confirmed' : '⏳ Pending'}
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--teal)', fontWeight: 700, marginBottom: '0.2rem' }}>{v.category}</div>
                                            {v.notes && <div style={{ fontSize: '0.72rem', color: '#9aabbb', fontWeight: 600 }}>{v.notes}</div>}
                                            <button onClick={() => removeVendor(i)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#E8896A', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800 }}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', opacity: 0.5 }}>🏪</div>
                                    <p style={{ color: '#9aabbb', fontWeight: 600, fontSize: '0.82rem' }}>No vendors added yet. Add your first vendor above!</p>
                                </div>
                            )}
                            <div style={{ textAlign: 'center', marginTop: '1.2rem' }}>
                                <button onClick={() => router.push('/vendors')} style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: '0.6rem 1.5rem', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', color: 'var(--navy)' }}>Browse More Vendors →</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ══ GUESTS TAB ══ */}
            {selectedTab === 'guests' && (
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem' }}>
                    {isDemo ? (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                {[{ name: 'Alex Rivera', status: '✅ Confirmed', dietary: 'None', plus: 1 }, { name: 'Jordan Chen', status: '✅ Confirmed', dietary: 'Vegetarian', plus: 0 }, { name: 'Maya Thompson', status: '⏳ Pending', dietary: 'Gluten-Free', plus: 2 }, { name: 'Sam Williams', status: '❌ Declined', dietary: 'None', plus: 0 }, { name: 'Taylor Brooks', status: '⏳ Pending', dietary: 'Vegan', plus: 1 }, { name: 'Chris Morgan', status: '✅ Confirmed', dietary: 'Nut Allergy', plus: 0 }].map((g, i) => (
                                    <div key={i} className="card" style={{ padding: '1rem 1.2rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                            <span style={{ fontFamily: "'Fredoka One', cursive", color: 'var(--navy)', fontSize: '0.9rem' }}>{g.name}</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{g.status}</span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#9aabbb', fontWeight: 600 }}>
                                            {g.dietary !== 'None' && <span style={{ color: 'var(--teal)' }}>🍽️ {g.dietary}</span>}
                                            {g.plus > 0 && <span style={{ marginLeft: '0.5rem' }}>+{g.plus} guest{g.plus > 1 ? 's' : ''}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                                <button onClick={() => router.push('/guests')} style={{ background: 'linear-gradient(135deg, var(--teal), #3D8C6E)', color: '#fff', border: 'none', borderRadius: 10, padding: '0.7rem 2rem', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>Manage Guests & Invites →</button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            {/* Add Guest Form */}
                            <div className="card" style={{ padding: '1.2rem', marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '0.8rem' }}>➕ Add Guest</div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <input placeholder="Guest name" value={guestForm.name} onChange={e => setGuestForm(p => ({ ...p, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addGuest()} style={{ flex: 1, minWidth: 150, padding: '0.5rem 0.8rem', borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: '0.82rem', fontWeight: 600, outline: 'none' }} />
                                    <input placeholder="Email or phone (optional)" value={guestForm.email} onChange={e => setGuestForm(p => ({ ...p, email: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addGuest()} style={{ flex: 1, minWidth: 180, padding: '0.5rem 0.8rem', borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: '0.82rem', fontWeight: 600, outline: 'none' }} />
                                    <button onClick={addGuest} style={{ background: 'linear-gradient(135deg, var(--teal), #3D8C6E)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}>Add</button>
                                </div>
                            </div>
                            {/* Guest Summary */}
                            {eventGuests.length > 0 && (
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                    <div className="card" style={{ padding: '0.6rem 1rem', flex: 1, minWidth: 100, textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--navy)' }}>{eventGuests.length}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#9aabbb', fontWeight: 700 }}>Total</div>
                                    </div>
                                    <div className="card" style={{ padding: '0.6rem 1rem', flex: 1, minWidth: 100, textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#3D8C6E' }}>{eventGuests.filter(g => g.status === 'confirmed').length}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#9aabbb', fontWeight: 700 }}>Confirmed</div>
                                    </div>
                                    <div className="card" style={{ padding: '0.6rem 1rem', flex: 1, minWidth: 100, textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#F7C948' }}>{eventGuests.filter(g => g.status === 'invited').length}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#9aabbb', fontWeight: 700 }}>Invited</div>
                                    </div>
                                    <div className="card" style={{ padding: '0.6rem 1rem', flex: 1, minWidth: 100, textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#E8896A' }}>{eventGuests.filter(g => g.status === 'declined').length}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#9aabbb', fontWeight: 700 }}>Declined</div>
                                    </div>
                                </div>
                            )}
                            {/* Guest List */}
                            {eventGuests.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.8rem' }}>
                                    {eventGuests.map((g, i) => (
                                        <div key={i} className="card" style={{ padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--teal), #3D8C6E)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '0.78rem', flexShrink: 0 }}>
                                                {g.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 800, color: 'var(--navy)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                                                {g.email && <div style={{ fontSize: '0.7rem', color: '#9aabbb', fontWeight: 600 }}>{g.email}</div>}
                                            </div>
                                            <select value={g.status} onChange={e => updateGuestStatus(i, e.target.value as EventGuest['status'])} style={{ padding: '0.25rem 0.4rem', borderRadius: 6, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: '0.7rem', fontWeight: 800, outline: 'none', color: g.status === 'confirmed' ? '#3D8C6E' : g.status === 'declined' ? '#E8896A' : '#c9960a', background: g.status === 'confirmed' ? 'rgba(61,140,110,0.08)' : g.status === 'declined' ? 'rgba(232,137,106,0.08)' : 'rgba(247,201,72,0.08)' }}>
                                                <option value="invited">⏳ Invited</option>
                                                <option value="confirmed">✅ Confirmed</option>
                                                <option value="declined">❌ Declined</option>
                                            </select>
                                            <button onClick={() => removeGuest(i)} style={{ background: 'none', border: 'none', color: '#E8896A', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 800, padding: '0.2rem' }}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', opacity: 0.5 }}>👥</div>
                                    <p style={{ color: '#9aabbb', fontWeight: 600, fontSize: '0.82rem' }}>No guests added yet. Add your first guest above!</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ══ PLAN TAB (MAIN GRID) ══ */}
            {
                selectedTab === 'plan' && (
                    <>

                        {/* ══ MAIN GRID ══ */}
                        <div className={styles.main}>
                            {/* LEFT COLUMN */}
                            <div>
                                {/* ── Countdown Bar ── */}
                                {data.date && (
                                    <div className={styles.sectionCard} style={{ marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--navy)' }}>
                                                📅 Event Countdown
                                            </div>
                                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: daysLeft !== null && daysLeft <= 7 ? '#E8896A' : 'var(--teal)' }}>
                                                {daysLeft !== null ? (daysLeft === 0 ? '🎉 Today!' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`) : 'No date set'}
                                            </div>
                                        </div>
                                        <div style={{ position: 'relative', height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${countdownPct}%`, background: daysLeft !== null && daysLeft <= 7 ? 'linear-gradient(90deg, #E8896A, #e06040)' : 'linear-gradient(90deg, var(--teal), #3D8C6E)', borderRadius: 10, transition: 'width 0.8s ease' }} />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                                            <span style={{ fontSize: '0.68rem', color: '#9aabbb', fontWeight: 700 }}>📋 {createdDate ? createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Plan Created'}</span>
                                            <span style={{ fontSize: '0.68rem', color: '#9aabbb', fontWeight: 700 }}>📍 Today</span>
                                            <span style={{ fontSize: '0.68rem', color: '#9aabbb', fontWeight: 700 }}>🎉 {eventDate ? eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Event'}</span>
                                        </div>
                                    </div>
                                )}

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
                )
            }
        </main >
    )
}
