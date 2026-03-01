'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import styles from './dashboard.module.css'
import { showToast } from '@/components/Toast'
import { userGet, userSet, userGetJSON, userSetJSON, userRemove } from '@/lib/userStorage'
import LocationSearch from '@/components/LocationSearch'
import GuestManager from '@/components/GuestManager'
import { useAuth } from '@/components/AuthContext'
import { useAIContext } from '@/lib/useAIContext'
import CreatePoll from '@/components/CreatePoll'

interface ChecklistItem { item: string; category: string; done: boolean; due?: string; urgent?: boolean; completedAt?: string }
interface TimelineItem { weeks: string; task: string; category: string; priority: string; emoji?: string; completedAt?: string }
interface BudgetItem { category: string; amount: number; percentage: number; color: string }
interface EventGuest { name: string; email: string; status: 'invited' | 'confirmed' | 'declined' }
interface EventVendor { name: string; category: string; notes: string; confirmed: boolean; costEstimate?: number }
interface SavedVendor { name: string; category: string; price: string; emoji: string }

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

const CATEGORY_ICONS: Record<string, string> = { venue: '🏠', vendor: '🤝', food: '🍽️', music: '🎵', decor: '🎀', planning: '📋', guests: '💌', budget: '💰', entertainment: '🎭', catering: '🍕', photography: '📸', logistics: '🚚', custom: '📌', default: '📅' }
const CATEGORY_DOTS: Record<string, string> = { venue: 'Teal', vendor: 'Coral', food: 'Yellow', music: 'Navy', decor: 'Green', planning: 'Coral', guests: 'Yellow', budget: 'Coral', entertainment: 'Navy', catering: 'Yellow', photography: 'Teal', logistics: 'Navy', default: 'Teal' }
const TIMELINE_DOTS = ['coral', 'yellow', 'teal', 'green', 'navy', 'coral']



const DEFAULT_VENDORS = [
    { emoji: '🏛️', name: 'The Loft ATL', cat: 'Venue · Midtown Atlanta', match: 98, stars: 5, price: 'From $450 / event' },
    { emoji: '📷', name: 'Lens & Light Co.', cat: 'Photography · Buckhead', match: 95, stars: 5, price: 'From $320 / event' },
    { emoji: '🎵', name: 'DJ Tropicana', cat: 'Music · DJ Services', match: 91, stars: 4.5, price: 'From $280 / event' },
    { emoji: '🎂', name: 'Sugar Blooms Bakery', cat: 'Baker · Custom Cakes', match: 89, stars: 5, price: 'From $150 / cake' },
]

const DEFAULT_PLAN: PlanData = {
    eventId: 'demo',
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
    const { user } = useAuth()
    const [data, setData] = useState<PlanData>(DEFAULT_PLAN)
    const [dragIdx, setDragIdx] = useState<number | null>(null)
    const [allEvents, setAllEvents] = useState<PlanData[]>([])
    const [sharedEvents, setSharedEvents] = useState<PlanData[]>([])
    const [checklist, setChecklist] = useState<ChecklistItem[]>([])
    const [isDemo, setIsDemo] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editData, setEditData] = useState<{ eventType: string; date: string; guests: string; location: string; theme: string; budget: string; time?: string }>({ eventType: '', date: '', guests: '', location: '', theme: '', budget: '' })
    const [editTimeline, setEditTimeline] = useState<TimelineItem[]>([])
    const [selectedTab, setSelectedTab] = useState<'plan' | 'theme' | 'vendors' | 'guests' | 'polls'>('plan')
    const [eventGuests, setEventGuests] = useState<EventGuest[]>([])
    const [eventVendors, setEventVendors] = useState<EventVendor[]>([])
    const [savedVendors, setSavedVendors] = useState<Record<string, SavedVendor>>({})
    const [guestForm, setGuestForm] = useState({ name: '', email: '' })
    const [vendorForm, setVendorForm] = useState({ name: '', category: '', notes: '', costEstimate: '' })
    const ALL_VENDOR_CATS = ['Venue', 'Decor', 'Baker', 'Food', 'Photos', 'Music', 'Drinks', 'Entertain']
    const [enabledCats, setEnabledCats] = useState<string[]>(ALL_VENDOR_CATS)
    const [newCheckItem, setNewCheckItem] = useState('')
    const [newCheckCategory, setNewCheckCategory] = useState('')
    const [dragTaskIdx, setDragTaskIdx] = useState<number | null>(null)
    const [moveMenuIdx, setMoveMenuIdx] = useState<number | null>(null)
    const [guestSearch, setGuestSearch] = useState('')
    const [guestFilter, setGuestFilter] = useState<'all' | 'invited' | 'confirmed' | 'declined'>('all')
    const [showAddGuest, setShowAddGuest] = useState(false)
    const [showBulkImport, setShowBulkImport] = useState(false)
    const [bulkText, setBulkText] = useState('')
    const [refineTimelineInput, setRefineTimelineInput] = useState('')
    const [isRefiningTimeline, setIsRefiningTimeline] = useState(false)
    const [editTimelineMode, setEditTimelineMode] = useState(false)
    const [tasksCollapsed, setTasksCollapsed] = useState(true)
    const [showChecklistHint, setShowChecklistHint] = useState(true)
    const [showCollabModal, setShowCollabModal] = useState(false)
    const [collaborators, setCollaborators] = useState<{ email: string; name: string; role: string }[]>([])
    const [collabForm, setCollabForm] = useState({ email: '', name: '', role: 'Viewer' })
    const [editBudgetMode, setEditBudgetMode] = useState(false)
    const [editBudgetIdx, setEditBudgetIdx] = useState<number | null>(null)
    const [editBudgetValue, setEditBudgetValue] = useState('')
    const [showBudgetTips, setShowBudgetTips] = useState(false)
    const progressRefs = useRef<HTMLDivElement[]>([])
    // Cross-portal AI context
    const { getContextPayload, learn } = useAIContext(data, eventGuests)
    // Notification state
    const [showNotifyModal, setShowNotifyModal] = useState(false)
    const [pendingChanges, setPendingChanges] = useState<{ field: string; oldValue: string; newValue: string }[]>([])
    const [isSendingNotifications, setIsSendingNotifications] = useState(false)
    const [notifyResult, setNotifyResult] = useState<{ sent: number; total: number; message: string } | null>(null)
    // Poll state
    const [showPollCreator, setShowPollCreator] = useState(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [polls, setPolls] = useState<any[]>([])
    const [pollShareLink, setPollShareLink] = useState<string | null>(null)
    const [pollsLoading, setPollsLoading] = useState(false)
    const [pollDeletingId, setPollDeletingId] = useState<string | null>(null)
    const currentEventIdRef = useRef<string | undefined>(undefined)

    // Fetch polls from Firestore for a specific event
    const fetchPolls = useCallback(async (eid: string) => {
        if (!eid) return
        setPollsLoading(true)
        try {
            const res = await fetch(`/api/polls?eventId=${eid}`)
            const d = await res.json()
            setPolls(d.polls || [])
        } catch { /* silent */ }
        setPollsLoading(false)
    }, [])

    // Fetch polls when event changes — uses explicit eventId, no stale closure
    useEffect(() => {
        currentEventIdRef.current = data.eventId
        if (data.eventId) {
            fetchPolls(data.eventId)
        } else {
            setPolls([])  // No event = no polls
        }
    }, [data.eventId, fetchPolls])

    // Auto-refresh polls every 30s when on polls tab
    useEffect(() => {
        if (selectedTab !== 'polls') return
        const iv = setInterval(() => {
            const eid = currentEventIdRef.current
            if (eid) fetchPolls(eid)
        }, 30000)
        return () => clearInterval(iv)
    }, [selectedTab, fetchPolls])

    const deletePoll = async (pollId: string) => {
        if (!confirm('Delete this poll? All votes will be lost.')) return
        setPollDeletingId(pollId)
        try {
            await fetch(`/api/polls?id=${pollId}`, { method: 'DELETE' })
            setPolls(prev => prev.filter(p => p.id !== pollId))
            showToast('Poll deleted', 'success')
        } catch {
            showToast('Failed to delete', 'error')
        }
        setPollDeletingId(null)
    }

    // Helper: show business name or just street name from full location
    const shortLocation = (loc: string) => {
        if (!loc || loc === 'TBD') return loc
        // If it has a comma, the first part is often the business name
        const parts = loc.split(',')
        if (parts.length >= 3) return parts[0].trim() // business name
        if (parts.length === 2) {
            // Could be "Street, City" or "Business, City"
            const first = parts[0].trim()
            // If first part is a street-like address, trim it
            if (/^\d+/.test(first)) return first.replace(/\s+(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place)$/i, '')
            return first
        }
        return parts[0].trim()
    }

    const computeTimelineDates = (timeline: TimelineItem[], eventDate: string): TimelineItem[] => {
        if (!eventDate) return timeline
        const ev = new Date(eventDate + 'T12:00:00')
        if (isNaN(ev.getTime())) return timeline
        const evLabel = ev.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

        // Ensure an "Event Day" item exists
        const hasEventDay = timeline.some(t => /event\s*day/i.test(t.weeks) || /event\s*day/i.test(t.task))
        let items = hasEventDay ? timeline : [...timeline, {
            weeks: 'Event Day',
            task: '🎉 Event Day!',
            category: 'The big day! Do a final walkthrough, greet your guests, and enjoy every moment.',
            priority: 'high',
        }]

        return items.map(t => {
            let weeks = t.weeks
            // Parse various time offset formats
            const wMatch = weeks.match(/(\d+)\s*w(?:ee)?ks?\s*out/i)
            const dOutMatch = weeks.match(/(\d+)\s*days?\s*out/i)
            const dMatch = weeks.match(/day\s*(?:before|of\s*prep)/i)
            const eventDayMatch = /event\s*day/i.test(weeks) || /event\s*day/i.test(t.task)
            const thisWeekMatch = /this\s*week/i.test(weeks)
            const tomorrowMatch = /tomorrow/i.test(weeks)
            const todayMatch = /^today$/i.test(weeks.trim())
            let targetDate: Date | null = null
            if (eventDayMatch) {
                targetDate = new Date(ev)
            } else if (todayMatch) {
                targetDate = new Date()
            } else if (tomorrowMatch) {
                targetDate = new Date(); targetDate.setDate(targetDate.getDate() + 1)
            } else if (thisWeekMatch) {
                targetDate = new Date(); targetDate.setDate(targetDate.getDate() + 3) // mid-week
            } else if (dMatch) {
                targetDate = new Date(ev); targetDate.setDate(targetDate.getDate() - 1)
            } else if (dOutMatch) {
                const days = parseInt(dOutMatch[1])
                targetDate = new Date(ev); targetDate.setDate(targetDate.getDate() - days)
            } else if (wMatch) {
                const wks = parseInt(wMatch[1])
                targetDate = new Date(ev); targetDate.setDate(targetDate.getDate() - wks * 7)
            }
            if (targetDate && !isNaN(targetDate.getTime())) {
                const label = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                // Strip existing date prefix if present
                const cleanWeeks = weeks.replace(/^[A-Z][a-z]{2}\s\d{1,2}\s*[—–-]\s*/i, '')
                weeks = `${label} — ${cleanWeeks}`
            }
            // Strip parenthetical dates from all text fields
            const stripParenDates = (s: string) => s
                .replace(/\s*\([^)]*(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{0,2}[^)]*\)/gi, '')
                .replace(/\s*\(\d{1,2}\/\d{1,2}[^)]*\)/g, '')
            weeks = stripParenDates(weeks)
            return { ...t, weeks, task: stripParenDates(t.task), category: stripParenDates(t.category) }
        })
    }

    const loadEvent = (plan: PlanData, demo: boolean) => {
        // Ensure every plan has an eventId
        if (!plan.eventId) {
            plan.eventId = demo ? 'demo' : Math.random().toString(36).substring(2, 10)
        }
        // Compute timeline dates before setting data
        const enrichedPlan = plan.date ? { ...plan, plan: { ...plan.plan, timeline: computeTimelineDates(plan.plan.timeline, plan.date) } } : plan
        setData(enrichedPlan)
        setIsDemo(demo)
        setSelectedTab('plan')
        if (!demo) userSetJSON('partyplan', enrichedPlan)
        const TIMELINE_LABELS = ['6 wks out', '6 wks out', '4 wks out', '4 wks out', '3 wks out', '3 wks out', '2 wks out', '2 wks out', '1 wk out', 'Day before']
        const enriched = (enrichedPlan.plan.checklist || []).map((item, i) => ({
            ...item,
            due: TIMELINE_LABELS[i] || `${Math.max(1, 6 - i)} wks out`,
        }))
        setChecklist(enriched)
        // Load per-event guests & vendors
        if (!demo && plan.eventId) {
            setEventGuests(userGetJSON(`partypal_guests_${plan.eventId}`, []))
            setEventVendors(userGetJSON(`partypal_vendors_${plan.eventId}`, []))
            setCollaborators(userGetJSON(`partypal_collabs_${plan.eventId}`, []))
        } else {
            setEventGuests([])
            setEventVendors([])
            setCollaborators([])
        }
        // Load shortlisted vendors from /vendors page
        setSavedVendors(userGetJSON('partypal_shortlist_data', {}))
    }

    useEffect(() => {
        // Load all events from localStorage
        const storedEvents: PlanData[] = userGetJSON('partypal_events', [])
        // Ensure each event has an ID
        storedEvents.forEach(ev => {
            if (!ev.eventId) ev.eventId = Math.random().toString(36).substring(2, 10)
        })
        setAllEvents(storedEvents)

        // Load the active plan
        const stored = userGet('partyplan')
        const parsed: PlanData = stored ? JSON.parse(stored) : DEFAULT_PLAN
        if (stored && !parsed.eventId) {
            parsed.eventId = Math.random().toString(36).substring(2, 10)
            userSetJSON('partyplan', parsed)
        }
        loadEvent(parsed, !stored)
    }, [])

    // Fetch shared events from Firestore
    useEffect(() => {
        if (!user?.uid) return
        fetch(`/api/events/shared?uid=${user.uid}&email=${encodeURIComponent(user.email || '')}`)
            .then(r => r.json())
            .then(d => {
                setSharedEvents(d.events || [])
            })
            .catch(() => { /* silent */ })
    }, [user])

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
    }, [data, selectedTab])
    // Map checklist items to timeline items by keyword matching
    const mapChecklistToTimeline = () => {
        const timeline = data.plan.timeline
        const assigned = new Set<number>()
        const mapping: Record<number, number[]> = {}
        timeline.forEach((_, ti) => { mapping[ti] = [] })

        // Build a lookup: for each timeline item, compute its "dropdown value" (the category key used when adding tasks)
        const timelineKeys = timeline.map(t => {
            return `${t.task} ${t.category}`.split(/[\s_,/]+/).filter(w => w.length > 2).slice(0, 2).join(' ').toLowerCase() || t.task.split(' ')[0].toLowerCase()
        })

        // Pass 1: Exact category match — tasks explicitly assigned to a deliverable via dropdown
        checklist.forEach((c, ci) => {
            if (c.category === '__general__' || c.category === 'Custom' || !c.category) return
            const catLower = c.category.toLowerCase()
            // Find the timeline item whose dropdown key matches this task's category
            const matchIdx = timelineKeys.findIndex(tk => tk === catLower || catLower.includes(tk) || tk.includes(catLower))
            if (matchIdx >= 0) {
                mapping[matchIdx].push(ci)
                assigned.add(ci)
            }
        })

        // Pass 2: Keyword heuristic matching for unassigned tasks
        timeline.forEach((t, ti) => {
            const tWords = `${t.task} ${t.category}`.toLowerCase()
            checklist.forEach((c, ci) => {
                if (assigned.has(ci)) return
                if (c.category === '__general__' || c.category === 'Custom') return
                const cWords = `${c.item} ${c.category}`.toLowerCase()
                const keywords = ['venue', 'book', 'vendor', 'dj', 'music', 'photographer', 'photo', 'video',
                    'invite', 'invitation', 'rsvp', 'guest', 'send',
                    'decor', 'cake', 'order', 'decoration', 'flower',
                    'food', 'drink', 'cater', 'menu', 'cocktail',
                    'confirm', 'final', 'call', 'playlist',
                    'budget', 'cost', 'date', 'time', 'plan', 'event day']
                const matchScore = keywords.filter(kw => tWords.includes(kw) && cWords.includes(kw)).length
                const catMatch = c.category && tWords.includes(c.category.toLowerCase()) ? 2 : 0
                if (matchScore + catMatch >= 1) {
                    mapping[ti].push(ci)
                    assigned.add(ci)
                }
            })
        })

        // Pass 3: Steal from unassigned pool for empty deliverables
        const unassignedPool = checklist.map((_, ci) => ci).filter(ci => !assigned.has(ci) && checklist[ci]?.category !== '__general__' && checklist[ci]?.category !== 'Custom')
        timeline.forEach((_, ti) => {
            if (mapping[ti].length === 0 && unassignedPool.length > 0) {
                const stolen = unassignedPool.shift()!
                mapping[ti].push(stolen)
                assigned.add(stolen)
            }
        })
        const unassigned = checklist.map((_, ci) => ci).filter(ci => !assigned.has(ci))
        return { mapping, unassigned }
    }

    const toggleCheck = (i: number) => {
        setChecklist(prev => {
            const now = new Date().toISOString()
            const updated = prev.map((item, idx) => idx === i ? { ...item, done: !item.done, completedAt: !item.done ? now : undefined } : item)
            const saveChecklist = (cl: ChecklistItem[]) => {
                if (isDemo) {
                    const demoData = { ...data, plan: { ...data.plan, checklist: cl.map(c => ({ item: c.item, category: c.category, done: c.done, completedAt: c.completedAt })) } }
                    setData(demoData)
                    userSetJSON('partypal_demo', demoData)
                } else {
                    const stored = userGet('partyplan')
                    if (stored) {
                        const d = JSON.parse(stored)
                        d.plan.checklist = cl.map(c => ({ item: c.item, category: c.category, done: c.done, completedAt: c.completedAt }))
                        userSetJSON('partyplan', d)
                    }
                }
            }
            saveChecklist(updated)

            // Auto-complete timeline milestone if all its tasks are done
            const timeline = data.plan.timeline
            const { mapping } = mapChecklistToTimeline()
            let timelineChanged = false
            const updatedTimeline = timeline.map((t, ti) => {
                const taskIndices = mapping[ti]
                if (!taskIndices || taskIndices.length === 0) return t
                const allDone = taskIndices.every(ci => updated[ci]?.done)
                if (allDone && !t.completedAt) {
                    timelineChanged = true
                    return { ...t, completedAt: now }
                } else if (!allDone && t.completedAt) {
                    timelineChanged = true
                    return { ...t, completedAt: undefined }
                }
                return t
            })
            if (timelineChanged) {
                const updatedData = { ...data, plan: { ...data.plan, timeline: updatedTimeline } }
                setData(updatedData)
                if (isDemo) userSetJSON('partypal_demo', updatedData)
                else {
                    userSetJSON('partyplan', updatedData)
                    if (updatedData.eventId) {
                        const updatedEvents = allEvents.map(ev => ev.eventId === updatedData.eventId ? updatedData : ev)
                        setAllEvents(updatedEvents)
                        userSetJSON('partypal_events', updatedEvents)
                    }
                }
            }

            showToast(updated[i].done ? `"${updated[i].item}" completed ✓` : `"${updated[i].item}" unmarked`, 'info')
            return updated
        })
    }

    const addCheckItem = (targetCategory?: string) => {
        if (!newCheckItem.trim()) return
        const cat = targetCategory || newCheckCategory || '__general__'
        const newItem: ChecklistItem = { item: newCheckItem.trim(), category: cat, done: false }
        const updated = [...checklist, newItem]
        setChecklist(updated)
        const stored = userGet('partyplan')
        if (stored) {
            const d = JSON.parse(stored)
            d.plan.checklist = updated.map(c => ({ item: c.item, category: c.category, done: c.done, completedAt: c.completedAt }))
            userSetJSON('partyplan', d)
        }
        setNewCheckItem('')
        setNewCheckCategory('')
        showToast('Task added ✓', 'success')
    }

    const moveTaskToCategory = (taskIdx: number, newCategory: string) => {
        const updated = checklist.map((c, i) => i === taskIdx ? { ...c, category: newCategory } : c)
        setChecklist(updated)
        const stored = userGet('partyplan')
        if (stored) {
            const d = JSON.parse(stored)
            d.plan.checklist = updated.map(c => ({ item: c.item, category: c.category, done: c.done, completedAt: c.completedAt }))
            userSetJSON('partyplan', d)
        }
        setMoveMenuIdx(null)
        showToast('Task moved ✓', 'success')
    }

    const removeCheckItem = (i: number, e: React.MouseEvent) => {
        e.stopPropagation()
        const removed = checklist[i]
        const updated = checklist.filter((_, idx) => idx !== i)
        setChecklist(updated)
        const stored = userGet('partyplan')
        if (stored) {
            const d = JSON.parse(stored)
            d.plan.checklist = updated.map(c => ({ item: c.item, category: c.category, done: c.done, completedAt: c.completedAt }))
            userSetJSON('partyplan', d)
        }
        showToast(`"${removed.item}" removed`, 'info')
    }

    const bulkImportGuests = () => {
        if (!bulkText.trim()) return
        const lines = bulkText.split('\n').filter(l => l.trim())
        const newGuests: EventGuest[] = lines.map(line => {
            const parts = line.split(',').map(p => p.trim())
            return { name: parts[0] || 'Guest', email: parts[1] || '', status: 'invited' as const }
        })
        const updated = [...eventGuests, ...newGuests]
        setEventGuests(updated)
        if (data.eventId) userSetJSON(`partypal_guests_${data.eventId}`, updated)
        setBulkText('')
        setShowBulkImport(false)
        showToast(`${newGuests.length} guest${newGuests.length > 1 ? 's' : ''} imported`, 'success')
    }

    const startEditing = () => {
        setEditData({ eventType: data.eventType, date: data.date, guests: data.guests, location: data.location, theme: data.theme, budget: data.budget, time: data.time })
        setEditTimeline(data.plan.timeline.map(t => ({ ...t })))
        setIsEditing(true)
    }

    const saveEdits = () => {
        // Build replacement pairs for changed fields
        const replacements: [string | RegExp, string][] = []
        const oldDate = data.date
        const newDate = editData.date
        if (oldDate && newDate && oldDate !== newDate) {
            // Replace date references (e.g. "March 15" -> "April 20")
            try {
                const oldFmt = new Date(oldDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
                const newFmt = new Date(newDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
                if (oldFmt !== newFmt) replacements.push([oldFmt, newFmt])
                const oldShort = new Date(oldDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                const newShort = new Date(newDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                if (oldShort !== newShort) replacements.push([oldShort, newShort])
            } catch { /* ignore */ }
            replacements.push([oldDate, newDate])
        }
        if (data.theme && editData.theme && data.theme !== editData.theme) {
            replacements.push([data.theme, editData.theme])
            replacements.push([data.theme.toLowerCase(), editData.theme.toLowerCase()])
        }
        if (data.budget && editData.budget && data.budget !== editData.budget) {
            replacements.push([data.budget, editData.budget])
        }
        if (data.location && editData.location && data.location !== editData.location) {
            replacements.push([data.location, editData.location])
            // Also replace city part
            const oldCity = data.location.split(',')[0]?.trim()
            const newCity = editData.location.split(',')[0]?.trim()
            if (oldCity && newCity && oldCity !== newCity) replacements.push([oldCity, newCity])
        }

        // Apply replacements to text fields
        const replaceText = (text: string): string => {
            let result = text
            for (const [find, replace] of replacements) {
                if (typeof find === 'string') result = result.split(find).join(replace)
                else result = result.replace(find, replace)
            }
            return result
        }

        // Update timeline, checklist, and tips
        // Apply text replacements, then recalculate dates
        const stripParenDates = (s: string) => s.replace(/\s*\([^)]*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^)]*\)/gi, '')
        let updatedTimeline = editTimeline.map(t => ({
            ...t,
            weeks: replaceText(t.weeks),
            task: stripParenDates(replaceText(t.task)),
            category: stripParenDates(replaceText(t.category)),
        }))
        // Recalculate timeline dates using new event date
        if (editData.date) {
            updatedTimeline = computeTimelineDates(updatedTimeline, editData.date)
        }
        const updatedChecklist = (data.plan.checklist || []).map(c => ({
            ...c,
            item: replaceText(c.item),
        }))
        const updatedTips = (data.plan.tips || []).map(t => replaceText(t))

        const updated = {
            ...data,
            eventType: editData.eventType,
            date: editData.date,
            guests: editData.guests,
            location: editData.location,
            theme: editData.theme,
            budget: editData.budget,
            time: editData.time,
            plan: { ...data.plan, timeline: updatedTimeline, checklist: updatedChecklist, tips: updatedTips },
        }
        setData(updated)
        // Also update checklist state
        if (replacements.length > 0) {
            setChecklist(prev => prev.map(c => ({ ...c, item: replaceText(c.item) })))
        }
        if (isDemo) {
            userSetJSON('partypal_demo', updated)
        } else {
            userSetJSON('partyplan', updated)
            // Sync to allEvents array
            if (updated.eventId) {
                const updatedEvents = allEvents.map(ev => ev.eventId === updated.eventId ? updated : ev)
                setAllEvents(updatedEvents)
                userSetJSON('partypal_events', updatedEvents)
                // Sync to Firestore
                fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) }).catch(() => { })
            }
        }
        setIsEditing(false)
        showToast('Plan updated ✓', 'success')

        // Check for logistics changes and offer to notify guests
        if (!isDemo) {
            const logisticsChanges: { field: string; oldValue: string; newValue: string }[] = []
            if (data.date && editData.date && data.date !== editData.date) {
                const oldFmt = new Date(data.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                const newFmt = new Date(editData.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                logisticsChanges.push({ field: '📅 Date', oldValue: oldFmt, newValue: newFmt })
            }
            if (data.location && editData.location && data.location !== editData.location) {
                logisticsChanges.push({ field: '📍 Venue', oldValue: data.location, newValue: editData.location })
            }
            if (data.theme && editData.theme && data.theme !== editData.theme) {
                logisticsChanges.push({ field: '🎨 Theme', oldValue: data.theme, newValue: editData.theme })
            }
            if (data.time && editData.time && data.time !== editData.time) {
                logisticsChanges.push({ field: '🕐 Time', oldValue: data.time || 'Not set', newValue: editData.time || 'Not set' })
            }
            if (data.budget && editData.budget && data.budget !== editData.budget) {
                logisticsChanges.push({ field: '💰 Budget', oldValue: data.budget, newValue: editData.budget })
            }

            // Get guests from GuestManager storage
            const guestManagerGuests = (() => {
                try {
                    const storageKey = updated.eventId ? `partypal_eventguests_${updated.eventId}` : 'partypal_eventguests'
                    const stored = localStorage.getItem(storageKey)
                    if (stored) {
                        const parsed = JSON.parse(stored)
                        return Array.isArray(parsed) ? parsed.filter((g: { email?: string }) => g.email && g.email.includes('@')) : []
                    }
                } catch { /* silent */ }
                return []
            })()

            // Also check dashboard event guests
            const dashboardWithEmails = eventGuests.filter(g => g.email && g.email.includes('@'))
            const allGuestsWithEmails = [...guestManagerGuests, ...dashboardWithEmails.filter(dg => !guestManagerGuests.some((gg: { email: string }) => gg.email === dg.email))]

            if (logisticsChanges.length > 0 && allGuestsWithEmails.length > 0) {
                setPendingChanges(logisticsChanges)
                setNotifyResult(null)
                setShowNotifyModal(true)
            }
        }
    }

    const cancelEdits = () => setIsEditing(false)

    const allocatedAmount = data.plan.budget.breakdown.reduce((s, b) => s + b.amount, 0)
    const totalBudget = (() => {
        const b = data.budget || '$2,000'
        const nums = b.match(/[\d,]+/g)?.map(n => parseInt(n.replace(/,/g, ''))) || [2000]
        if (nums.length >= 2) return Math.round((nums[0] + nums[1]) / 2)
        return nums[0] || 2000
    })()
    const budgetPct = Math.min(100, Math.round((allocatedAmount / totalBudget) * 100))
    const remaining = totalBudget - allocatedAmount
    const checkDone = checklist.filter(c => c.done).length
    const checkTotal = checklist.length
    const checkPct = checkTotal > 0 ? Math.round((checkDone / checkTotal) * 100) : 0

    const { mapping: taskMapping, unassigned: unassignedTasks } = mapChecklistToTimeline()

    // Auto-add venue as pending vendor when location is set and not TBD
    useEffect(() => {
        if (!isDemo && data.location && data.location !== 'TBD' && data.eventId) {
            const hasVenue = eventVendors.some(v => v.category === 'Venue')
            if (!hasVenue) {
                const updated = [{ name: data.location, category: 'Venue', notes: 'From your event details', confirmed: false }, ...eventVendors]
                setEventVendors(updated)
                userSetJSON(`partypal_vendors_${data.eventId}`, updated)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.location, data.eventId, isDemo])

    const venueVendor = eventVendors.find(v => v.category === 'Venue')
    const vendorsBookedPct = enabledCats.length > 0 ? Math.round((eventVendors.filter(v => enabledCats.includes(v.category)).length / enabledCats.length) * 100) : 0
    const venuePct = venueVendor?.confirmed ? 100 : (venueVendor ? 50 : 0)

    const progressItems = [
        { name: 'Venue', pct: venuePct, color: '#4AADA8' },
        { name: 'Vendors Booked', pct: Math.min(100, vendorsBookedPct), color: '#E8896A' },
        { name: 'Invitations', pct: 0, color: '#F7C948' },
        { name: 'Checklist', pct: checkPct, color: '#3D8C6E' },
        { name: 'Budget Set', pct: 100, color: '#7B5EA7' },
    ]

    const deleteEvent = (eventId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        if (!confirm('Delete this event? This cannot be undone.')) return
        // Remove from both own events and shared events
        const updated = allEvents.filter(ev => ev.eventId !== eventId)
        setAllEvents(updated)
        userSetJSON('partypal_events', updated)
        setSharedEvents(prev => prev.filter(ev => ev.eventId !== eventId))
        // Clean up associated localStorage data
        userRemove(`partypal_guests_${eventId}`)
        userRemove(`partypal_collabs_${eventId}`)
        userRemove(`partypal_vendors_${eventId}`)
        userRemove(`partypal_polls_${eventId}`)
        if (data.eventId === eventId) {
            loadEvent(DEFAULT_PLAN, true)
            userRemove('partyplan')
        }
        // Delete from Firestore
        fetch(`/api/events?eventId=${encodeURIComponent(eventId)}`, { method: 'DELETE' }).catch(() => { })
        showToast('Event deleted', 'success')
    }

    const resignFromEvent = async (eventId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Leave this shared event? You will no longer have access.')) return
        // Remove from local shared events
        const updated = sharedEvents.filter(ev => ev.eventId !== eventId)
        setSharedEvents(updated)
        if (data.eventId === eventId) {
            loadEvent(DEFAULT_PLAN, true)
        }
        // Remove yourself from Firestore collaborators list
        if (user?.email) {
            try {
                const res = await fetch(`/api/events/shared?email=${encodeURIComponent(user.email)}`)
                const data = await res.json()
                const event = data.events?.find((e: any) => e.eventId === eventId)
                if (event?.collaborators) {
                    const updatedCollabs = event.collaborators.filter((c: any) => c.email.toLowerCase() !== user.email!.toLowerCase())
                    await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId, collaborators: updatedCollabs }) })
                }
            } catch { /* best effort */ }
        }
        showToast('You have left this shared event', 'success')
    }

    // Guest management
    const addGuest = () => {
        if (!guestForm.name.trim()) return
        const updated = [...eventGuests, { name: guestForm.name.trim(), email: guestForm.email.trim(), status: 'invited' as const }]
        setEventGuests(updated)
        if (data.eventId) userSetJSON(`partypal_guests_${data.eventId}`, updated)
        setGuestForm({ name: '', email: '' })
        showToast('Guest added', 'success')
    }
    const removeGuest = (idx: number) => {
        const updated = eventGuests.filter((_, i) => i !== idx)
        setEventGuests(updated)
        if (data.eventId) userSetJSON(`partypal_guests_${data.eventId}`, updated)
    }
    const updateGuestStatus = (idx: number, status: EventGuest['status']) => {
        const updated = eventGuests.map((g, i) => i === idx ? { ...g, status } : g)
        setEventGuests(updated)
        if (data.eventId) userSetJSON(`partypal_guests_${data.eventId}`, updated)
    }

    // Vendor management
    const addVendor = () => {
        if (!vendorForm.name.trim() || !vendorForm.category.trim()) return
        const cost = vendorForm.costEstimate ? parseFloat(vendorForm.costEstimate) : undefined
        const updated = [...eventVendors, { name: vendorForm.name.trim(), category: vendorForm.category.trim(), notes: vendorForm.notes.trim(), confirmed: false, costEstimate: cost && !isNaN(cost) ? cost : undefined }]
        setEventVendors(updated)
        if (data.eventId) userSetJSON(`partypal_vendors_${data.eventId}`, updated)
        setVendorForm({ name: '', category: '', notes: '', costEstimate: '' })
        showToast('Vendor added', 'success')
    }
    const updateVendorCost = (idx: number, cost: string) => {
        const num = cost ? parseFloat(cost) : undefined
        const updated = eventVendors.map((v, i) => i === idx ? { ...v, costEstimate: num && !isNaN(num) ? num : undefined } : v)
        setEventVendors(updated)
        if (data.eventId) userSetJSON(`partypal_vendors_${data.eventId}`, updated)
    }
    const addSavedVendorToEvent = (id: string, vendor: SavedVendor) => {
        if (eventVendors.some(v => v.name === vendor.name && v.category === vendor.category)) { showToast('Already added', 'info'); return }
        const updated = [...eventVendors, { name: vendor.name, category: vendor.category, notes: `From shortlist • ${vendor.price}`, confirmed: false }]
        setEventVendors(updated)
        if (data.eventId) userSetJSON(`partypal_vendors_${data.eventId}`, updated)
        showToast(`${vendor.name} added!`, 'success')
    }
    const totalVendorCost = eventVendors.reduce((sum, v) => sum + (v.costEstimate || 0), 0)
    const removeVendor = (idx: number) => {
        const updated = eventVendors.filter((_, i) => i !== idx)
        setEventVendors(updated)
        if (data.eventId) userSetJSON(`partypal_vendors_${data.eventId}`, updated)
    }
    const toggleVendorConfirmed = (idx: number) => {
        const updated = eventVendors.map((v, i) => i === idx ? { ...v, confirmed: !v.confirmed } : v)
        setEventVendors(updated)
        if (data.eventId) userSetJSON(`partypal_vendors_${data.eventId}`, updated)
    }
    const toggleCat = (cat: string) => setEnabledCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])

    // Refine timeline with AI
    const refineTimeline = async () => {
        if (!refineTimelineInput.trim() || isRefiningTimeline) return
        setIsRefiningTimeline(true)
        try {
            const res = await fetch('/api/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventType: data.eventType, date: data.date, guests: data.guests, location: data.location, theme: data.theme, budget: data.budget,
                    refinement: refineTimelineInput.trim(),
                    existingTimeline: JSON.stringify(data.plan.timeline),
                    ...getContextPayload(),
                })
            })
            if (!res.ok) throw new Error('Failed')
            const result = await res.json()
            if (result.plan?.timeline) {
                const updated = { ...data, plan: { ...data.plan, timeline: result.plan.timeline } }
                setData(updated)
                if (data.eventId) {
                    const events = userGetJSON<PlanData[]>('partypal_events', [])
                    const idx = events.findIndex(e => e.eventId === data.eventId)
                    if (idx >= 0) { events[idx] = updated; userSetJSON('partypal_events', events) }
                }
                showToast('Timeline refined! ✨', 'success')
                setRefineTimelineInput('')
                learn({ type: 'plan_refined', refinementText: refineTimelineInput.trim() })
            }
        } catch { showToast('Could not refine timeline', 'error') }
        setIsRefiningTimeline(false)
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.6rem' }}>
                        <a href="/" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>🏠 Home</a> › <span style={{ color: 'var(--yellow)' }}>My Events</span>
                    </div>
                    <button className="back-btn" onClick={() => router.push('/')} style={{ marginTop: 0 }}>← Back to Home</button>
                    <h1 style={{ fontFamily: "'Fredoka One', cursive", fontSize: '2.2rem', color: 'white', marginBottom: '0.4rem' }}>Plan your events with the help of AI ✨</h1>
                    <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>Create, manage, and share your party plans — all powered by AI.</p>
                </div>
            </header>

            {/* ══ EVENT CARDS ══ */}
            {(() => {
                // Compute active event's palette color for use in details strip and tabs
                const EVENT_PALETTE = [
                    { bg: 'rgba(74,173,168,0.08)', border: 'rgba(74,173,168,0.25)' },
                    { bg: 'rgba(232,137,106,0.08)', border: 'rgba(232,137,106,0.25)' },
                    { bg: 'rgba(123,94,167,0.08)', border: 'rgba(123,94,167,0.25)' },
                    { bg: 'rgba(247,201,72,0.08)', border: 'rgba(247,201,72,0.25)' },
                    { bg: 'rgba(66,133,244,0.08)', border: 'rgba(66,133,244,0.25)' },
                ]
                const sortedEvents = [...allEvents.map(e => ({ ...e, _shared: false })), ...sharedEvents.filter(se => !allEvents.some(e => e.eventId === se.eventId)).map(e => ({ ...e, _shared: true }))].sort((a, b) => {
                    const now = new Date()
                    const aDate = a.date ? new Date(a.date + 'T12:00:00') : null
                    const bDate = b.date ? new Date(b.date + 'T12:00:00') : null
                    const aIsPast = aDate ? aDate < now : false
                    const bIsPast = bDate ? bDate < now : false
                    if (aIsPast && !bIsPast) return 1
                    if (!aIsPast && bIsPast) return -1
                    if (aDate && bDate) return aIsPast ? bDate.getTime() - aDate.getTime() : aDate.getTime() - bDate.getTime()
                    return 0
                })
                const activeIdx = isDemo ? -1 : sortedEvents.findIndex(e => e.eventId === data.eventId)
                const activeColor = activeIdx >= 0 ? EVENT_PALETTE[activeIdx % EVENT_PALETTE.length] : { bg: 'transparent', border: 'transparent' }
                const demoBg = isDemo ? 'rgba(155,155,155,0.06)' : activeColor.bg
                return (<>
                    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem 0.75rem 0' }}>
                        <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
                            {/* + Plan a Party card (always first) */}
                            <div
                                onClick={() => router.push('/#wizard')}
                                style={{
                                    minWidth: 120, padding: '0.8rem 1rem', borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s',
                                    background: 'rgba(0,0,0,0.02)', border: '1.5px dashed rgba(0,0,0,0.12)',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                                }}
                            >
                                <div style={{ fontSize: '1.5rem', opacity: 0.5 }}>➕</div>
                                <div style={{ fontSize: '0.78rem', color: '#9aabbb', fontWeight: 700 }}>Plan a Party</div>
                            </div>
                            {/* All events (own + shared) sorted by date: upcoming first, past after */}
                            {sortedEvents.map((ev, idx) => {
                                const isActive = !isDemo && data.eventId === ev.eventId
                                const evDate = ev.date ? new Date(ev.date + 'T12:00:00') : null
                                const isPast = evDate ? evDate < new Date() : false
                                const isShared = (ev as any)._shared
                                const palette = [
                                    { bg: 'linear-gradient(135deg, rgba(74,173,168,0.18), rgba(61,140,110,0.12))', border: 'rgba(74,173,168,0.5)' },
                                    { bg: 'linear-gradient(135deg, rgba(232,137,106,0.18), rgba(200,100,70,0.12))', border: 'rgba(232,137,106,0.5)' },
                                    { bg: 'linear-gradient(135deg, rgba(123,94,167,0.18), rgba(100,70,150,0.12))', border: 'rgba(123,94,167,0.5)' },
                                    { bg: 'linear-gradient(135deg, rgba(247,201,72,0.20), rgba(220,170,40,0.12))', border: 'rgba(247,201,72,0.5)' },
                                    { bg: 'linear-gradient(135deg, rgba(66,133,244,0.18), rgba(40,100,200,0.12))', border: 'rgba(66,133,244,0.5)' },
                                ]
                                const color = palette[idx % palette.length]
                                return (
                                    <div
                                        key={ev.eventId}
                                        onClick={() => loadEvent(ev, false)}
                                        style={{
                                            minWidth: 150, padding: '0.8rem 1rem', borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s', position: 'relative' as const,
                                            background: isActive ? color.bg : isPast ? 'rgba(0,0,0,0.04)' : 'linear-gradient(135deg, rgba(0,0,0,0.03), rgba(0,0,0,0.06))',
                                            border: isActive ? `2px solid ${color.border}` : '1.5px solid rgba(0,0,0,0.1)',
                                            boxShadow: isActive ? `0 4px 16px ${color.border.replace('0.5', '0.2')}` : '0 1px 4px rgba(0,0,0,0.04)',
                                            opacity: isPast && !isActive ? 0.65 : 1,
                                        }}
                                    >
                                        {isPast && <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(155,155,155,0.15)', borderRadius: 4, padding: '0.1rem 0.4rem', fontSize: '0.55rem', fontWeight: 900, color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>Past Event</div>}
                                        {isShared && <div style={{ position: 'absolute', top: 6, right: 28, background: 'rgba(123,94,167,0.15)', borderRadius: 4, padding: '0.1rem 0.4rem', fontSize: '0.55rem', fontWeight: 900, color: '#7B5EA7', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>Shared</div>}
                                        <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>{ev.eventType?.split(' ')[0] || '🎉'}</div>
                                        <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: '0.8rem', color: 'var(--navy)', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{ev.eventType?.replace(/^[^\s]+\s/, '') || 'Party'}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#6b7c93', fontWeight: 700 }}>
                                            {ev.date ? new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'} · {ev.guests || '?'} guests
                                        </div>
                                        {!isShared && <button
                                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); deleteEvent(ev.eventId!, e) }}
                                            style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(232,137,106,0.15)', border: '1px solid rgba(232,137,106,0.3)', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.75rem', color: '#E8896A', padding: 0, lineHeight: 1, zIndex: 10 }}
                                            title="Delete event"
                                        >✕</button>}
                                        {isShared && <button
                                            onClick={(e) => resignFromEvent(ev.eventId!, e)}
                                            style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(123,94,167,0.1)', border: '1px solid rgba(123,94,167,0.3)', borderRadius: 6, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.6rem', color: '#7B5EA7', padding: 0, lineHeight: 1 }}
                                            title="Leave shared event"
                                        >⇥</button>}
                                    </div>
                                )
                            })}
                            {/* Demo card (always last) */}
                            <div
                                onClick={() => {
                                    const saved = userGetJSON('partypal_demo', null)
                                    loadEvent(saved || DEFAULT_PLAN, true)
                                }}
                                style={{
                                    minWidth: 150, padding: '0.8rem 1rem', borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s', position: 'relative' as const, overflow: 'hidden',
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
                                <div style={{ fontSize: '0.7rem', color: '#9aabbb', fontWeight: 600 }}>Mar 15 · 50 guests</div>
                            </div>
                        </div>
                    </div>

                    {/* ══ EVENT DETAILS STRIP ══ */}
                    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 0.75rem' }}>
                        <div style={{ background: demoBg, padding: '0.6rem 0.75rem', borderRadius: 10, transition: 'background 0.3s' }}>
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
                                    <button onClick={() => {
                                        userRemove('partypal_demo')
                                        loadEvent(DEFAULT_PLAN, true)
                                        showToast('Demo reset to original!', 'success')
                                    }} style={{
                                        background: 'transparent', color: '#999', border: '1.5px solid rgba(155,155,155,0.3)',
                                        borderRadius: 8, padding: '0.4rem 1rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
                                    }}>🔄 Reset Demo</button>
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
                                            <div style={{ background: 'rgba(74,173,168,0.08)', borderRadius: 20, padding: '0.25rem 0.7rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--teal)' }}>📍 {shortLocation(data.location)}</div>
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
                    </div>

                    {/* ══ TABS ══ */}
                    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 0.75rem' }}>
                        <div style={{ background: demoBg, borderRadius: 10, padding: '0.3rem 0.75rem', transition: 'background 0.3s' }}>
                            <div style={{ display: 'flex', gap: '0.2rem', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
                                {([['plan', '📋 Plan'], ['theme', '🎨 Theme'], ['vendors', '🏪 Vendors'], ['guests', '👥 Guests'], ['polls', '🗳️ Polls']] as const).map(([key, label]) => (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedTab(key)}
                                        style={{
                                            padding: '0.6rem 0.8rem', border: 'none', borderBottom: selectedTab === key ? '2.5px solid var(--teal)' : '2.5px solid transparent', whiteSpace: 'nowrap' as const,
                                            background: 'transparent', color: selectedTab === key ? 'var(--navy)' : '#9aabbb',
                                            fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s', borderRadius: '8px 8px 0 0',
                                        }}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </>)
            })()}


            {/* ══ THEME TAB ══ */}
            {
                selectedTab === 'theme' && (
                    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem 0.75rem' }}>
                        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎨</div>
                            <h2 style={{ fontFamily: "'Fredoka One', cursive", color: 'var(--navy)', marginBottom: '0.5rem' }}>{data.theme ? `${data.theme} Theme` : 'Party Theme'}</h2>
                            <p style={{ color: '#9aabbb', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>This feature will be coming soon!</p>
                            <p style={{ color: '#ccc', fontSize: '0.78rem', fontWeight: 600 }}>Mood boards, color palettes, and AI-curated decor inspiration — stay tuned ✨</p>
                        </div>
                    </div>
                )
            }

            {/* ══ VENDORS TAB ══ */}
            {selectedTab === 'vendors' && (
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem 0.75rem' }}>
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1.5rem' }}>
                            <div>
                                {/* Add Vendor Form */}
                                <div className="card" style={{ padding: '1.2rem', marginBottom: '1rem' }}>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '0.8rem' }}>➕ Add Vendor</div>
                                    {/* Category Toggles */}
                                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
                                        {ALL_VENDOR_CATS.map(cat => (
                                            <button key={cat} onClick={() => toggleCat(cat)} style={{ padding: '0.25rem 0.7rem', borderRadius: 20, border: `1.5px solid ${enabledCats.includes(cat) ? 'rgba(74,173,168,0.4)' : 'var(--border)'}`, background: enabledCats.includes(cat) ? 'rgba(74,173,168,0.08)' : 'transparent', color: enabledCats.includes(cat) ? 'var(--teal)' : '#9aabbb', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s' }}>{enabledCats.includes(cat) ? '✓' : ''} {cat}</button>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <input placeholder="Vendor name" value={vendorForm.name} onChange={e => setVendorForm(p => ({ ...p, name: e.target.value }))} style={{ flex: 1, minWidth: 150, padding: '0.5rem 0.8rem', borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: '0.82rem', fontWeight: 600, outline: 'none' }} />
                                        <select value={vendorForm.category} onChange={e => setVendorForm(p => ({ ...p, category: e.target.value }))} style={{ padding: '0.5rem 0.8rem', borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: '0.82rem', fontWeight: 600, outline: 'none', color: vendorForm.category ? 'var(--navy)' : '#9aabbb' }}>
                                            <option value="">Category...</option>
                                            {enabledCats.map(c => <option key={c}>{c}</option>)}
                                        </select>
                                        <input placeholder="Cost estimate $" value={vendorForm.costEstimate} onChange={e => setVendorForm(p => ({ ...p, costEstimate: e.target.value.replace(/[^0-9.]/g, '') }))} style={{ width: 110, padding: '0.5rem 0.8rem', borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: '0.82rem', fontWeight: 600, outline: 'none' }} />
                                        <input placeholder="Notes (optional)" value={vendorForm.notes} onChange={e => setVendorForm(p => ({ ...p, notes: e.target.value }))} style={{ flex: 1, minWidth: 100, padding: '0.5rem 0.8rem', borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: '0.82rem', fontWeight: 600, outline: 'none' }} />
                                        <button onClick={addVendor} style={{ background: 'linear-gradient(135deg, var(--teal), #3D8C6E)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}>Add</button>
                                    </div>
                                </div>
                                {/* Vendor List */}
                                {eventVendors.length > 0 ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                                        {eventVendors.map((v, i) => (
                                            <div key={i} className="card" style={{ padding: '1.2rem', position: 'relative' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                    <span style={{ fontFamily: "'Fredoka One', cursive", color: 'var(--navy)', fontSize: '0.9rem' }}>{v.category === 'Venue' ? shortLocation(v.name) : v.name}</span>
                                                    <button onClick={() => toggleVendorConfirmed(i)} style={{ background: v.confirmed ? 'rgba(61,140,110,0.1)' : 'rgba(0,0,0,0.04)', border: `1.5px solid ${v.confirmed ? 'rgba(61,140,110,0.3)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 6, padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 800, color: v.confirmed ? '#3D8C6E' : '#9aabbb', cursor: 'pointer' }}>
                                                        {v.confirmed ? '✅ Confirmed' : '⏳ Pending'}
                                                    </button>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--teal)', fontWeight: 700, marginBottom: '0.2rem' }}>{v.category}</div>
                                                {v.notes && <div style={{ fontSize: '0.72rem', color: '#9aabbb', fontWeight: 600, marginBottom: '0.4rem' }}>{v.notes}</div>}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9aabbb' }}>💰 Cost:</span>
                                                    <input type="number" placeholder="0" value={v.costEstimate || ''} onChange={e => updateVendorCost(i, e.target.value)} style={{ width: 80, padding: '0.3rem 0.5rem', borderRadius: 6, border: '1.5px solid rgba(0,0,0,0.1)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy)', outline: 'none' }} />
                                                </div>
                                                <button onClick={() => removeVendor(i)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#E8896A', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800 }}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1rem' }}>
                                        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', opacity: 0.5 }}>🏪</div>
                                        <p style={{ color: '#9aabbb', fontWeight: 600, fontSize: '0.82rem' }}>No vendors added yet. Add from your shortlist or manually above!</p>
                                    </div>
                                )}
                                {/* Saved / Shortlisted Vendors */}
                                {Object.keys(savedVendors).length > 0 && (
                                    <div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '0.6rem' }}>❤️ Your Shortlisted Vendors</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
                                            {Object.entries(savedVendors).map(([id, sv]) => {
                                                const alreadyAdded = eventVendors.some(v => v.name === sv.name && v.category === sv.category)
                                                return (
                                                    <div key={id} style={{ background: alreadyAdded ? 'rgba(61,140,110,0.05)' : 'white', border: `1.5px solid ${alreadyAdded ? 'rgba(61,140,110,0.2)' : 'var(--border)'}`, borderRadius: 12, padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: alreadyAdded ? 'default' : 'pointer', transition: 'all 0.15s', opacity: alreadyAdded ? 0.7 : 1 }} onClick={() => !alreadyAdded && addSavedVendorToEvent(id, sv)}>
                                                        <span style={{ fontSize: '1.3rem' }}>{sv.emoji}</span>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sv.name}</div>
                                                            <div style={{ fontSize: '0.7rem', color: '#9aabbb', fontWeight: 600 }}>{sv.category} • {sv.price}</div>
                                                        </div>
                                                        {alreadyAdded ? <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#3D8C6E' }}>✓ Added</span> : <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--teal)' }}>+ Add</span>}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                                {/* Matched Vendors */}
                                {!isDemo && (() => {
                                    const MATCHED_VENDORS = [
                                        { emoji: '🏠', name: 'Local Venue', cat: 'Venue', price: '$400-800', matchBase: 85 },
                                        { emoji: '🍽️', name: 'Top Chef Catering', cat: 'Catering', price: '$300-600', matchBase: 82 },
                                        { emoji: '📸', name: 'SnapPro Photography', cat: 'Photography', price: '$250-500', matchBase: 88 },
                                        { emoji: '🎵', name: 'DJ SoundWave', cat: 'DJ / Music', price: '$200-400', matchBase: 80 },
                                        { emoji: '🎂', name: 'Sweet Bliss Bakery', cat: 'Cake', price: '$80-200', matchBase: 90 },
                                        { emoji: '🌸', name: 'Bloom Floral Co', cat: 'Decor', price: '$150-350', matchBase: 78 },
                                        { emoji: '🎪', name: 'FunTimes Entertainment', cat: 'Entertainment', price: '$200-500', matchBase: 75 },
                                    ]
                                    // Adjust match scores based on user's event
                                    const guestCount = parseInt(data.guests) || 50
                                    const hasBudget = !!data.budget
                                    const hasLocation = !!data.location && data.location !== 'TBD'
                                    const matched = MATCHED_VENDORS
                                        .filter(mv => !eventVendors.some(v => v.category.toLowerCase().includes(mv.cat.toLowerCase().split(' ')[0])))
                                        .map(mv => {
                                            let score = mv.matchBase
                                            if (hasBudget) score += 3
                                            if (hasLocation) score += 4
                                            if (guestCount > 30) score += 2
                                            score = Math.min(98, score + Math.floor(Math.random() * 5))
                                            return { ...mv, match: score }
                                        })
                                        .sort((a, b) => b.match - a.match)
                                        .slice(0, 4)
                                    if (matched.length === 0) return null
                                    return (
                                        <div style={{ marginTop: '1rem' }}>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '0.6rem' }}>🎯 Matched Vendors</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
                                                {matched.map((mv, mi) => (
                                                    <div key={mi} onClick={() => router.push(`/vendors?cat=${mv.cat.split(' ')[0].toLowerCase()}`)} style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 12, padding: '0.8rem 1rem', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                        <span style={{ fontSize: '1.3rem' }}>{mv.emoji}</span>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mv.name}</div>
                                                            <div style={{ fontSize: '0.68rem', color: '#9aabbb', fontWeight: 600 }}>{mv.cat} • {mv.price}</div>
                                                        </div>
                                                        <span style={{ background: 'rgba(74,173,168,0.1)', color: 'var(--teal)', padding: '0.15rem 0.45rem', borderRadius: 12, fontSize: '0.62rem', fontWeight: 800, whiteSpace: 'nowrap' }}>{mv.match}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })()}
                                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                                    <button onClick={() => router.push('/vendors')} style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 10, padding: '0.6rem 1.5rem', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', color: 'var(--navy)' }}>Browse More Vendors →</button>
                                </div>
                            </div>
                            {/* Sidebar — Cost Summary */}
                            <div>
                                <div className="card" style={{ padding: '1.2rem', textAlign: 'center', marginBottom: '1rem' }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>💰</div>
                                    <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '0.9rem', color: 'var(--navy)', marginBottom: '0.5rem' }}>Cost Estimate</h3>
                                    <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1.8rem', color: totalVendorCost > 0 ? 'var(--teal)' : '#ccc', marginBottom: '0.3rem' }}>${totalVendorCost.toLocaleString()}</div>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Total Vendor Costs</div>
                                    {data.budget && totalVendorCost > 0 && (() => {
                                        const nums = data.budget.match(/[\d,]+/g)?.map((n: string) => parseInt(n.replace(/,/g, ''))) || [2000]
                                        const budgetNum = nums.length >= 2 ? Math.round((nums[0] + nums[1]) / 2) : (nums[0] || 2000)
                                        const pct = budgetNum > 0 ? Math.round((totalVendorCost / budgetNum) * 100) : 0
                                        const remaining = budgetNum - totalVendorCost
                                        return (
                                            <div>
                                                <div style={{ height: 6, background: 'var(--border)', borderRadius: 50, overflow: 'hidden', marginBottom: '0.4rem' }}>
                                                    <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct > 100 ? '#E8896A' : 'linear-gradient(90deg, var(--teal), #3D8C6E)', borderRadius: 50, transition: 'width 0.3s' }} />
                                                </div>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: pct > 100 ? '#E8896A' : 'var(--navy)' }}>{pct}% of ${budgetNum.toLocaleString()} budget</div>
                                                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: remaining >= 0 ? '#3D8C6E' : '#E8896A', marginTop: '0.15rem' }}>{remaining >= 0 ? `$${remaining.toLocaleString()} remaining` : `$${Math.abs(remaining).toLocaleString()} over budget`}</div>
                                            </div>
                                        )
                                    })()}
                                </div>
                                {/* Actuals vs Budget */}
                                {data.plan?.budget?.breakdown?.length > 0 && (
                                    <div className="card" style={{ padding: '1.2rem' }}>
                                        <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '0.85rem', color: 'var(--navy)', marginBottom: '0.6rem' }}>📊 Actuals vs. Budget</h3>
                                        {data.plan.budget.breakdown.map((b, i) => {
                                            // Smart matching: map budget categories to vendor categories
                                            const BUDGET_TO_VENDOR: Record<string, string[]> = {
                                                venue: ['venue', 'location', 'space', 'hall'],
                                                catering: ['catering', 'food', 'chef', 'caterer', 'bbq', 'taco'],
                                                decor: ['decor', 'decoration', 'florist', 'flower', 'balloon', 'lighting'],
                                                entertainment: ['entertainment', 'performer', 'magician', 'comedian', 'game'],
                                                photography: ['photography', 'photographer', 'photo', 'video', 'videographer'],
                                                cake: ['cake', 'baker', 'bakery', 'dessert', 'pastry'],
                                                misc: ['misc', 'other', 'transportation', 'favor', 'rental', 'equipment'],
                                                music: ['music', 'dj', 'band', 'sound', 'playlist'],
                                                'music / dj': ['dj', 'music', 'band', 'sound'],
                                                drinks: ['drinks', 'bar', 'bartender', 'cocktail', 'beverage'],
                                            }
                                            const budgetKey = b.category.toLowerCase()
                                            const matchTerms = BUDGET_TO_VENDOR[budgetKey] || [budgetKey.split(' ')[0], budgetKey]
                                            const actual = eventVendors.filter(v => {
                                                const vc = v.category.toLowerCase()
                                                return matchTerms.some(term => vc.includes(term) || term.includes(vc.split(' ')[0]))
                                            }).reduce((s, v) => s + (v.costEstimate || 0), 0)
                                            const pctUsed = b.amount > 0 ? Math.round((actual / b.amount) * 100) : 0
                                            return (
                                                <div key={i} style={{ marginBottom: '0.5rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.15rem' }}>
                                                        <span style={{ color: 'var(--navy)' }}>{b.category}</span>
                                                        <span style={{ color: actual > b.amount ? '#E8896A' : 'var(--teal)' }}>${actual.toLocaleString()} / ${b.amount.toLocaleString()}</span>
                                                    </div>
                                                    <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, pctUsed)}%`, background: actual > b.amount ? '#E8896A' : pctUsed >= 80 ? '#c4880a' : b.color, transition: 'width 0.4s ease' }} />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ══ GUESTS TAB ══ */}
            {selectedTab === 'guests' && (
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem 0.75rem' }}>
                    <GuestManager eventId={data.eventId} planData={{ eventType: data.eventType, theme: data.theme, date: data.date, location: data.location, eventId: data.eventId }} isDemo={isDemo} />
                </div>
            )}

            {/* ══ POLLS TAB ══ */}
            {selectedTab === 'polls' && (
                <div style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem' }}>
                    {/* Header & Create Button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <h2 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1.3rem', color: 'var(--navy)', margin: 0 }}>
                                🗳️ Party Polls
                            </h2>
                            <p style={{ fontSize: '0.82rem', color: '#9aabbb', fontWeight: 600, margin: '0.2rem 0 0' }}>
                                Let friends & family vote on party decisions
                            </p>
                        </div>
                        <button
                            onClick={() => setShowPollCreator(true)}
                            style={{
                                padding: '0.6rem 1.2rem', borderRadius: 12,
                                background: 'linear-gradient(135deg, var(--teal), var(--green))',
                                color: 'white', fontWeight: 800, border: 'none',
                                cursor: 'pointer', fontSize: '0.85rem', fontFamily: "'Fredoka One',cursive",
                            }}
                        >
                            + New Poll
                        </button>
                    </div>

                    {/* Share Link Banner */}
                    {pollShareLink && (
                        <div style={{
                            padding: '1rem 1.2rem', borderRadius: 14, marginBottom: '1.5rem',
                            background: 'linear-gradient(135deg, rgba(74,173,168,0.08), rgba(247,201,72,0.06))',
                            border: '1px solid rgba(74,173,168,0.2)',
                            display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap',
                        }}>
                            <div style={{ fontSize: '1.4rem' }}>🔗</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, color: 'var(--navy)', fontSize: '0.85rem' }}>Poll Created!</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--teal)', fontWeight: 700, wordBreak: 'break-all' }}>
                                    {window.location.origin}{pollShareLink}
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}${pollShareLink}`)
                                    showToast('Link copied!', 'success')
                                }}
                                style={{
                                    padding: '0.45rem 0.9rem', borderRadius: 8,
                                    background: 'var(--navy)', color: 'white', fontWeight: 700,
                                    border: 'none', cursor: 'pointer', fontSize: '0.78rem',
                                }}
                            >📋 Copy Link</button>
                        </div>
                    )}

                    {/* Poll Results */}
                    {pollsLoading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <div className="spinner" style={{ width: 30, height: 30, margin: '0 auto 0.5rem' }} />
                            <div style={{ color: '#9aabbb', fontSize: '0.82rem', fontWeight: 600 }}>Loading polls...</div>
                        </div>
                    ) : polls.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '0.8rem' }}>🗳️</div>
                            <div style={{ fontFamily: "'Fredoka One',cursive", color: 'var(--navy)', fontSize: '1.1rem', marginBottom: '0.3rem' }}>No polls yet</div>
                            <div style={{ color: '#9aabbb', fontSize: '0.82rem', fontWeight: 600 }}>Create a poll to let friends & family vote on dates, venues, themes, and more!</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {polls.map((poll) => {
                                const maxVotes = Math.max(...poll.options.map((o: { votes: number }) => o.votes), 1)
                                const sortedOptions = [...poll.options].sort((a: { votes: number }, b: { votes: number }) => b.votes - a.votes)
                                return (
                                    <div key={poll.id} className="card" style={{ padding: '1.2rem 1.5rem', opacity: pollDeletingId === poll.id ? 0.4 : 1, transition: 'opacity 0.3s' }}>
                                        {/* Poll Header */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1.05rem', color: 'var(--navy)', margin: '0 0 0.25rem' }}>{poll.question}</h3>
                                                <div style={{ fontSize: '0.75rem', color: '#9aabbb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                    <span>{poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}</span>
                                                    <span style={{ color: '#ddd' }}>·</span>
                                                    <span>by {poll.creatorName}</span>
                                                    {poll.allowMultiple && <span style={{ padding: '0.08rem 0.35rem', borderRadius: 4, background: 'rgba(74,173,168,0.08)', color: 'var(--teal)', fontSize: '0.68rem', fontWeight: 800 }}>Multi</span>}
                                                    {poll.closed && <span style={{ padding: '0.08rem 0.35rem', borderRadius: 4, background: 'rgba(232,137,106,0.08)', color: '#E8896A', fontSize: '0.68rem', fontWeight: 800 }}>Closed</span>}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                                                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/poll/${poll.id}`); showToast('Poll link copied!', 'success') }} style={{ padding: '0.3rem 0.55rem', borderRadius: 6, background: 'rgba(74,173,168,0.06)', border: '1px solid rgba(74,173,168,0.15)', color: 'var(--teal)', fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer' }}>🔗</button>
                                                <button onClick={() => deletePoll(poll.id)} style={{ padding: '0.3rem 0.55rem', borderRadius: 6, background: 'rgba(232,137,106,0.06)', border: '1px solid rgba(232,137,106,0.15)', color: '#E8896A', fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer' }}>🗑</button>
                                            </div>
                                        </div>
                                        {/* Result bars */}
                                        {sortedOptions.map((opt: { id: string; text: string; votes: number; voters: string[] }, idx: number) => {
                                            const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0
                                            const isLeader = idx === 0 && opt.votes > 0
                                            const barW = poll.totalVotes > 0 ? Math.max(2, (opt.votes / maxVotes) * 100) : 0
                                            return (
                                                <div key={opt.id} style={{ position: 'relative', marginBottom: '0.5rem', padding: '0.55rem 0.8rem', borderRadius: 10, border: `1.5px solid ${isLeader ? 'rgba(247,201,72,0.3)' : 'var(--border)'}`, overflow: 'hidden' }}>
                                                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, borderRadius: 10, width: `${barW}%`, transition: 'width 0.5s ease', background: isLeader ? 'linear-gradient(90deg, rgba(247,201,72,0.12), rgba(232,137,106,0.08))' : 'rgba(74,173,168,0.06)' }} />
                                                    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy)' }}>{isLeader && '👑 '}{opt.text}</span>
                                                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isLeader ? '#E8896A' : 'var(--teal)', minWidth: 35, textAlign: 'right' }}>{pct}%</span>
                                                    </div>
                                                    {opt.voters.length > 0 && (
                                                        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: '0.15rem', marginTop: '0.25rem' }}>
                                                            {opt.voters.slice(0, 10).map((v: string, vi: number) => (
                                                                <span key={vi} style={{ padding: '0.05rem 0.3rem', borderRadius: 4, background: 'rgba(74,173,168,0.06)', color: 'var(--teal)', fontSize: '0.62rem', fontWeight: 700 }}>{v}</span>
                                                            ))}
                                                            {opt.voters.length > 10 && <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#9aabbb' }}>+{opt.voters.length - 10}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                                            <span style={{ fontSize: '0.68rem', color: '#9aabbb', fontWeight: 600 }}>Created {new Date(poll.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                                            <button onClick={() => data.eventId && fetchPolls(data.eventId)} style={{ padding: '0.25rem 0.6rem', borderRadius: 6, background: 'transparent', border: '1px solid var(--border)', color: '#9aabbb', fontWeight: 700, fontSize: '0.68rem', cursor: 'pointer', fontFamily: 'inherit' }}>🔄 Refresh</button>
                                        </div>
                                    </div>
                                )
                            })}
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
                                                ⏳ Event Countdown
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <button onClick={() => setShowCollabModal(true)} style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--navy)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>👥 Add/Manage Collaborators</button>
                                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: daysLeft !== null && daysLeft <= 7 ? '#E8896A' : 'var(--teal)' }}>
                                                    {daysLeft !== null ? (daysLeft === 0 ? '🎉 Today!' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`) : 'No date set'}
                                                </div>
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


                                <div className={styles.sectionCard}>
                                    <div className={styles.cardHeader} style={{ flexDirection: 'column', gap: '0.4rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '0.4rem' }}>
                                            <div className={styles.cardTitleGroup}>
                                                <span className={styles.cardIcon}>🗓️</span>
                                                <h2>Planning Timeline</h2>
                                            </div>
                                            {(() => {
                                                const timeline = data.plan.timeline
                                                const now = new Date()
                                                let overdue = 0, done = 0, due = 0
                                                timeline.forEach((t, ti) => {
                                                    if (t.completedAt) { done++; return }
                                                    // Parse date from weeks label
                                                    const dateMatch = t.weeks.match(/^([A-Z][a-z]{2})\s(\d{1,2})/)
                                                    if (dateMatch) {
                                                        const targetDate = new Date(`${dateMatch[1]} ${dateMatch[2]}, ${now.getFullYear()}`)
                                                        if (targetDate < now) overdue++
                                                        else due++
                                                    } else { due++ }
                                                })
                                                const statusColor = overdue > 0 ? '#E8896A' : done === timeline.length ? '#3D8C6E' : 'var(--teal)'
                                                const statusLabel = overdue > 0 ? `${overdue} Overdue` : done === timeline.length ? 'All Done!' : 'On Track'
                                                return <span style={{ fontSize: '0.62rem', fontWeight: 800, color: statusColor, background: `${statusColor}12`, border: `1px solid ${statusColor}30`, padding: '0.1rem 0.45rem', borderRadius: 10, whiteSpace: 'nowrap' }}>{statusLabel}</span>
                                            })()}
                                            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#9aabbb', marginLeft: 'auto' }}>{checkDone}/{checkTotal} ({checkPct}%)</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', width: '100%' }}>
                                            <span className={`${styles.sourceBadge} ${styles.claudeBadge}`} style={{ fontSize: '0.58rem', padding: '0.08rem 0.35rem' }}>AI Generated</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1 }}>
                                                <input value={refineTimelineInput} onChange={e => setRefineTimelineInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') refineTimeline() }} placeholder="Refine with AI..." style={{ flex: 1, padding: '0.22rem 0.5rem', borderRadius: 6, border: '1.5px solid rgba(74,173,168,0.3)', fontSize: '0.68rem', fontWeight: 600, outline: 'none', color: 'var(--navy)' }} />
                                                <button onClick={refineTimeline} disabled={isRefiningTimeline || !refineTimelineInput.trim()} style={{ background: 'linear-gradient(135deg, var(--teal), #3D8C6E)', color: '#fff', border: 'none', borderRadius: 6, padding: '0.22rem 0.45rem', fontSize: '0.62rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', opacity: isRefiningTimeline || !refineTimelineInput.trim() ? 0.5 : 1 }}>{isRefiningTimeline ? '...' : '✨'}</button>
                                            </div>
                                            <button onClick={() => setEditTimelineMode(!editTimelineMode)} title={editTimelineMode ? 'Exit edit' : 'Edit'} style={{ background: editTimelineMode ? 'var(--teal)' : 'transparent', color: editTimelineMode ? '#fff' : '#9aabbb', border: `1.5px solid ${editTimelineMode ? 'var(--teal)' : 'var(--border)'}`, borderRadius: 6, padding: '0.18rem 0.35rem', fontSize: '0.65rem', cursor: 'pointer', transition: 'all 0.2s' }}>✏️</button>
                                            <div style={{ position: 'relative', display: 'inline-flex' }}>
                                                <button onClick={() => { setTasksCollapsed(!tasksCollapsed); setShowChecklistHint(false) }} title={tasksCollapsed ? 'Show smart checklist' : 'Hide smart checklist'} style={{ background: tasksCollapsed ? 'rgba(74,173,168,0.1)' : 'transparent', color: tasksCollapsed ? 'var(--teal)' : '#9aabbb', border: `1.5px solid ${tasksCollapsed ? 'rgba(74,173,168,0.3)' : 'var(--border)'}`, borderRadius: 6, padding: '0.18rem 0.35rem', fontSize: '0.62rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>{tasksCollapsed ? '☐' : '☑'}</button>
                                                {showChecklistHint && tasksCollapsed && (
                                                    <div style={{ position: 'absolute', top: '-2.2rem', left: '50%', transform: 'translateX(-50%)', background: 'var(--navy)', color: '#fff', fontSize: '0.6rem', fontWeight: 800, padding: '0.25rem 0.5rem', borderRadius: 6, whiteSpace: 'nowrap', zIndex: 50, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', pointerEvents: 'none' }}>
                                                        Open Smart Checklist ✨
                                                        <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid var(--navy)' }} />
                                                    </div>
                                                )}
                                                {showChecklistHint && tasksCollapsed && (
                                                    <span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: '#E8896A', animation: 'pulse 1.5s infinite', zIndex: 51 }} />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.timeline}>
                                        {(data.plan.timeline).map((t, i, arr) => {
                                            const firstTag = t.category ? (t.category.split(/[_,/]/)[0] || '').trim().toLowerCase() : ''
                                            const icon = CATEGORY_ICONS[firstTag] || CATEGORY_ICONS.default
                                            const dotColor = CATEGORY_DOTS[firstTag] || CATEGORY_DOTS.default
                                            return (
                                                <div
                                                    key={i}
                                                    className={styles.timelineItem}
                                                    draggable={editTimelineMode}
                                                    onDragStart={() => editTimelineMode && setDragIdx(i)}
                                                    onDragOver={e => editTimelineMode && e.preventDefault()}
                                                    onDrop={() => {
                                                        if (!editTimelineMode || dragIdx === null || dragIdx === i) return
                                                        const items = [...(data.plan.timeline)]
                                                        const [moved] = items.splice(dragIdx, 1)
                                                        items.splice(i, 0, moved)
                                                        if (isEditing) {
                                                            setEditTimeline(items)
                                                        } else {
                                                            const updated = { ...data, plan: { ...data.plan, timeline: items } }
                                                            setData(updated)
                                                            userSetJSON('partyplan', updated)
                                                        }
                                                        setDragIdx(null)
                                                    }}
                                                    onDragEnd={() => setDragIdx(null)}
                                                    style={{ opacity: dragIdx === i ? 0.4 : 1, cursor: editTimelineMode ? 'grab' : 'default' }}
                                                >
                                                    {editTimelineMode && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginRight: 4, color: '#ccc', fontSize: '0.7rem', cursor: 'grab', userSelect: 'none' }} title="Drag to reorder">⋮⋮</div>
                                                    )}
                                                    <div className={styles.tlLeft}>
                                                        <div className={`${styles.tlDot} ${styles[`tlDot${dotColor}` as keyof typeof styles]}`}>
                                                            {icon}
                                                        </div>
                                                        <div className={styles.tlLine} />
                                                    </div>
                                                    <div className={styles.tlContent}>
                                                        {editTimelineMode ? (
                                                            <>
                                                                <input value={t.weeks} onChange={e => { const items = [...data.plan.timeline]; items[i] = { ...items[i], weeks: e.target.value }; setData(prev => ({ ...prev, plan: { ...prev.plan, timeline: items } })) }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(74,173,168,0.3)', borderRadius: 6, padding: '0.25rem 0.5rem', color: '#4AADA8', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.06em', width: '100%', outline: 'none', marginBottom: 4 }} />
                                                                <input value={t.task} onChange={e => { const items = [...data.plan.timeline]; items[i] = { ...items[i], task: e.target.value }; setData(prev => ({ ...prev, plan: { ...prev.plan, timeline: items } })) }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '0.3rem 0.5rem', color: '#1A2535', fontSize: '0.9rem', fontWeight: 800, width: '100%', outline: 'none', marginBottom: 4 }} />
                                                                <textarea value={t.category} onChange={e => { const items = [...data.plan.timeline]; items[i] = { ...items[i], category: e.target.value }; setData(prev => ({ ...prev, plan: { ...prev.plan, timeline: items } })) }} rows={2} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '0.3rem 0.5rem', color: '#6b7c93', fontSize: '0.78rem', fontWeight: 600, width: '100%', outline: 'none', resize: 'vertical' as const }} />
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className={styles.tlTime}>{t.weeks}</div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                                    <div className={styles.tlTitle} style={t.completedAt ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}>{t.task}</div>
                                                                    {(() => {
                                                                        const tasks = taskMapping[i] || []
                                                                        const tasksDone = tasks.filter(ci => checklist[ci]?.done).length
                                                                        const allTasksDone = tasks.length > 0 && tasksDone === tasks.length
                                                                        // Determine status
                                                                        if (t.completedAt || allTasksDone) {
                                                                            return <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#3D8C6E', background: '#3D8C6E12', border: '1px solid #3D8C6E30', padding: '0.05rem 0.35rem', borderRadius: 8, whiteSpace: 'nowrap' }}>✓ Done{t.completedAt ? ` ${new Date(t.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</span>
                                                                        }
                                                                        // Check if overdue by parsing date from weeks
                                                                        const dateMatch = t.weeks.match(/^([A-Z][a-z]{2})\s(\d{1,2})/)
                                                                        if (dateMatch) {
                                                                            const targetDate = new Date(`${dateMatch[1]} ${dateMatch[2]}, ${new Date().getFullYear()}`)
                                                                            if (targetDate < new Date()) {
                                                                                return <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#E8896A', background: '#E8896A12', border: '1px solid #E8896A30', padding: '0.05rem 0.35rem', borderRadius: 8, whiteSpace: 'nowrap' }}>⚠ Overdue</span>
                                                                            }
                                                                        }
                                                                        return <span style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--teal)', background: 'rgba(74,173,168,0.08)', border: '1px solid rgba(74,173,168,0.2)', padding: '0.05rem 0.35rem', borderRadius: 8, whiteSpace: 'nowrap' }}>Due{tasks.length > 0 ? ` ${tasksDone}/${tasks.length}` : ''}</span>
                                                                    })()}
                                                                </div>
                                                                {t.category && (() => {
                                                                    const TAG_COLORS: Record<string, string> = { venue: '#4AADA8', vendor: '#E8896A', food: '#F7C948', music: '#7B5EA7', decor: '#3D8C6E', planning: '#2D4059', guests: '#c4880a', budget: '#E8896A', entertainment: '#7B5EA7', catering: '#F7C948', photography: '#4AADA8', logistics: '#2D4059' }
                                                                    const isTagLike = t.category.length < 40 && /^[a-zA-Z0-9_\s&,/]+$/.test(t.category)
                                                                    if (isTagLike) {
                                                                        const tags = t.category.split(/[_,/]/).map(t => t.trim().toLowerCase()).filter(Boolean)
                                                                        return (
                                                                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                                                                                {tags.map((tag, ti) => (
                                                                                    <span key={ti} style={{ background: `${TAG_COLORS[tag] || '#9aabbb'}18`, border: `1px solid ${TAG_COLORS[tag] || '#9aabbb'}30`, borderRadius: 12, padding: '0.1rem 0.55rem', fontSize: '0.68rem', fontWeight: 700, color: TAG_COLORS[tag] || '#6b7c93', textTransform: 'capitalize' }}>{tag}</span>
                                                                                ))}
                                                                            </div>
                                                                        )
                                                                    }
                                                                    return <div className={styles.tlDesc}>{t.category}</div>
                                                                })()}
                                                                {/* Inline checklist tasks */}
                                                                {!tasksCollapsed && taskMapping[i]?.length > 0 && (
                                                                    <div
                                                                        style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.4rem' }}
                                                                        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderLeft = '3px solid var(--teal)' }}
                                                                        onDragLeave={e => { e.currentTarget.style.borderLeft = 'none' }}
                                                                        onDrop={e => {
                                                                            e.preventDefault()
                                                                            e.currentTarget.style.borderLeft = 'none'
                                                                            if (dragTaskIdx !== null) {
                                                                                // Move task category to match this timeline item for keyword matching
                                                                                const keywords = `${t.task} ${t.category}`.split(/[\s_,/]+/).filter(w => w.length > 2).slice(0, 2).join(' ')
                                                                                moveTaskToCategory(dragTaskIdx, keywords || t.task.split(' ')[0])
                                                                                setDragTaskIdx(null)
                                                                            }
                                                                        }}
                                                                    >
                                                                        {taskMapping[i].map(ci => {
                                                                            const c = checklist[ci]
                                                                            if (!c) return null
                                                                            return (
                                                                                <div
                                                                                    key={ci}
                                                                                    draggable
                                                                                    onDragStart={() => setDragTaskIdx(ci)}
                                                                                    onDragEnd={() => setDragTaskIdx(null)}
                                                                                    style={{
                                                                                        display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0',
                                                                                        opacity: dragTaskIdx === ci ? 0.3 : 1, transition: 'opacity 0.2s',
                                                                                        position: 'relative',
                                                                                    }}
                                                                                >
                                                                                    {/* Drag handle */}
                                                                                    <span style={{ cursor: 'grab', fontSize: '0.7rem', color: '#ccc', userSelect: 'none', flexShrink: 0 }} title="Drag to move">⠿</span>
                                                                                    {/* Checkbox */}
                                                                                    <div
                                                                                        onClick={() => toggleCheck(ci)}
                                                                                        style={{ width: 16, height: 16, borderRadius: 4, border: c.done ? '2px solid #3D8C6E' : '2px solid #ccc', background: c.done ? '#3D8C6E' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#fff', flexShrink: 0, transition: 'all 0.2s', cursor: 'pointer' }}
                                                                                    >{c.done ? '✓' : ''}</div>
                                                                                    {/* Task text */}
                                                                                    <span onClick={() => toggleCheck(ci)} style={{ fontSize: '0.75rem', fontWeight: 600, color: c.done ? '#9aabbb' : 'var(--navy)', textDecoration: c.done ? 'line-through' : 'none', flex: 1, cursor: 'pointer' }}>{c.item}</span>
                                                                                    {c.completedAt && <span style={{ fontSize: '0.55rem', color: '#3D8C6E', fontWeight: 700, whiteSpace: 'nowrap' }}>{new Date(c.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                                                                                    {/* Move button */}
                                                                                    <button
                                                                                        onClick={e => { e.stopPropagation(); setMoveMenuIdx(moveMenuIdx === ci ? null : ci) }}
                                                                                        style={{ background: 'none', border: 'none', color: moveMenuIdx === ci ? 'var(--teal)' : '#ddd', cursor: 'pointer', fontSize: '0.65rem', padding: '0.1rem', flexShrink: 0, transition: 'color 0.2s' }}
                                                                                        onMouseEnter={e => { if (moveMenuIdx !== ci) e.currentTarget.style.color = '#9aabbb' }}
                                                                                        onMouseLeave={e => { if (moveMenuIdx !== ci) e.currentTarget.style.color = '#ddd' }}
                                                                                        title="Move to..."
                                                                                    >↕</button>
                                                                                    {/* Delete button */}
                                                                                    <button onClick={(e) => removeCheckItem(ci, e)} style={{ background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', fontSize: '0.6rem', padding: '0.1rem', flexShrink: 0 }} onMouseEnter={e => (e.currentTarget.style.color = '#E8896A')} onMouseLeave={e => (e.currentTarget.style.color = '#ddd')}>✕</button>
                                                                                    {/* Move menu dropdown */}
                                                                                    {moveMenuIdx === ci && (
                                                                                        <div style={{
                                                                                            position: 'absolute', right: 0, top: '100%', zIndex: 100,
                                                                                            background: 'white', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                                                                                            border: '1px solid var(--border)', padding: '0.3rem', minWidth: 180, maxHeight: 200, overflowY: 'auto',
                                                                                        }}>
                                                                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', padding: '0.2rem 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Move to...</div>
                                                                                            {(data.plan.timeline).map((tl, tli) => (
                                                                                                <button key={tli} onClick={() => {
                                                                                                    const keywords = `${tl.task} ${tl.category}`.split(/[\s_,/]+/).filter(w => w.length > 2).slice(0, 2).join(' ')
                                                                                                    moveTaskToCategory(ci, keywords || tl.task.split(' ')[0])
                                                                                                }} style={{
                                                                                                    display: 'block', width: '100%', textAlign: 'left', padding: '0.4rem 0.5rem',
                                                                                                    borderRadius: 6, border: 'none', background: tli === i ? 'rgba(74,173,168,0.08)' : 'transparent',
                                                                                                    cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: 'var(--navy)',
                                                                                                    fontFamily: 'inherit', transition: 'background 0.15s',
                                                                                                }}
                                                                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,173,168,0.06)'}
                                                                                                    onMouseLeave={e => e.currentTarget.style.background = tli === i ? 'rgba(74,173,168,0.08)' : 'transparent'}
                                                                                                >
                                                                                                    {tli === i && '✓ '}{tl.task.length > 30 ? tl.task.slice(0, 30) + '...' : tl.task}
                                                                                                </button>
                                                                                            ))}
                                                                                            <button onClick={() => moveTaskToCategory(ci, 'Custom')} style={{
                                                                                                display: 'block', width: '100%', textAlign: 'left', padding: '0.4rem 0.5rem',
                                                                                                borderRadius: 6, border: 'none', background: 'transparent',
                                                                                                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#9aabbb',
                                                                                                fontFamily: 'inherit', borderTop: '1px solid var(--border)', marginTop: '0.2rem',
                                                                                            }}
                                                                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                                                                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                                                            >
                                                                                                📋 General Tasks
                                                                                            </button>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {/* ── General Tasks — shown as a real deliverable at the bottom ── */}
                                    {!tasksCollapsed && (
                                        <div
                                            className={styles.timelineItem}
                                            onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = 'rgba(74,173,168,0.02)' }}
                                            onDragLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                            onDrop={e => {
                                                e.preventDefault()
                                                e.currentTarget.style.background = 'transparent'
                                                if (dragTaskIdx !== null) {
                                                    moveTaskToCategory(dragTaskIdx, '__general__')
                                                    setDragTaskIdx(null)
                                                }
                                            }}
                                        >
                                            <div className={styles.tlLeft}>
                                                <div className={styles.tlDot} style={{ background: '#9aabbb', border: '3px solid rgba(154,171,187,0.2)', fontSize: '0.7rem' }}>📋</div>
                                            </div>
                                            <div className={styles.tlContent}>
                                                <div className={styles.tlTime} style={{ color: '#9aabbb' }}>Ongoing</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                    <div className={styles.tlTitle}>General Tasks</div>
                                                    {(() => {
                                                        const done = unassignedTasks.filter(ci => checklist[ci]?.done).length
                                                        const total = unassignedTasks.length
                                                        if (total === 0) return <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#9aabbb', background: 'rgba(154,171,187,0.08)', border: '1px solid rgba(154,171,187,0.2)', padding: '0.05rem 0.35rem', borderRadius: 8, whiteSpace: 'nowrap' }}>No tasks</span>
                                                        if (done === total) return <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#3D8C6E', background: '#3D8C6E12', border: '1px solid #3D8C6E30', padding: '0.05rem 0.35rem', borderRadius: 8, whiteSpace: 'nowrap' }}>✓ All done</span>
                                                        return <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#9aabbb', background: 'rgba(154,171,187,0.08)', border: '1px solid rgba(154,171,187,0.2)', padding: '0.05rem 0.35rem', borderRadius: 8, whiteSpace: 'nowrap' }}>{done}/{total}</span>
                                                    })()}
                                                </div>
                                                <div className={styles.tlDesc}>Tasks not assigned to a specific milestone — add custom to-dos here</div>
                                                {/* Task list */}
                                                {unassignedTasks.length > 0 && (
                                                    <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.4rem' }}>
                                                        {unassignedTasks.map(ci => {
                                                            const c = checklist[ci]
                                                            if (!c) return null
                                                            return (
                                                                <div
                                                                    key={ci}
                                                                    draggable
                                                                    onDragStart={() => setDragTaskIdx(ci)}
                                                                    onDragEnd={() => setDragTaskIdx(null)}
                                                                    style={{
                                                                        display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0',
                                                                        opacity: dragTaskIdx === ci ? 0.3 : 1, position: 'relative',
                                                                    }}
                                                                >
                                                                    <span style={{ cursor: 'grab', fontSize: '0.7rem', color: '#ccc', userSelect: 'none', flexShrink: 0 }}>⠿</span>
                                                                    <div onClick={() => toggleCheck(ci)} style={{ width: 16, height: 16, borderRadius: 4, border: c.done ? '2px solid #3D8C6E' : '2px solid #ccc', background: c.done ? '#3D8C6E' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#fff', flexShrink: 0, transition: 'all 0.2s', cursor: 'pointer' }}>{c.done ? '✓' : ''}</div>
                                                                    <span onClick={() => toggleCheck(ci)} style={{ fontSize: '0.75rem', fontWeight: 600, color: c.done ? '#9aabbb' : 'var(--navy)', textDecoration: c.done ? 'line-through' : 'none', flex: 1, cursor: 'pointer' }}>{c.item}</span>
                                                                    {c.completedAt && <span style={{ fontSize: '0.55rem', color: '#3D8C6E', fontWeight: 700, whiteSpace: 'nowrap' }}>{new Date(c.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                                                                    <button onClick={e => { e.stopPropagation(); setMoveMenuIdx(moveMenuIdx === ci ? null : ci) }} style={{ background: 'none', border: 'none', color: moveMenuIdx === ci ? 'var(--teal)' : '#ddd', cursor: 'pointer', fontSize: '0.65rem', padding: '0.1rem', flexShrink: 0 }} title="Move to...">↕</button>
                                                                    <button onClick={(e) => removeCheckItem(ci, e)} style={{ background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', fontSize: '0.6rem', padding: '0.1rem', flexShrink: 0 }} onMouseEnter={e => (e.currentTarget.style.color = '#E8896A')} onMouseLeave={e => (e.currentTarget.style.color = '#ddd')}>✕</button>
                                                                    {moveMenuIdx === ci && (
                                                                        <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 100, background: 'white', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', border: '1px solid var(--border)', padding: '0.3rem', minWidth: 180, maxHeight: 200, overflowY: 'auto' }}>
                                                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', padding: '0.2rem 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Move to...</div>
                                                                            {data.plan.timeline.map((tl, tli) => (
                                                                                <button key={tli} onClick={() => {
                                                                                    const keywords = `${tl.task} ${tl.category}`.split(/[\s_,/]+/).filter(w => w.length > 2).slice(0, 2).join(' ')
                                                                                    moveTaskToCategory(ci, keywords || tl.task.split(' ')[0])
                                                                                }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.4rem 0.5rem', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: 'var(--navy)', fontFamily: 'inherit' }}
                                                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,173,168,0.06)'}
                                                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                                                >{tl.task.length > 30 ? tl.task.slice(0, 30) + '...' : tl.task}</button>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {/* Add task with deliverable selector */}
                                    <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                                        <div style={{ display: 'flex', gap: '0.3rem', marginBottom: newCheckItem.trim() ? '0.4rem' : 0 }}>
                                            <input value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCheckItem()} placeholder="+ Add a task..." style={{ flex: 1, padding: '0.3rem 0.5rem', borderRadius: 6, border: '1.5px solid rgba(0,0,0,0.08)', fontSize: '0.75rem', fontWeight: 600, outline: 'none', color: 'var(--navy)' }} />
                                            <button onClick={() => addCheckItem()} style={{ background: 'linear-gradient(135deg, var(--teal), #3D8C6E)', color: '#fff', border: 'none', borderRadius: 6, padding: '0.3rem 0.6rem', fontWeight: 800, fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</button>
                                        </div>
                                        {newCheckItem.trim() && (
                                            <select
                                                value={newCheckCategory}
                                                onChange={e => setNewCheckCategory(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '0.3rem 0.5rem', borderRadius: 6,
                                                    border: '1.5px solid rgba(0,0,0,0.08)', fontSize: '0.72rem',
                                                    fontWeight: 600, color: newCheckCategory ? 'var(--navy)' : '#9aabbb',
                                                    outline: 'none', background: 'white', fontFamily: 'inherit',
                                                }}
                                            >
                                                <option value="">📋 Add to: General Tasks</option>
                                                {data.plan.timeline.map((tl, tli) => (
                                                    <option key={tli} value={`${tl.task} ${tl.category}`.split(/[\s_,/]+/).filter(w => w.length > 2).slice(0, 2).join(' ') || tl.task.split(' ')[0]}>
                                                        📌 {tl.task.length > 35 ? tl.task.slice(0, 35) + '...' : tl.task}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
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
                                            <div key={i} className={styles.budgetItem} style={{ cursor: editBudgetMode ? 'pointer' : 'default' }} onClick={() => { if (editBudgetMode) { setEditBudgetIdx(i); setEditBudgetValue(b.amount.toString()) } }}>
                                                <div className={styles.budgetDot} style={{ background: b.color }} />
                                                <div className={styles.budgetName}>{b.category}</div>
                                                {editBudgetMode && editBudgetIdx === i ? (
                                                    <input
                                                        value={editBudgetValue}
                                                        onChange={e => setEditBudgetValue(e.target.value)}
                                                        onBlur={() => {
                                                            const val = parseInt(editBudgetValue) || 0
                                                            const updated = { ...data, plan: { ...data.plan, budget: { ...data.plan.budget, breakdown: data.plan.budget.breakdown.map((item, idx) => idx === i ? { ...item, amount: val, percentage: Math.round((val / totalBudget) * 100) } : item) } } }
                                                            setData(updated)
                                                            if (isDemo) { userSetJSON('partypal_demo', updated) }
                                                            else {
                                                                userSetJSON('partyplan', updated)
                                                                if (updated.eventId) {
                                                                    const updatedEvents = allEvents.map(ev => ev.eventId === updated.eventId ? updated : ev)
                                                                    setAllEvents(updatedEvents)
                                                                    userSetJSON('partypal_events', updatedEvents)
                                                                    fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) }).catch(() => { })
                                                                }
                                                            }
                                                            setEditBudgetIdx(null)
                                                        }}
                                                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                                        autoFocus
                                                        onClick={e => e.stopPropagation()}
                                                        style={{ width: 60, padding: '0.15rem 0.3rem', borderRadius: 6, border: '1.5px solid var(--teal)', fontSize: '0.72rem', fontWeight: 800, textAlign: 'right', outline: 'none', color: 'var(--navy)' }}
                                                    />
                                                ) : (
                                                    <div className={styles.budgetVal}>${b.amount.toLocaleString()}</div>
                                                )}
                                                <div className={styles.budgetPct}>{b.percentage}%</div>
                                                {editBudgetMode && (
                                                    <button onClick={(e) => { e.stopPropagation(); const updated = { ...data, plan: { ...data.plan, budget: { ...data.plan.budget, breakdown: data.plan.budget.breakdown.filter((_, idx) => idx !== i) } } }; setData(updated); if (isDemo) { userSetJSON('partypal_demo', updated) } else { userSetJSON('partyplan', updated); if (updated.eventId) { const ue = allEvents.map(ev => ev.eventId === updated.eventId ? updated : ev); setAllEvents(ue); userSetJSON('partypal_events', ue) } }; showToast(`Removed ${b.category}`, 'info') }} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '0.65rem', padding: '0 0.2rem', marginLeft: '0.2rem' }} title="Remove">✕</button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {editBudgetMode && (
                                        <button onClick={() => {
                                            const name = prompt('Category name:')
                                            if (!name) return
                                            const amtStr = prompt('Amount ($):')
                                            const amt = parseInt(amtStr || '0') || 0
                                            const colors = ['#E8896A', '#4AADA8', '#F7C948', '#7B5EA7', '#3D8C6E', '#C4A882', '#2D4059']
                                            const newItem = { category: name, amount: amt, percentage: Math.round((amt / totalBudget) * 100), color: colors[data.plan.budget.breakdown.length % colors.length] }
                                            const updated = { ...data, plan: { ...data.plan, budget: { ...data.plan.budget, breakdown: [...data.plan.budget.breakdown, newItem] } } }
                                            setData(updated)
                                            if (isDemo) { userSetJSON('partypal_demo', updated) }
                                            else {
                                                userSetJSON('partyplan', updated)
                                                if (updated.eventId) {
                                                    const ue = allEvents.map(ev => ev.eventId === updated.eventId ? updated : ev)
                                                    setAllEvents(ue)
                                                    userSetJSON('partypal_events', ue)
                                                }
                                            }
                                            showToast(`Added ${name}`, 'success')
                                        }} style={{ width: '100%', padding: '0.4rem', background: 'transparent', border: '1.5px dashed var(--border)', borderRadius: 8, fontSize: '0.75rem', fontWeight: 800, color: '#9aabbb', cursor: 'pointer', marginTop: '0.5rem' }}>+ Add Category</button>
                                    )}
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
                                        <button onClick={() => setEditBudgetMode(!editBudgetMode)} style={{ flex: 1, padding: '0.5rem', background: editBudgetMode ? 'var(--teal)' : 'rgba(0,0,0,0.04)', color: editBudgetMode ? '#fff' : 'var(--navy)', border: `1.5px solid ${editBudgetMode ? 'var(--teal)' : 'var(--border)'}`, borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.2s' }}>{editBudgetMode ? '✓ Done' : '💰 Adjust Budget'}</button>
                                        <button onClick={() => setShowBudgetTips(true)} style={{ flex: 1, padding: '0.5rem', background: 'rgba(0,0,0,0.04)', color: 'var(--navy)', border: '1.5px solid var(--border)', borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.2s' }}>💡 Budget Tips</button>
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
                                        {(!data.location || data.location === 'TBD') && (
                                            <button className={styles.qaBtn} onClick={() => router.push(`/vendors?cat=venue&location=${data.location}`)}>
                                                <span>🏛️</span><span>Browse Venues Near You</span><span>›</span>
                                            </button>
                                        )}
                                        <button className={styles.qaBtn} onClick={() => setSelectedTab('guests')}>
                                            <span>💌</span><span>Send Invitations Now</span><span>›</span>
                                        </button>
                                        <button className={styles.qaBtn} onClick={() => { setSelectedTab('polls'); setShowPollCreator(true) }}>
                                            <span>🗳️</span><span>Create a Poll</span><span>›</span>
                                        </button>

                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )
            }
            {/* Poll Creator Modal */}
            {showPollCreator && (
                <CreatePoll
                    eventId={data.eventId}
                    creatorName={user?.displayName || user?.email?.split('@')[0] || 'Host'}
                    eventContext={{
                        eventType: data.eventType,
                        date: data.date,
                        location: data.location,
                        theme: data.theme,
                    }}
                    onClose={() => setShowPollCreator(false)}
                    onCreated={({ shareUrl }) => {
                        setPollShareLink(shareUrl)
                        setShowPollCreator(false)
                        if (data.eventId) fetchPolls(data.eventId)
                    }}
                />
            )}
            {/* Collaborator Modal */}
            {showCollabModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={() => setShowCollabModal(false)}>
                    <div className="card" style={{ padding: '2rem', width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontFamily: "'Fredoka One',cursive", color: 'var(--navy)', marginBottom: '0.3rem' }}>👥 Add/Manage Collaborators</h2>
                        <p style={{ fontSize: '0.82rem', color: '#9aabbb', fontWeight: 600, marginBottom: '1.2rem' }}>Invite team members to help plan this event. They&apos;ll be able to view progress and contribute.</p>
                        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                            <input placeholder="Name" value={collabForm.name} onChange={e => setCollabForm(p => ({ ...p, name: e.target.value }))} style={{ flex: 1, minWidth: 100, padding: '0.5rem 0.7rem', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.82rem', fontWeight: 600, outline: 'none', color: 'var(--navy)' }} />
                            <input placeholder="Email" value={collabForm.email} onChange={e => setCollabForm(p => ({ ...p, email: e.target.value }))} style={{ flex: 2, minWidth: 150, padding: '0.5rem 0.7rem', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.82rem', fontWeight: 600, outline: 'none', color: 'var(--navy)' }} />
                            <select value={collabForm.role} onChange={e => setCollabForm(p => ({ ...p, role: e.target.value }))} style={{ padding: '0.5rem', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy)', outline: 'none' }}>
                                <option>Editor</option>
                                <option>Viewer</option>
                            </select>
                            <button disabled={!collabForm.email.trim() || !collabForm.name.trim()} onClick={async () => {
                                if (!collabForm.email.trim() || !collabForm.name.trim()) return
                                // Check if trying to add yourself
                                if (user?.email && collabForm.email.trim().toLowerCase() === user.email.toLowerCase()) {
                                    showToast("You can't add yourself as a collaborator — you're already the owner!", 'error')
                                    return
                                }
                                // Check for duplicate
                                if (collaborators.some(c => c.email.toLowerCase() === collabForm.email.trim().toLowerCase())) {
                                    showToast(`${collabForm.email} is already a collaborator`, 'error')
                                    return
                                }
                                try {
                                    const res = await fetch('/api/collaborate/invite', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            eventId: data.eventId,
                                            collaboratorEmail: collabForm.email,
                                            collaboratorName: collabForm.name,
                                            role: collabForm.role,
                                            inviterName: user?.displayName || user?.email?.split('@')[0] || 'Someone',
                                            eventName: data.eventType,
                                        }),
                                    })
                                    const result = await res.json()
                                    const updated = [...collaborators, { ...collabForm }]
                                    setCollaborators(updated)
                                    if (data.eventId) {
                                        userSetJSON(`partypal_collabs_${data.eventId}`, updated)
                                        fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: data.eventId, collaborators: updated }) }).catch(() => { })
                                    }
                                    if (result.emailSent) {
                                        showToast(`Invitation sent to ${collabForm.email}!`, 'success')
                                    } else if (result.inviteLink) {
                                        navigator.clipboard.writeText(result.inviteLink)
                                        showToast(`Invite link copied! Share with ${collabForm.name}`, 'success')
                                    } else {
                                        showToast(`${collabForm.name} added as collaborator`, 'success')
                                    }
                                } catch {
                                    showToast('Added locally (email service unavailable)', 'info')
                                    const updated = [...collaborators, { ...collabForm }]
                                    setCollaborators(updated)
                                    if (data.eventId) userSetJSON(`partypal_collabs_${data.eventId}`, updated)
                                }
                                setCollabForm({ email: '', name: '', role: 'Viewer' })
                            }} style={{ padding: '0.5rem 1rem', borderRadius: 8, background: 'linear-gradient(135deg, var(--teal), #3D8C6E)', color: '#fff', border: 'none', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap', opacity: !collabForm.email.trim() || !collabForm.name.trim() ? 0.4 : 1 }}>+ Invite</button>
                        </div>
                        {collaborators.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {collaborators.map((c, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.8rem', background: 'var(--light-bg)', borderRadius: 10 }}>
                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>{c.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--navy)' }}>{c.name}</div>
                                            <div style={{ fontSize: '0.72rem', color: '#9aabbb', fontWeight: 600 }}>{c.email}</div>
                                        </div>
                                        <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: 50, background: c.role === 'Editor' ? 'rgba(74,173,168,0.12)' : 'rgba(154,171,187,0.12)', color: c.role === 'Editor' ? 'var(--teal)' : '#9aabbb' }}>{c.role}</span>
                                        <button onClick={() => {
                                            const updated = collaborators.filter((_, idx) => idx !== i)
                                            setCollaborators(updated)
                                            if (data.eventId) {
                                                userSetJSON(`partypal_collabs_${data.eventId}`, updated)
                                                fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: data.eventId, collaborators: updated }) }).catch(() => { })
                                            }
                                        }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '0.8rem' }}>✕</button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9aabbb', fontWeight: 700, fontSize: '0.85rem' }}>No collaborators yet. Add someone to get started!</div>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.2rem', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowCollabModal(false)} style={{ padding: '0.5rem 1.2rem', borderRadius: 8, background: 'transparent', border: '1.5px solid var(--border)', color: '#9aabbb', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Budget Tips Modal */}
            {showBudgetTips && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={() => setShowBudgetTips(false)}>
                    <div className="card" style={{ padding: '2rem', width: '100%', maxWidth: 440, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontFamily: "'Fredoka One',cursive", color: 'var(--navy)', marginBottom: '0.3rem' }}>💡 Budget Tips</h2>
                        <p style={{ fontSize: '0.78rem', color: '#9aabbb', fontWeight: 600, marginBottom: '1.2rem' }}>Smart suggestions to help you stay on target and get the most from your budget.</p>
                        {data.plan.tips && data.plan.tips.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                {data.plan.tips.map((tip, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '0.7rem', padding: '0.8rem', background: 'var(--light-bg)', borderRadius: 10 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: ['rgba(74,173,168,0.15)', 'rgba(247,201,72,0.15)', 'rgba(232,137,106,0.15)', 'rgba(123,94,167,0.15)'][i % 4], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900, color: ['var(--teal)', '#c4880a', '#E8896A', '#7B5EA7'][i % 4], flexShrink: 0 }}>{i + 1}</div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy)', lineHeight: 1.5 }}>{tip}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#9aabbb', fontWeight: 700 }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🤔</div>
                                No tips available yet. Generate a plan with AI to get smart budget suggestions!
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
                            <button onClick={() => setShowBudgetTips(false)} style={{ padding: '0.5rem 1.2rem', borderRadius: 8, background: 'linear-gradient(135deg, var(--teal), #3D8C6E)', color: '#fff', border: 'none', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}>Got it!</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ NOTIFY GUESTS MODAL ══ */}
            {showNotifyModal && (
                <div onClick={() => { if (!isSendingNotifications) { setShowNotifyModal(false) } }} style={{
                    position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: 'white', borderRadius: 20, maxWidth: 480, width: '100%', maxHeight: '85vh',
                        overflow: 'auto', boxShadow: '0 30px 80px rgba(0,0,0,0.25)',
                        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}>
                        {/* Header */}
                        <div style={{
                            background: 'linear-gradient(135deg, #1a2535, #2D4059)', padding: '1.5rem 1.8rem',
                            borderRadius: '20px 20px 0 0', textAlign: 'center',
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.3rem' }}>📧</div>
                            <h2 style={{ fontFamily: "'Fredoka One', cursive", color: '#fff', fontSize: '1.1rem', margin: '0 0 0.3rem' }}>
                                Notify Your Guests?
                            </h2>
                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: 600, margin: 0 }}>
                                Event details have changed — let your guests know
                            </p>
                        </div>

                        <div style={{ padding: '1.5rem 1.8rem' }}>
                            {notifyResult ? (
                                /* Success state */
                                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                                        {notifyResult.sent > 0 ? '✅' : '📋'}
                                    </div>
                                    <h3 style={{ fontFamily: "'Fredoka One', cursive", color: 'var(--navy)', fontSize: '1rem', margin: '0 0 0.5rem' }}>
                                        {notifyResult.sent > 0 ? 'Notifications Sent!' : 'Preview Ready'}
                                    </h3>
                                    <p style={{ color: '#6b7c93', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 1rem' }}>
                                        {notifyResult.message}
                                    </p>
                                    <button onClick={() => setShowNotifyModal(false)} style={{
                                        background: 'linear-gradient(135deg, var(--teal), #3D8C6E)', color: '#fff',
                                        border: 'none', borderRadius: 10, padding: '0.6rem 1.5rem',
                                        fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
                                    }}>Done</button>
                                </div>
                            ) : (
                                <>
                                    {/* Changes table */}
                                    <h4 style={{ fontFamily: "'Fredoka One', cursive", fontSize: '0.85rem', color: 'var(--navy)', margin: '0 0 0.6rem' }}>
                                        What Changed
                                    </h4>
                                    <div style={{
                                        border: '1.5px solid #e2e6ea', borderRadius: 12, overflow: 'hidden',
                                        marginBottom: '1.2rem',
                                    }}>
                                        {pendingChanges.map((c, i) => (
                                            <div key={i} style={{
                                                display: 'grid', gridTemplateColumns: '90px 1fr 1fr',
                                                borderBottom: i < pendingChanges.length - 1 ? '1px solid #f0f2f5' : 'none',
                                            }}>
                                                <div style={{ padding: '0.6rem 0.8rem', fontWeight: 800, fontSize: '0.78rem', color: 'var(--navy)', background: '#f7f8fa' }}>
                                                    {c.field}
                                                </div>
                                                <div style={{ padding: '0.6rem 0.8rem', fontSize: '0.78rem', color: '#9aabbb', textDecoration: 'line-through', fontWeight: 600 }}>
                                                    {c.oldValue.length > 30 ? c.oldValue.slice(0, 30) + '…' : c.oldValue}
                                                </div>
                                                <div style={{ padding: '0.6rem 0.8rem', fontSize: '0.78rem', color: 'var(--teal)', fontWeight: 800 }}>
                                                    {c.newValue.length > 30 ? c.newValue.slice(0, 30) + '…' : c.newValue}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Guest count */}
                                    <div style={{
                                        background: 'rgba(74,173,168,0.06)', border: '1.5px solid rgba(74,173,168,0.15)',
                                        borderRadius: 12, padding: '0.8rem 1rem', marginBottom: '1.2rem',
                                        display: 'flex', alignItems: 'center', gap: '0.7rem',
                                    }}>
                                        <span style={{ fontSize: '1.3rem' }}>👥</span>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--navy)' }}>
                                                {(() => {
                                                    const storageKey = data.eventId ? `partypal_eventguests_${data.eventId}` : 'partypal_eventguests'
                                                    try {
                                                        const stored = localStorage.getItem(storageKey)
                                                        const parsed = stored ? JSON.parse(stored) : []
                                                        const withEmails = Array.isArray(parsed) ? parsed.filter((g: { email?: string }) => g.email?.includes('@')) : []
                                                        const dashboardWithEmails = eventGuests.filter(g => g.email?.includes('@'))
                                                        const total = new Set([...withEmails.map((g: { email: string }) => g.email), ...dashboardWithEmails.map(g => g.email)]).size
                                                        return `${total} guest${total !== 1 ? 's' : ''} will be notified`
                                                    } catch { return 'Guests will be notified' }
                                                })()}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#9aabbb', fontWeight: 600 }}>
                                                Only guests with valid email addresses
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                                        <button
                                            onClick={() => setShowNotifyModal(false)}
                                            style={{
                                                flex: 1, padding: '0.65rem', borderRadius: 10,
                                                border: '1.5px solid #e2e6ea', background: '#fff',
                                                fontWeight: 800, fontSize: '0.82rem', color: '#9aabbb',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Skip
                                        </button>
                                        <button
                                            disabled={isSendingNotifications}
                                            onClick={async () => {
                                                setIsSendingNotifications(true)
                                                try {
                                                    // Gather all guests with emails
                                                    const storageKey = data.eventId ? `partypal_eventguests_${data.eventId}` : 'partypal_eventguests'
                                                    const stored = localStorage.getItem(storageKey)
                                                    const guestManagerGuests = stored ? JSON.parse(stored) : []
                                                    const allGuests = [
                                                        ...(Array.isArray(guestManagerGuests) ? guestManagerGuests : []),
                                                        ...eventGuests.filter(dg => !(guestManagerGuests || []).some((gg: { email: string }) => gg.email === dg.email)),
                                                    ].filter((g: { email?: string }) => g.email?.includes('@'))

                                                    const res = await fetch('/api/notify', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            guests: allGuests.map((g: { name: string; email: string }) => ({ name: g.name, email: g.email })),
                                                            eventName: data.eventType,
                                                            changes: pendingChanges.map(c => ({
                                                                field: c.field.replace(/^[^\w]*/, '').trim(),
                                                                oldValue: c.oldValue,
                                                                newValue: c.newValue,
                                                            })),
                                                            eventDate: data.date,
                                                            eventLocation: data.location,
                                                            eventTheme: data.theme,
                                                            hostName: user?.displayName || 'Your Host',
                                                        }),
                                                    })
                                                    const result = await res.json()
                                                    setNotifyResult(result)
                                                    if (result.sent > 0) {
                                                        showToast(`📧 Notified ${result.sent} guest${result.sent !== 1 ? 's' : ''}!`, 'success')
                                                    } else {
                                                        showToast(result.message || 'Notification preview ready', 'info')
                                                    }
                                                } catch {
                                                    showToast('Failed to send notifications', 'error')
                                                }
                                                setIsSendingNotifications(false)
                                            }}
                                            style={{
                                                flex: 2, padding: '0.65rem', borderRadius: 10,
                                                border: 'none',
                                                background: isSendingNotifications ? '#9aabbb' : 'linear-gradient(135deg, var(--teal), #3D8C6E)',
                                                fontWeight: 800, fontSize: '0.82rem', color: '#fff',
                                                cursor: isSendingNotifications ? 'wait' : 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                            }}
                                        >
                                            {isSendingNotifications ? (
                                                <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Sending...</>
                                            ) : (
                                                <>📧 Notify Guests</>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </main >
    )
}

