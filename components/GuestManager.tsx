'use client'
import React, { useState, useEffect } from 'react'
import { userGet, userSetJSON, userGetJSON } from '@/lib/userStorage'
import { showToast } from '@/components/Toast'
import styles from './GuestManager.module.css'

interface AdditionalGuest {
    id: string; name: string; dietary: string; relationship: string
}

interface Guest {
    id: string; name: string; email: string; status: 'going' | 'maybe' | 'declined' | 'pending'
    dietary: string; additionalGuests: AdditionalGuest[]; avatar: string; color: string
}

const DIETARY_OPTIONS = ['None', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Nut Allergy', 'Kosher', 'Halal', 'Dairy-Free', 'Shellfish Allergy']
const RELATIONSHIP_OPTIONS = ['Partner', 'Spouse', 'Child', 'Family', 'Friend', 'Other']
const COLORS = ['#E8896A', '#4AADA8', '#F7C948', '#3D8C6E', '#7B5EA7', '#2D4059']
const STATUS_COLORS: Record<string, string> = { going: '#3D8C6E', maybe: '#c4880a', declined: '#E8896A', pending: '#9aabbb' }
const STATUS_BG: Record<string, string> = { going: 'rgba(61,140,110,0.1)', maybe: 'rgba(247,201,72,0.15)', declined: 'rgba(232,137,106,0.1)', pending: 'rgba(150,150,170,0.1)' }

const DEFAULT_GUESTS: Guest[] = [
    { id: '1', name: 'Sarah Anderson', email: 'sarah@email.com', status: 'going', dietary: 'None', additionalGuests: [{ id: 'a1', name: 'Mike Anderson', dietary: 'None', relationship: 'Spouse' }], avatar: 'SA', color: '#E8896A' },
    { id: '2', name: 'Marcus Johnson', email: 'marcus@email.com', status: 'going', dietary: 'Vegetarian', additionalGuests: [], avatar: 'MJ', color: '#4AADA8' },
    { id: '3', name: 'Lauren Park', email: 'lauren@email.com', status: 'maybe', dietary: 'Gluten-Free', additionalGuests: [{ id: 'a2', name: 'Chris Park', dietary: 'None', relationship: 'Spouse' }, { id: 'a3', name: 'Lily Park', dietary: 'Dairy-Free', relationship: 'Child' }], avatar: 'LP', color: '#F7C948' },
    { id: '4', name: 'David Kim', email: 'david@email.com', status: 'going', dietary: 'None', additionalGuests: [], avatar: 'DK', color: '#3D8C6E' },
    { id: '5', name: 'Tanya Robinson', email: 'tanya@email.com', status: 'pending', dietary: 'Vegan', additionalGuests: [], avatar: 'TR', color: '#7B5EA7' },
    { id: '6', name: 'Nathan Williams', email: 'nathan@email.com', status: 'declined', dietary: 'None', additionalGuests: [], avatar: 'NW', color: '#E8896A' },
]

interface GuestManagerProps {
    eventId?: string
    planData?: { eventType?: string; theme?: string; date?: string; location?: string; eventId?: string }
    isDemo?: boolean
}

export default function GuestManager({ eventId, planData: propPlanData, isDemo }: GuestManagerProps) {
    const [guests, setGuests] = useState<Guest[]>(isDemo ? DEFAULT_GUESTS : [])
    const [showAdd, setShowAdd] = useState(false)
    const [showBulk, setShowBulk] = useState(false)
    const [showCircles, setShowCircles] = useState(false)
    const [circleContacts, setCircleContacts] = useState<{ id: string; name: string; email: string; phone: string; circles: string[]; avatar: string; color: string }[]>([])
    const [savedCircles, setSavedCircles] = useState<string[]>([])
    const [selectedCircleFilter, setSelectedCircleFilter] = useState<string | null>(null)
    const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())
    const [bulkText, setBulkText] = useState('')
    const [newGuest, setNewGuest] = useState({ name: '', email: '', dietary: 'None', additionalGuests: [] as AdditionalGuest[] })
    const inviteKey = eventId ? `partypal_invite_${eventId}` : 'partypal_invite'
    const [invite, setInvite] = useState<{ subject?: string; message?: string; smsVersion?: string; customImage?: string; coverPhoto?: string } | null>(() => {
        if (typeof window === 'undefined') return null
        return userGetJSON<{ subject?: string; message?: string; smsVersion?: string; customImage?: string; coverPhoto?: string } | null>(inviteKey, null)
    })
    const [loadingInvite, setLoadingInvite] = useState(false)
    const [planData, setPlanData] = useState<{ eventType?: string; theme?: string; date?: string; location?: string; eventId?: string }>(propPlanData || {})
    const [copied, setCopied] = useState(false)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<string>('all')
    const [expandedGuest, setExpandedGuest] = useState<string | null>(null)
    const [inviteTheme, setInviteTheme] = useState(propPlanData?.theme || 'Modern & Fun')
    const [inviteTemp, setInviteTemp] = useState(0.7)
    const [rsvpByDate, setRsvpByDate] = useState('')
    const [refineInput, setRefineInput] = useState('')
    const bookmarkKey = eventId ? `partypal_bookmarks_${eventId}` : 'partypal_bookmarks'
    const [bookmarks, setBookmarks] = useState<{ name: string; invite: { subject?: string; message?: string; smsVersion?: string } }[]>(() => {
        if (typeof window === 'undefined') return []
        return userGetJSON(bookmarkKey, [])
    })
    const [editingBookmarkIdx, setEditingBookmarkIdx] = useState<number | null>(null)
    const [isRefining, setIsRefining] = useState(false)
    const [isEditingInvite, setIsEditingInvite] = useState(false)
    const [inviteCollapsed, setInviteCollapsed] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [isPublished, setIsPublished] = useState(false)
    const [lastPublishedInvite, setLastPublishedInvite] = useState<string>('')
    const themeChangeRef = React.useRef(false)
    const customInviteRef = React.useRef<HTMLInputElement>(null)
    const coverPhotoRef = React.useRef<HTMLInputElement>(null)

    const resizeImage = (file: File, maxW: number): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = (e) => {
                const img = new Image()
                img.onload = () => {
                    const canvas = document.createElement('canvas')
                    const ratio = Math.min(maxW / img.width, maxW / img.height, 1)
                    canvas.width = img.width * ratio
                    canvas.height = img.height * ratio
                    const ctx = canvas.getContext('2d')!
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                    resolve(canvas.toDataURL('image/jpeg', 0.75))
                }
                img.src = e.target?.result as string
            }
            reader.readAsDataURL(file)
        })
    }

    const handleCustomInviteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const dataUrl = await resizeImage(file, 800)
        setInvite(prev => prev ? { ...prev, customImage: dataUrl } : { customImage: dataUrl })
        showToast('Custom invite image uploaded!', 'success')
        e.target.value = ''
    }

    const handleCoverPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const dataUrl = await resizeImage(file, 1200)
        setInvite(prev => prev ? { ...prev, coverPhoto: dataUrl } : { coverPhoto: dataUrl })
        showToast('Cover photo uploaded!', 'success')
        e.target.value = ''
    }

    // Persist invite to localStorage whenever it changes
    useEffect(() => {
        userSetJSON(inviteKey, invite)
        // Auto-sync to Firestore only if published and content hasn't changed since publish
        // (We no longer auto-sync — user must explicitly Publish)
    }, [invite, inviteKey])

    // Sync rsvpByDate to Firestore independently (always ok to sync)
    useEffect(() => {
        if (planData.eventId && rsvpByDate) {
            fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: planData.eventId, rsvpBy: rsvpByDate }) }).catch(() => { })
        }
    }, [rsvpByDate, planData.eventId])

    // Detect if invite has changed since last publish
    const inviteFingerprint = invite ? JSON.stringify({ s: invite.subject, m: invite.message, sm: invite.smsVersion, ci: invite.customImage, cp: invite.coverPhoto }) : ''
    const hasUnpublishedChanges = invite && (!isPublished || inviteFingerprint !== lastPublishedInvite)

    useEffect(() => { userSetJSON(bookmarkKey, bookmarks) }, [bookmarks, bookmarkKey])

    // Auto-regenerate invite when theme changes (only if invite already exists)
    useEffect(() => {
        if (themeChangeRef.current && invite) {
            generateInvite()
        }
        themeChangeRef.current = false
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inviteTheme])

    const storageKey = eventId ? `partypal_eventguests_${eventId}` : 'partypal_eventguests'

    useEffect(() => {
        if (isDemo) return
        const saved = userGetJSON<Guest[]>(storageKey, [])
        if (saved.length > 0) setGuests(saved)
        if (!propPlanData) {
            const stored = userGet('partyplan')
            if (stored) {
                const p = JSON.parse(stored)
                setPlanData({ eventType: p.eventType, theme: p.theme, date: p.date, location: p.location, eventId: p.eventId || eventId })
            }
        }
    }, [eventId, storageKey, propPlanData])

    // Load contacts & circles from localStorage
    useEffect(() => {
        setCircleContacts(userGetJSON('partypal_contacts', []))
        setSavedCircles(userGetJSON('partypal_circles', ['Family', 'Close Friends', 'Work', 'College', 'Neighbors', 'Kids']))
    }, [])

    useEffect(() => {
        if (!isDemo && guests.length > 0) userSetJSON(storageKey, guests)
    }, [guests, storageKey])

    // Fetch RSVPs from Firestore and merge into guest list
    useEffect(() => {
        if (isDemo || !eventId) return
        const fetchRsvps = () => {
            fetch(`/api/events/${eventId}?include=rsvps`)
                .then(r => r.json())
                .then(data => {
                    if (!data.rsvps || data.rsvps.length === 0) return
                    setGuests(prev => {
                        let updated = [...prev]
                        let changed = false
                        for (const rsvp of data.rsvps) {
                            const rName = (rsvp.name || '').trim().toLowerCase()
                            const rEmail = (rsvp.email || '').trim().toLowerCase()
                            // Find matching guest
                            const existingIdx = updated.findIndex(g =>
                                (rEmail && g.email.toLowerCase() === rEmail) ||
                                g.name.toLowerCase() === rName
                            )
                            const rsvpStatus = rsvp.response === 'going' ? 'going' : rsvp.response === 'maybe' ? 'maybe' : rsvp.response === 'declined' ? 'declined' : 'pending'
                            if (existingIdx >= 0) {
                                // Update status if changed
                                if (updated[existingIdx].status !== rsvpStatus) {
                                    updated[existingIdx] = { ...updated[existingIdx], status: rsvpStatus as Guest['status'], dietary: rsvp.dietary || updated[existingIdx].dietary }
                                    changed = true
                                }
                            } else {
                                // Add new guest from RSVP
                                const avatar = rsvp.name ? rsvp.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() : '??'
                                const additionalGuests = (rsvp.additionalGuests || []).map((ag: { name: string; dietary?: string; relationship?: string }, i: number) => ({
                                    id: `rsvp_${rsvp.id}_${i}`,
                                    name: ag.name,
                                    dietary: ag.dietary || 'None',
                                    relationship: ag.relationship || 'Friend',
                                }))
                                updated.push({
                                    id: `rsvp_${rsvp.id}`,
                                    name: rsvp.name || 'Unknown',
                                    email: rsvp.email || '',
                                    status: rsvpStatus as Guest['status'],
                                    dietary: rsvp.dietary || 'None',
                                    additionalGuests,
                                    avatar,
                                    color: COLORS[updated.length % COLORS.length],
                                })
                                changed = true
                            }
                        }
                        if (changed) {
                            userSetJSON(storageKey, updated)
                            return updated
                        }
                        return prev
                    })
                })
                .catch(() => { })
        }
        fetchRsvps()
        const interval = setInterval(fetchRsvps, 30000) // Poll every 30s
        return () => clearInterval(interval)
    }, [eventId, isDemo, storageKey])

    const totalHeadcount = guests.reduce((sum, g) => sum + 1 + g.additionalGuests.length, 0)
    const goingHeadcount = guests.filter(g => g.status === 'going').reduce((sum, g) => sum + 1 + g.additionalGuests.length, 0)

    const stats = {
        total: guests.length, headcount: totalHeadcount,
        going: guests.filter(g => g.status === 'going').length, goingHeadcount,
        maybe: guests.filter(g => g.status === 'maybe').length,
        declined: guests.filter(g => g.status === 'declined').length,
        pending: guests.filter(g => g.status === 'pending').length,
    }

    const addAdditionalToNew = () => {
        setNewGuest(prev => ({ ...prev, additionalGuests: [...prev.additionalGuests, { id: Date.now().toString(), name: '', dietary: 'None', relationship: 'Partner' }] }))
    }
    const updateAdditionalNew = (idx: number, field: string, value: string) => {
        setNewGuest(prev => ({ ...prev, additionalGuests: prev.additionalGuests.map((ag, i) => i === idx ? { ...ag, [field]: value } : ag) }))
    }
    const removeAdditionalNew = (idx: number) => {
        setNewGuest(prev => ({ ...prev, additionalGuests: prev.additionalGuests.filter((_, i) => i !== idx) }))
    }

    const addGuest = () => {
        if (!newGuest.name || !newGuest.email) return
        const initials = newGuest.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        const validAdditional = newGuest.additionalGuests.filter(ag => ag.name.trim())
        setGuests(prev => [...prev, {
            id: Date.now().toString(), name: newGuest.name, email: newGuest.email,
            status: 'pending', dietary: newGuest.dietary, additionalGuests: validAdditional,
            avatar: initials, color: COLORS[Math.floor(Math.random() * COLORS.length)]
        }])
        setNewGuest({ name: '', email: '', dietary: 'None', additionalGuests: [] })
        setShowAdd(false)
        showToast(`${newGuest.name} added`, 'success')
    }

    const bulkImport = () => {
        const lines = bulkText.split('\n').filter(l => l.trim())
        const newGuests: Guest[] = lines.map((line, i) => {
            const parts = line.split(/[,\t]/).map(s => s.trim())
            const name = parts[0] || 'Guest'
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
            return { id: (Date.now() + i).toString(), name, email: parts[1] || '', status: 'pending' as const, dietary: 'None', additionalGuests: [], avatar: initials, color: COLORS[i % COLORS.length] }
        })
        setGuests(prev => [...prev, ...newGuests])
        setBulkText(''); setShowBulk(false)
        showToast(`${newGuests.length} guests imported!`, 'success')
    }

    const updateStatus = (id: string, status: Guest['status']) => { setGuests(prev => prev.map(g => g.id === id ? { ...g, status } : g)); showToast('RSVP updated', 'info') }
    const removeGuest = (id: string) => { const g = guests.find(x => x.id === id); setGuests(prev => prev.filter(x => x.id !== id)); showToast(`${g?.name || 'Guest'} removed`, 'info') }
    const addAdditionalToExisting = (guestId: string) => { setGuests(prev => prev.map(g => g.id === guestId ? { ...g, additionalGuests: [...g.additionalGuests, { id: Date.now().toString(), name: '', dietary: 'None', relationship: 'Partner' }] } : g)) }
    const updateAdditionalExisting = (guestId: string, addId: string, field: string, value: string) => { setGuests(prev => prev.map(g => g.id === guestId ? { ...g, additionalGuests: g.additionalGuests.map(ag => ag.id === addId ? { ...ag, [field]: value } : ag) } : g)) }
    const removeAdditionalExisting = (guestId: string, addId: string) => { setGuests(prev => prev.map(g => g.id === guestId ? { ...g, additionalGuests: g.additionalGuests.filter(ag => ag.id !== addId) } : g)) }
    const updateGuestDietary = (guestId: string, dietary: string) => { setGuests(prev => prev.map(g => g.id === guestId ? { ...g, dietary } : g)) }

    const generateInvite = async () => {
        setLoadingInvite(true)
        try {
            const res = await fetch('/api/guests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate_invite', eventDetails: { ...planData, inviteTheme, hostName: 'Your Host' }, temperature: inviteTemp }) })
            const data = await res.json()
            setInvite(data); setIsEditingInvite(false)
            showToast('Invite generated!', 'success')
        } catch { showToast('Failed to generate invite', 'error') }
        setLoadingInvite(false)
    }

    const refineInvite = async () => {
        if (!refineInput.trim() || !invite) return
        setIsRefining(true)
        try {
            const res = await fetch('/api/guests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refine_invite', currentSubject: invite.subject, currentMessage: invite.message, instruction: refineInput }) })
            const data = await res.json()
            if (data.subject) { setInvite(prev => prev ? { ...prev, subject: data.subject, message: data.message, smsVersion: data.smsVersion || prev?.smsVersion } : prev); setRefineInput(''); setIsEditingInvite(false); showToast('Invite refined!', 'success') }
        } catch { showToast('Failed to refine invite', 'error') }
        setIsRefining(false)
    }

    const getRSVPLink = (versionId?: string) => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://partypal.social'
        const eid = planData.eventId || eventId || ''
        return versionId ? `${origin}/rsvp?e=${eid}&v=${versionId}` : `${origin}/rsvp?e=${eid}`
    }

    const copyRSVPLink = async () => {
        const eid = planData.eventId || eventId || ''
        if (invite && eid) {
            // Snapshot current invite as a frozen version (including images)
            const vId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
            try {
                await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: eid, inviteVersion: { id: vId, subject: invite.subject, message: invite.message, smsVersion: invite.smsVersion, customImage: invite.customImage || '', coverPhoto: invite.coverPhoto || '' } }) })
            } catch { /* best effort */ }
            const link = getRSVPLink(vId)
            navigator.clipboard.writeText(link)
            setCopied(true); setTimeout(() => setCopied(false), 2000)
            showToast('RSVP link copied!', 'success')
        } else {
            navigator.clipboard.writeText(getRSVPLink())
            setCopied(true); setTimeout(() => setCopied(false), 2000)
            showToast('RSVP link copied!', 'success')
        }
    }

    const publishInvite = async () => {
        if (!invite || !planData.eventId) return
        const invitePayload = { ...invite, customImage: invite.customImage || null, coverPhoto: invite.coverPhoto || null }
        try {
            await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: planData.eventId, invite: invitePayload, rsvpBy: rsvpByDate || null }) })
            setIsPublished(true)
            setLastPublishedInvite(JSON.stringify({ s: invite.subject, m: invite.message, sm: invite.smsVersion, ci: invite.customImage, cp: invite.coverPhoto }))
            showToast('Invite published! Live RSVP page updated.', 'success')
        } catch {
            showToast('Failed to publish', 'error')
        }
    }

    const shareWhatsApp = () => {
        const text = invite ? `${invite.subject}\n\n${invite.message}\n\nRSVP here: ${getRSVPLink()}` : `You're invited! RSVP here: ${getRSVPLink()}`
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }

    const dietaryCounts: Record<string, number> = {}
    guests.forEach(g => {
        dietaryCounts[g.dietary] = (dietaryCounts[g.dietary] || 0) + 1
        g.additionalGuests.forEach(ag => { dietaryCounts[ag.dietary] = (dietaryCounts[ag.dietary] || 0) + 1 })
    })

    const filteredGuests = guests.filter(g => {
        if (filter !== 'all' && g.status !== filter) return false
        if (search && !g.name.toLowerCase().includes(search.toLowerCase()) && !g.email.toLowerCase().includes(search.toLowerCase())) return false
        return true
    })

    return (
        <>
            <div>
                {/* Stats */}
                <div className={styles.statsRow}>
                    {[
                        { label: 'Invitations', val: stats.total, sub: `${stats.headcount} people`, color: 'var(--navy)', fk: 'all' },
                        { label: 'Going ✓', val: stats.going, sub: `${stats.goingHeadcount} people`, color: '#3D8C6E', fk: 'going' },
                        { label: 'Maybe', val: stats.maybe, sub: '', color: '#c4880a', fk: 'maybe' },
                        { label: 'Declined', val: stats.declined, sub: '', color: '#E8896A', fk: 'declined' },
                        { label: 'Pending', val: stats.pending, sub: '', color: '#9aabbb', fk: 'pending' },
                    ].map(s => (
                        <div key={s.label} className={styles.statCard} onClick={() => setFilter(s.fk)} style={{ borderColor: filter === s.fk ? s.color : undefined }}>
                            <div className={styles.statNum} style={{ color: s.color }}>{s.val}</div>
                            <div className={styles.statLabel}>{s.label}</div>
                            {s.sub && <div className={styles.statSub}>{s.sub}</div>}
                        </div>
                    ))}
                </div>

                {/* Invite card or generate prompt */}
                {!invite && (
                    <div className="card" style={{ padding: '0.8rem 1.2rem', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '0.9rem', color: 'var(--navy)' }}>✉️ Invitation</h3>
                        <button className={styles.actionBtn} onClick={generateInvite} disabled={loadingInvite} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>{loadingInvite ? '⏳...' : '✨ Generate'}</button>
                        <button className={styles.secondaryBtn} onClick={() => setShowPreview(true)} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>👁️ Preview</button>
                        {hasUnpublishedChanges
                            ? <button onClick={publishInvite} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem', background: 'rgba(74,173,168,0.12)', border: '1.5px solid rgba(74,173,168,0.4)', borderRadius: 6, fontWeight: 800, color: 'var(--teal)', cursor: 'pointer' }}>📤 Publish</button>
                            : <button className={styles.secondaryBtn} onClick={copyRSVPLink} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>{copied ? '✓ Copied!' : '🔗 Copy'}</button>
                        }
                    </div>
                )}
                {invite && (
                    <div className="card" style={{ padding: '1.2rem', paddingBottom: 0, marginBottom: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 0, cursor: 'pointer', gap: '0.4rem', flexWrap: 'wrap' }} onClick={() => setInviteCollapsed(c => !c)}>
                            <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '0.9rem', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', margin: 0 }}>
                                <span style={{ fontSize: '0.7rem', transition: 'transform 0.2s', display: 'inline-block', transform: inviteCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
                                ✉️ Invitation
                            </h3>
                            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                <button className={styles.actionBtn} onClick={generateInvite} disabled={loadingInvite} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>{loadingInvite ? '⏳...' : '✨ Generate'}</button>
                                <button className={styles.secondaryBtn} onClick={() => setShowPreview(true)} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>👁️ Preview</button>
                                {hasUnpublishedChanges
                                    ? <button onClick={publishInvite} style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: 'rgba(74,173,168,0.12)', border: '1.5px solid rgba(74,173,168,0.4)', borderRadius: 6, fontWeight: 800, color: 'var(--teal)', cursor: 'pointer' }}>📤 Publish</button>
                                    : <button className={styles.secondaryBtn} onClick={copyRSVPLink} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>{copied ? '✓ Copied!' : '🔗 Copy'}</button>
                                }
                            </div>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                                {!inviteCollapsed && <button onClick={() => setIsEditingInvite(!isEditingInvite)} style={{ background: 'none', border: '1px solid var(--teal)', borderRadius: 6, padding: '0.15rem 0.5rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--teal)', cursor: 'pointer' }}>
                                    {isEditingInvite ? '✕ Cancel' : '✏️ Edit'}
                                </button>}
                            </div>
                        </div>
                        {!inviteCollapsed && (<>
                            {isEditingInvite ? (
                                <>
                                    <input value={invite.subject || ''} onChange={e => setInvite(prev => prev ? { ...prev, subject: e.target.value } : prev)} className={styles.addInput} style={{ width: '100%', marginBottom: '0.4rem', fontWeight: 700 }} placeholder="Subject line" />
                                    <textarea value={invite.message || ''} onChange={e => setInvite(prev => prev ? { ...prev, message: e.target.value } : prev)} className={styles.addInput} style={{ width: '100%', minHeight: 100, marginBottom: '0.4rem', resize: 'vertical', lineHeight: 1.5 }} />
                                </>
                            ) : isRefining ? (
                                <div style={{ position: 'relative' }}>
                                    <div className={styles.inviteSubject} style={{ opacity: 0.3 }}>{invite.subject}</div>
                                    <p className={styles.inviteMessage} style={{ opacity: 0.3 }}>{invite.message}</p>
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div className="spinner" style={{ width: 28, height: 28, borderWidth: 2 }} />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--teal)' }}>Refining your invite...</span>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className={styles.inviteSubject}>{invite.subject}</div>
                                    <p className={styles.inviteMessage}>{invite.message}</p>
                                </>
                            )}
                            {invite.smsVersion && (
                                <div className={styles.smsBox}>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--teal)', marginBottom: '0.2rem' }}>SMS VERSION</div>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--navy)', fontWeight: 600, margin: 0 }}>{invite.smsVersion}</p>
                                </div>
                            )}
                            {/* Upload image previews & remove buttons */}
                            {(invite.customImage || invite.coverPhoto) && (
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap', paddingTop: '0.6rem', borderTop: '1px solid #eee', alignItems: 'flex-start' }}>
                                    {invite.customImage && (
                                        <div>
                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', marginBottom: '0.2rem' }}>Custom Invite</div>
                                            <img src={invite.customImage} alt="Custom invite" style={{ maxWidth: 160, borderRadius: 8, border: '1.5px solid var(--border)' }} />
                                            <div><button onClick={() => { setInvite(prev => prev ? { ...prev, customImage: undefined } : prev); showToast('Custom invite removed', 'info') }} style={{ background: 'none', border: '1px solid rgba(232,137,106,0.3)', borderRadius: 6, padding: '0.15rem 0.4rem', fontSize: '0.62rem', fontWeight: 800, color: '#E8896A', cursor: 'pointer', marginTop: '0.3rem' }}>✕ Remove</button></div>
                                        </div>
                                    )}
                                    {invite.coverPhoto && (
                                        <div>
                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', marginBottom: '0.2rem' }}>Cover Photo</div>
                                            <img src={invite.coverPhoto} alt="Cover" style={{ maxWidth: 160, borderRadius: 8, border: '1.5px solid var(--border)' }} />
                                            <div><button onClick={() => { setInvite(prev => prev ? { ...prev, coverPhoto: undefined } : prev); showToast('Cover photo removed', 'info') }} style={{ background: 'none', border: '1px solid rgba(232,137,106,0.3)', borderRadius: 6, padding: '0.15rem 0.4rem', fontSize: '0.62rem', fontWeight: 800, color: '#E8896A', cursor: 'pointer', marginTop: '0.3rem' }}>✕ Remove</button></div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div style={{ marginTop: '0.6rem', borderTop: '1px solid #eee', paddingTop: '0.6rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 200 }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '0.3rem' }}>🤖 Refine with AI</div>
                                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                                            <input value={refineInput} onChange={e => setRefineInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') refineInvite() }} placeholder="e.g. Make it more formal..." className={styles.addInput} style={{ flex: 1, fontSize: '0.78rem' }} />
                                            <button onClick={refineInvite} disabled={isRefining || !refineInput.trim()} style={{ background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.35rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', opacity: isRefining || !refineInput.trim() ? 0.5 : 1 }}>
                                                {isRefining ? '...' : '✨ Refine'}
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ minWidth: 120 }}>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#9aabbb', marginBottom: '0.25rem' }}>🌡️ Creativity</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <input type="range" min="0.3" max="1.0" step="0.1" value={inviteTemp} onChange={e => setInviteTemp(parseFloat(e.target.value))} style={{ width: 70, accentColor: 'var(--teal)' }} />
                                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--navy)' }}>{inviteTemp <= 0.4 ? '🧐' : inviteTemp <= 0.7 ? '⚖️' : '🎨'}</span>
                                        </div>
                                    </div>
                                    <div style={{ minWidth: 130 }}>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#9aabbb', marginBottom: '0.25rem' }}>🎨 Style</div>
                                        <select value={inviteTheme} onChange={e => { themeChangeRef.current = true; setInviteTheme(e.target.value) }} className={styles.addInput} style={{ margin: 0, padding: '0.25rem 0.4rem', fontSize: '0.72rem', width: '100%' }}>
                                            <option>Modern & Fun</option><option>Elegant & Formal</option><option>Tropical Paradise</option><option>Rustic & Cozy</option><option>Vintage & Retro</option><option>Minimalist & Clean</option><option>Glamorous & Luxe</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <button onClick={() => { setInvite(null); setIsPublished(false); setLastPublishedInvite(''); if (planData.eventId) fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: planData.eventId, invite: null }) }).catch(() => { }) }} style={{ background: 'none', border: '1px solid rgba(232,137,106,0.3)', borderRadius: 6, padding: '0.25rem 0.6rem', fontSize: '0.7rem', fontWeight: 800, color: '#E8896A', cursor: 'pointer' }}>✕ Clear Invite</button>
                                    <button disabled={bookmarks.length >= 3} onClick={() => { if (invite && bookmarks.length < 3) { setBookmarks(prev => [...prev, { name: `Saved ${prev.length + 1}`, invite: { ...invite } }]); showToast('Invite bookmarked!', 'success') } }} style={{ background: 'none', border: '1px solid var(--yellow)', borderRadius: 6, padding: '0.25rem 0.6rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--yellow)', cursor: bookmarks.length >= 3 ? 'not-allowed' : 'pointer', opacity: bookmarks.length >= 3 ? 0.4 : 1 }}>⭐ Bookmark{bookmarks.length >= 3 ? ' (3/3)' : ` (${bookmarks.length}/3)`}</button>
                                    {bookmarks.map((bm, idx) => (
                                        <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                                            {editingBookmarkIdx === idx ? (
                                                <input value={bm.name} onChange={e => setBookmarks(prev => prev.map((b, i) => i === idx ? { ...b, name: e.target.value } : b))} onBlur={() => setEditingBookmarkIdx(null)} onKeyDown={e => { if (e.key === 'Enter') setEditingBookmarkIdx(null) }} autoFocus className={styles.addInput} style={{ margin: 0, padding: '0.15rem 0.3rem', fontSize: '0.65rem', width: 60, fontWeight: 700 }} />
                                            ) : (
                                                <button className={styles.secondaryBtn} onClick={() => { setInvite(bm.invite); showToast(`Loaded "${bm.name}"`, 'success') }} onDoubleClick={() => setEditingBookmarkIdx(idx)} title="Click to load, double-click to rename" style={{ fontSize: '0.65rem', padding: '0.2rem 0.4rem' }}>⭐ {bm.name}</button>
                                            )}
                                            <button onClick={() => setBookmarks(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '0.6rem', padding: '0.05rem' }} title="Remove">✕</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>)}
                    </div>
                )}
                {/* RSVP by + Upload — always visible below invitation */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.2rem', marginBottom: '1rem', background: '#fff', borderRadius: '0 0 12px 12px', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb' }}>RSVP by</span>
                    <input type="date" value={rsvpByDate} onChange={e => setRsvpByDate(e.target.value)} className={styles.addInput} style={{ margin: 0, padding: '0.15rem 0.35rem', fontSize: '0.68rem', width: 120 }} />
                    <input ref={customInviteRef} type="file" accept="image/*" onChange={handleCustomInviteUpload} style={{ display: 'none' }} />
                    <input ref={coverPhotoRef} type="file" accept="image/*" onChange={handleCoverPhotoUpload} style={{ display: 'none' }} />
                    <button onClick={() => customInviteRef.current?.click()} style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid var(--border)', borderRadius: 6, padding: '0.15rem 0.5rem', fontSize: '0.65rem', fontWeight: 800, color: 'var(--navy)', cursor: 'pointer' }}>🖼️ Invite</button>
                    <button onClick={() => coverPhotoRef.current?.click()} style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid var(--border)', borderRadius: 6, padding: '0.15rem 0.5rem', fontSize: '0.65rem', fontWeight: 800, color: 'var(--navy)', cursor: 'pointer' }}>📸 Cover</button>
                </div>

                <div className={styles.mainLayout}>
                    <div>

                        {/* Guest management actions */}
                        <div className={styles.actionsRow}>
                            <button className={styles.actionBtn} onClick={() => { setShowAdd(!showAdd); setShowBulk(false); setShowCircles(false) }}>+ Add Guest</button>
                            <button className={styles.secondaryBtn} onClick={() => { setShowBulk(!showBulk); setShowAdd(false); setShowCircles(false) }}>📋 Bulk Import</button>
                            <button className={styles.secondaryBtn} onClick={() => { setShowCircles(!showCircles); setShowAdd(false); setShowBulk(false); setSelectedContactIds(new Set()); setSelectedCircleFilter(null) }}>👥 From Circles</button>
                        </div>

                        {/* Search */}
                        <input className={styles.searchInput} placeholder="🔍 Search guests..." value={search} onChange={e => setSearch(e.target.value)} />

                        {/* Add Form */}
                        {showAdd && (
                            <div className={styles.addForm}>
                                <h4 style={{ fontFamily: "'Fredoka One',cursive", marginBottom: '0.8rem', color: 'var(--navy)', fontSize: '0.95rem' }}>Add New Guest</h4>
                                <div className={styles.addRow}>
                                    <input placeholder="Full Name *" value={newGuest.name} onChange={e => setNewGuest({ ...newGuest, name: e.target.value })} className={styles.addInput} />
                                    <input placeholder="Email *" value={newGuest.email} onChange={e => setNewGuest({ ...newGuest, email: e.target.value })} className={styles.addInput} />
                                </div>
                                <div className={styles.addRow}>
                                    <div>
                                        <label className={styles.fieldLabel}>Dietary Restrictions</label>
                                        <select value={newGuest.dietary} onChange={e => setNewGuest({ ...newGuest, dietary: e.target.value })} className={styles.addInput}>
                                            {DIETARY_OPTIONS.map(d => <option key={d}>{d}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className={styles.additionalSection}>
                                    <div className={styles.additionalHeader}>
                                        <span className={styles.additionalTitle}>👥 Additional Guests</span>
                                        <button type="button" className={styles.addMemberBtn} onClick={addAdditionalToNew}>+ Add Person</button>
                                    </div>
                                    {newGuest.additionalGuests.map((ag, idx) => (
                                        <div key={ag.id} className={styles.additionalRow}>
                                            <input placeholder="Name" value={ag.name} onChange={e => updateAdditionalNew(idx, 'name', e.target.value)} className={styles.addInputSmall} />
                                            <select value={ag.relationship} onChange={e => updateAdditionalNew(idx, 'relationship', e.target.value)} className={styles.addInputSmall}>
                                                {RELATIONSHIP_OPTIONS.map(r => <option key={r}>{r}</option>)}
                                            </select>
                                            <select value={ag.dietary} onChange={e => updateAdditionalNew(idx, 'dietary', e.target.value)} className={styles.addInputSmall}>
                                                {DIETARY_OPTIONS.map(d => <option key={d}>{d}</option>)}
                                            </select>
                                            <button className={styles.removeBtn} onClick={() => removeAdditionalNew(idx)}>✕</button>
                                        </div>
                                    ))}
                                    {newGuest.additionalGuests.length === 0 && <p className={styles.additionalHint}>No additional guests. Click &quot;+ Add Person&quot; to bring family or friends.</p>}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                                    <button className={styles.actionBtn} onClick={addGuest}>Add Guest{newGuest.additionalGuests.length > 0 ? ` + ${newGuest.additionalGuests.length}` : ''}</button>
                                    <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aabbb', fontWeight: 700, fontSize: '0.85rem' }}>Cancel</button>
                                </div>
                            </div>
                        )}

                        {/* Bulk Import */}
                        {showBulk && (
                            <div className={styles.addForm}>
                                <h4 style={{ fontFamily: "'Fredoka One',cursive", marginBottom: '0.4rem', color: 'var(--navy)', fontSize: '0.95rem' }}>Bulk Import Guests</h4>
                                <p style={{ fontSize: '0.78rem', color: '#9aabbb', fontWeight: 600, marginBottom: '0.6rem' }}>One per line: <strong>Name, Email</strong></p>
                                <textarea className={styles.addInput} style={{ minHeight: '100px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }} placeholder={"John Doe, john@email.com\nJane Smith, jane@email.com"} value={bulkText} onChange={e => setBulkText(e.target.value)} />
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                                    <button className={styles.actionBtn} onClick={bulkImport} disabled={!bulkText.trim()}>Import {bulkText.split('\n').filter(l => l.trim()).length} Guests</button>
                                    <button onClick={() => setShowBulk(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aabbb', fontWeight: 700, fontSize: '0.85rem' }}>Cancel</button>
                                </div>
                            </div>
                        )}

                        {/* Select from Circles */}
                        {showCircles && (
                            <div className={styles.addForm}>
                                <h4 style={{ fontFamily: "'Fredoka One',cursive", marginBottom: '0.4rem', color: 'var(--navy)', fontSize: '0.95rem' }}>👥 Select from Circles</h4>
                                <p style={{ fontSize: '0.78rem', color: '#9aabbb', fontWeight: 600, marginBottom: '0.6rem' }}>Pick contacts from your saved circles to add as guests</p>
                                {circleContacts.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9aabbb', fontWeight: 700 }}>
                                        <p>No contacts saved yet.</p>
                                        <a href="/guests" style={{ color: 'var(--teal)', fontWeight: 800, textDecoration: 'underline' }}>Go to Guest Management →</a>
                                    </div>
                                ) : (
                                    <>
                                        {/* Circle filter pills */}
                                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                                            <button onClick={() => setSelectedCircleFilter(null)} style={{ padding: '0.2rem 0.6rem', borderRadius: 50, border: `1.5px solid ${!selectedCircleFilter ? 'var(--teal)' : 'var(--border)'}`, background: !selectedCircleFilter ? 'rgba(74,173,168,0.1)' : 'transparent', color: !selectedCircleFilter ? 'var(--teal)' : '#9aabbb', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>All</button>
                                            {savedCircles.map(c => {
                                                const count = circleContacts.filter(ct => ct.circles.includes(c)).length
                                                if (count === 0) return null
                                                return <button key={c} onClick={() => setSelectedCircleFilter(c)} style={{ padding: '0.2rem 0.6rem', borderRadius: 50, border: `1.5px solid ${selectedCircleFilter === c ? 'var(--teal)' : 'var(--border)'}`, background: selectedCircleFilter === c ? 'rgba(74,173,168,0.1)' : 'transparent', color: selectedCircleFilter === c ? 'var(--teal)' : '#9aabbb', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>{c} ({count})</button>
                                            })}
                                        </div>
                                        {/* Contact list */}
                                        <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                            {circleContacts
                                                .filter(c => !selectedCircleFilter || c.circles.includes(selectedCircleFilter))
                                                .map(c => {
                                                    const alreadyAdded = guests.some(g => g.email === c.email)
                                                    const selected = selectedContactIds.has(c.id)
                                                    return (
                                                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.6rem', borderRadius: 8, background: selected ? 'rgba(74,173,168,0.08)' : 'var(--light-bg)', border: `1.5px solid ${selected ? 'var(--teal)' : 'transparent'}`, cursor: alreadyAdded ? 'default' : 'pointer', opacity: alreadyAdded ? 0.5 : 1 }}>
                                                            <input type="checkbox" disabled={alreadyAdded} checked={selected || alreadyAdded} onChange={() => {
                                                                setSelectedContactIds(prev => {
                                                                    const next = new Set(prev)
                                                                    if (next.has(c.id)) next.delete(c.id); else next.add(c.id)
                                                                    return next
                                                                })
                                                            }} style={{ accentColor: 'var(--teal)', width: 16, height: 16 }} />
                                                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0 }}>{c.avatar}</div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                                                                <div style={{ fontSize: '0.68rem', color: '#9aabbb', fontWeight: 600 }}>{c.email || c.phone || 'No email'}{alreadyAdded ? ' • Already added' : ''}</div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '0.2rem', flexShrink: 0 }}>
                                                                {c.circles.map(ci => <span key={ci} style={{ fontSize: '0.58rem', fontWeight: 800, padding: '0.1rem 0.35rem', borderRadius: 50, background: 'rgba(74,173,168,0.1)', color: 'var(--teal)' }}>{ci}</span>)}
                                                            </div>
                                                        </label>
                                                    )
                                                })}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            <button className={styles.actionBtn} disabled={selectedContactIds.size === 0} onClick={() => {
                                                const toAdd = circleContacts.filter(c => selectedContactIds.has(c.id) && !guests.some(g => g.email === c.email))
                                                const newGs: Guest[] = toAdd.map((c, i) => ({
                                                    id: (Date.now() + i).toString(), name: c.name, email: c.email,
                                                    status: 'pending' as const, dietary: 'None', additionalGuests: [],
                                                    avatar: c.avatar, color: c.color
                                                }))
                                                setGuests(prev => [...prev, ...newGs])
                                                setShowCircles(false)
                                                setSelectedContactIds(new Set())
                                                showToast(`${newGs.length} guest${newGs.length !== 1 ? 's' : ''} added from circles`, 'success')
                                            }}>Add {selectedContactIds.size} Guest{selectedContactIds.size !== 1 ? 's' : ''}</button>
                                            <button onClick={() => { setShowCircles(false); setSelectedContactIds(new Set()) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aabbb', fontWeight: 700, fontSize: '0.85rem' }}>Cancel</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}


                        {/* Guest Table */}
                        <div className={styles.guestTable}>
                            {filteredGuests.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#9aabbb', fontWeight: 700 }}>
                                    {search || filter !== 'all' ? 'No guests match your filters' : 'No guests yet — add some above!'}
                                </div>
                            ) : filteredGuests.map(g => (
                                <div key={g.id} className={styles.guestEntry}>
                                    <div className={styles.guestRow} onClick={() => setExpandedGuest(expandedGuest === g.id ? null : g.id)} style={{ cursor: 'pointer' }}>
                                        <div className={styles.guestAvatar} style={{ background: g.color }}>{g.avatar}</div>
                                        <div className={styles.guestInfo}>
                                            <div className={styles.guestName}>{g.name}</div>
                                            <div className={styles.guestEmail}>{g.email}</div>
                                        </div>
                                        {g.dietary !== 'None' && <span className={styles.dietary}>{g.dietary}</span>}
                                        {g.additionalGuests.length > 0 && <span className={styles.partySize} title={g.additionalGuests.map(ag => ag.name || 'Guest').join(', ')}>👥 +{g.additionalGuests.length}</span>}
                                        <select value={g.status} onChange={e => { e.stopPropagation(); updateStatus(g.id, e.target.value as Guest['status']) }} onClick={e => e.stopPropagation()} className={styles.statusSelect} style={{ background: STATUS_BG[g.status], color: STATUS_COLORS[g.status] }}>
                                            <option value="going">✓ Going</option>
                                            <option value="maybe">? Maybe</option>
                                            <option value="declined">✗ Declined</option>
                                            <option value="pending">⏳ Pending</option>
                                        </select>
                                        <button onClick={e => { e.stopPropagation(); copyRSVPLink() }} style={{ background: 'none', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, padding: '0.15rem 0.4rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--teal)', cursor: 'pointer', whiteSpace: 'nowrap' }} title="Copy RSVP Link">{copied ? '✓' : '🔗'}</button>
                                        <button onClick={e => { e.stopPropagation(); shareWhatsApp() }} style={{ background: 'none', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, padding: '0.15rem 0.4rem', fontSize: '0.62rem', fontWeight: 700, color: '#25D366', cursor: 'pointer' }} title="Share via WhatsApp">💬</button>
                                        <button className={styles.removeBtn} onClick={e => { e.stopPropagation(); removeGuest(g.id) }}>✕</button>
                                        <span className={styles.expandIcon}>{expandedGuest === g.id ? '▾' : '▸'}</span>
                                    </div>

                                    {expandedGuest === g.id && (
                                        <div className={styles.guestExpanded}>
                                            <div className={styles.expandedSection}>
                                                <div className={styles.expandedLabel}>🍽️ {g.name}&apos;s Dietary Restrictions</div>
                                                <select value={g.dietary} onChange={e => updateGuestDietary(g.id, e.target.value)} className={styles.addInputSmall} style={{ maxWidth: '200px' }}>
                                                    {DIETARY_OPTIONS.map(d => <option key={d}>{d}</option>)}
                                                </select>
                                            </div>
                                            <div className={styles.expandedSection}>
                                                <div className={styles.expandedLabelRow}>
                                                    <span className={styles.expandedLabel}>👥 Additional Guests ({g.additionalGuests.length})</span>
                                                    <button className={styles.addMemberBtn} onClick={() => addAdditionalToExisting(g.id)}>+ Add Person</button>
                                                </div>
                                                {g.additionalGuests.map(ag => (
                                                    <div key={ag.id} className={styles.additionalRow}>
                                                        <input placeholder="Name" value={ag.name} onChange={e => updateAdditionalExisting(g.id, ag.id, 'name', e.target.value)} className={styles.addInputSmall} />
                                                        <select value={ag.relationship} onChange={e => updateAdditionalExisting(g.id, ag.id, 'relationship', e.target.value)} className={styles.addInputSmall}>
                                                            {RELATIONSHIP_OPTIONS.map(r => <option key={r}>{r}</option>)}
                                                        </select>
                                                        <select value={ag.dietary} onChange={e => updateAdditionalExisting(g.id, ag.id, 'dietary', e.target.value)} className={styles.addInputSmall}>
                                                            {DIETARY_OPTIONS.map(d => <option key={d}>{d}</option>)}
                                                        </select>
                                                        <button className={styles.removeBtn} onClick={() => removeAdditionalExisting(g.id, ag.id)}>✕</button>
                                                    </div>
                                                ))}
                                                {g.additionalGuests.length === 0 && <p className={styles.additionalHint}>No additional guests yet.</p>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div>
                        {/* Headcount */}
                        <div className="card" style={{ marginBottom: '1rem', textAlign: 'center', padding: '1.2rem' }}>
                            <div style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>👥</div>
                            <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '0.9rem', color: 'var(--navy)', marginBottom: '0.4rem' }}>Total Headcount</h3>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.2rem' }}>
                                <div>
                                    <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1.5rem', color: 'var(--navy)' }}>{totalHeadcount}</div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase' }}>Total</div>
                                </div>
                                <div>
                                    <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1.5rem', color: '#3D8C6E' }}>{goingHeadcount}</div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase' }}>Confirmed</div>
                                </div>
                            </div>
                        </div>

                        {/* Dietary */}
                        <div className="card" style={{ marginBottom: '1rem', padding: '1.2rem' }}>
                            <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '0.9rem', color: 'var(--navy)', marginBottom: '0.8rem' }}>🥗 Dietary Needs</h3>
                            {Object.entries(dietaryCounts).sort((a, b) => b[1] - a[1]).map(([diet, count]) => (
                                <div key={diet} className={styles.dietRow}>
                                    <span style={{ flex: 1, fontWeight: 700, fontSize: '0.8rem' }}>{diet}</span>
                                    <div className={styles.dietBar}><div className={styles.dietFill} style={{ width: `${totalHeadcount > 0 ? (count / totalHeadcount) * 100 : 0}%` }} /></div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--navy)', minWidth: 18, textAlign: 'right' }}>{count}</span>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>
            </div >

            {/* RSVP Preview Modal */}
            {showPreview && (
                <div onClick={() => setShowPreview(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: 400, maxWidth: '95vw', height: '85vh', maxHeight: 750, background: '#1a2535', borderRadius: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                        {/* Modal header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>📱 RSVP Preview {hasUnpublishedChanges ? '(Unpublished)' : ''}</span>
                            <button onClick={() => setShowPreview(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '0.8rem', fontWeight: 800 }}>✕</button>
                        </div>
                        {/* Inline preview */}
                        <div style={{ flex: 1, overflow: 'auto', background: '#f0f2f5', padding: '1rem' }}>
                            <div style={{ maxWidth: 360, margin: '0 auto', background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                                {/* Header */}
                                <div style={{ padding: '1.5rem', textAlign: 'center' as const, background: invite?.coverPhoto ? `url(${invite.coverPhoto}) center/cover` : 'linear-gradient(135deg, #1a2535 0%, #2a3a4f 100%)', position: 'relative' as const }}>
                                    {invite?.coverPhoto && <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,37,53,0.65)' }} />}
                                    <div style={{ position: 'relative', zIndex: 1 }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '0.3rem' }}>{planData.eventType?.split(' ')[0] || '🎉'}</div>
                                        <h2 style={{ fontFamily: "'Fredoka One',cursive", color: '#fff', margin: '0 0 0.5rem', fontSize: '1.1rem' }}>{planData.eventType?.replace(/^[^\s]+\s/, '') || 'Party'}</h2>
                                        {planData.date && <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', margin: '0 0 0.2rem', fontWeight: 600 }}>📅 {new Date(planData.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>}
                                        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', margin: 0, fontWeight: 600 }}>📍 {planData.location || 'Location TBD'}</p>
                                        {rsvpByDate && <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.75rem', margin: '0.3rem 0 0', fontWeight: 600 }}>⏰ RSVP by {new Date(rsvpByDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>}
                                    </div>
                                </div>
                                {/* Invite body */}
                                {invite?.customImage ? (
                                    <div style={{ padding: '0.5rem' }}>
                                        <img src={invite.customImage} alt="Custom invite" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
                                    </div>
                                ) : invite?.message ? (
                                    <div style={{ padding: '1rem 1.2rem', background: 'rgba(247,201,72,0.08)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                        {invite.subject && <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: '0.85rem', color: '#1a2535', marginBottom: '0.5rem' }}>{invite.subject}</div>}
                                        {invite.message.split('\n').map((line, i) => (
                                            <p key={i} style={{ fontSize: '0.8rem', color: '#4a5568', lineHeight: 1.6, fontWeight: 500, margin: line.trim() ? '0 0 0.4rem 0' : '0 0 0.2rem 0' }}>{line || '\u00A0'}</p>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '2rem 1.2rem', textAlign: 'center' as const, color: '#9aabbb', fontSize: '0.8rem', fontWeight: 600 }}>
                                        No invite content yet — generate or type one above
                                    </div>
                                )}
                                {/* Mock RSVP form */}
                                <div style={{ padding: '1rem 1.2rem' }}>
                                    <div style={{ background: '#f7f8fa', borderRadius: 10, padding: '0.8rem', marginBottom: '0.5rem' }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#9aabbb', marginBottom: '0.3rem' }}>Your Name *</div>
                                        <div style={{ background: '#fff', border: '1.5px solid #e2e6ea', borderRadius: 8, padding: '0.4rem 0.6rem', fontSize: '0.75rem', color: '#ccc' }}>Full name</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', marginBottom: '0.5rem' }}>
                                        {['🎉 Going', '🤔 Maybe', '😢 Can\'t'].map(opt => (
                                            <div key={opt} style={{ padding: '0.4rem 0.7rem', borderRadius: 10, border: '1.5px solid #e2e6ea', fontSize: '0.7rem', fontWeight: 700, color: '#9aabbb' }}>{opt}</div>
                                        ))}
                                    </div>
                                    <div style={{ background: 'var(--teal)', color: '#fff', borderRadius: 10, padding: '0.5rem', textAlign: 'center' as const, fontSize: '0.78rem', fontWeight: 800, opacity: 0.6 }}>Send My RSVP 🎊</div>
                                </div>
                                <div style={{ textAlign: 'center' as const, padding: '0.5rem', fontSize: '0.65rem', color: '#ccc', fontWeight: 600 }}>Powered by 🎊 PartyPal</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
