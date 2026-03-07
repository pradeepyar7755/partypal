'use client'
import React, { useState, useEffect, useRef } from 'react'
import { userGet, userSetJSON, userGetJSON } from '@/lib/userStorage'
import { pushContactsToCloud, pullContactsFromCloud } from '@/lib/contacts-sync'
import { showToast } from '@/components/Toast'
import styles from './GuestManager.module.css'
import { useAIContext } from '@/lib/useAIContext'
import { useAuth } from '@/components/AuthContext'

interface AdditionalGuest {
    id: string; name: string; dietary: string; relationship: string; isChild?: boolean
}

interface Guest {
    id: string; name: string; email: string; status: 'going' | 'maybe' | 'declined' | 'pending'
    dietary: string; additionalGuests: AdditionalGuest[]; avatar: string; color: string
    circles?: string[]
}

const DIETARY_OPTIONS = ['None', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Nut Allergy', 'Kosher', 'Halal', 'Dairy-Free', 'Shellfish Allergy']
const RELATIONSHIP_OPTIONS = ['Partner', 'Spouse', 'Child', 'Family', 'Friend', 'Other']
const COLORS = ['#E8896A', '#4AADA8', '#F7C948', '#3D8C6E', '#7B5EA7', '#2D4059']
const STATUS_COLORS: Record<string, string> = { going: '#3D8C6E', maybe: '#c4880a', declined: '#E8896A', pending: '#9aabbb' }
const STATUS_BG: Record<string, string> = { going: 'rgba(61,140,110,0.1)', maybe: 'rgba(247,201,72,0.15)', declined: 'rgba(232,137,106,0.1)', pending: 'rgba(150,150,170,0.1)' }
const getUserTZ = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/.*\//, '').replace(/_/g, ' ') } catch { return '' } }
const getTZAbbr = () => { try { const d = new Date(); const parts = d.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' '); return parts[parts.length - 1] } catch { return '' } }
const TZ_OPTIONS = ['EST', 'CST', 'MST', 'PST', 'AKST', 'HST', 'EDT', 'CDT', 'MDT', 'PDT', 'AKDT', 'UTC', 'GMT', 'IST', 'CET', 'JST', 'AEST']
const formatTime12h = (t: string, tz?: string) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); const ampm = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 || 12; const tzStr = tz ? ` ${tz}` : ''; return `${h12}:${m.toString().padStart(2, '0')} ${ampm}${tzStr}` }

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
    planData?: { eventType?: string; theme?: string; date?: string; location?: string; eventId?: string; time?: string; hostName?: string; hostContact?: string }
    isDemo?: boolean
    isGuest?: boolean
    onRequireSignup?: () => void
}

export default function GuestManager({ eventId, planData: propPlanData, isDemo, isGuest, onRequireSignup }: GuestManagerProps) {
    const { user } = useAuth()
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
    const [planData, setPlanData] = useState<{ eventType?: string; theme?: string; date?: string; location?: string; eventId?: string; time?: string; hostName?: string; hostContact?: string }>(propPlanData || {})
    const [copied, setCopied] = useState(false)
    const [joinCode, setJoinCode] = useState<string>('')
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<string>('all')
    const [expandedGuest, setExpandedGuest] = useState<string | null>(null)
    const [openCircleDropdown, setOpenCircleDropdown] = useState<string | null>(null)
    const [inviteTheme, setInviteTheme] = useState(propPlanData?.theme || 'Modern & Fun')
    const [inviteTemp, setInviteTemp] = useState(0.7)
    const [rsvpByDate, setRsvpByDate] = useState(() => {
        if (typeof window === 'undefined') return ''
        const stored = userGet('partyplan')
        if (stored) { try { return JSON.parse(stored).rsvpBy || '' } catch { return '' } }
        return ''
    })
    const [editableHostName, setEditableHostName] = useState(() => {
        // Priority: per-event stored hostName > prop hostName > empty
        if (typeof window === 'undefined') return propPlanData?.hostName || ''
        const stored = userGet('partyplan')
        if (stored) { try { const savedName = JSON.parse(stored).hostName; if (savedName) return savedName } catch { /* */ } }
        return propPlanData?.hostName || ''
    })
    const [editableHostContact, setEditableHostContact] = useState(propPlanData?.hostContact || '')
    const [editableEventTime, setEditableEventTime] = useState(() => {
        if (propPlanData?.time) return propPlanData.time
        if (typeof window === 'undefined') return '12:00'
        const stored = userGet('partyplan')
        if (stored) { try { return JSON.parse(stored).time || '12:00' } catch { return '12:00' } }
        return '12:00'
    })
    const [editableTimezone, setEditableTimezone] = useState(() => {
        if (typeof window === 'undefined') return ''
        const stored = userGet('partyplan')
        if (stored) { try { return JSON.parse(stored).timezone || getTZAbbr() } catch { return getTZAbbr() } }
        return getTZAbbr()
    })
    const [refineInput, setRefineInput] = useState('')
    const bookmarkKey = eventId ? `partypal_bookmarks_${eventId}` : 'partypal_bookmarks'
    const [bookmarks, setBookmarks] = useState<{ name: string; invite: { subject?: string; message?: string; smsVersion?: string } }[]>(() => {
        if (typeof window === 'undefined') return []
        return userGetJSON(bookmarkKey, [])
    })
    const [editingBookmarkIdx, setEditingBookmarkIdx] = useState<number | null>(null)
    const [isRefining, setIsRefining] = useState(false)
    const [isEditingInvite, setIsEditingInvite] = useState(false)
    const [draftInvite, setDraftInvite] = useState<{ subject?: string; message?: string; smsVersion?: string; customImage?: string; coverPhoto?: string } | null>(null)
    const [inviteCollapsed, setInviteCollapsed] = useState(false)
    const [isEditingStrip, setIsEditingStrip] = useState(false)
    const [draftDetails, setDraftDetails] = useState<{ hostName: string; rsvpBy: string; time: string; timezone: string } | null>(null)
    const [showPreview, setShowPreview] = useState(false)
    // Guest selection & email state
    const [selectionMode, setSelectionMode] = useState(false)
    const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set())
    const [showCustomMessageModal, setShowCustomMessageModal] = useState(false)
    const [customMessage, setCustomMessage] = useState('')
    const [sendingEmail, setSendingEmail] = useState(false)
    const [emailAction, setEmailAction] = useState<'rsvp' | 'custom' | null>(null)
    const [isPublished, setIsPublished] = useState(false)
    const publishedInviteKey = eventId ? `partypal_published_${eventId}` : 'partypal_published'
    const [publishedInvite, setPublishedInvite] = useState<{ subject?: string; message?: string; smsVersion?: string; customImage?: string; coverPhoto?: string } | null>(() => {
        if (typeof window === 'undefined') return null
        return userGetJSON(publishedInviteKey, null)
    })
    const [lastPublishedInvite, setLastPublishedInvite] = useState<string>('')
    const registryKey = eventId ? `partypal_registry_${eventId}` : 'partypal_registry'
    const [giftRegistry, setGiftRegistry] = useState<{ name: string; url: string }[]>(() => {
        if (typeof window === 'undefined') return []
        return userGetJSON(registryKey, [])
    })
    const [showRegistryForm, setShowRegistryForm] = useState(false)
    const [registryForm, setRegistryForm] = useState({ name: '', url: '' })
    const themeChangeRef = React.useRef(false)
    const customInviteRef = React.useRef<HTMLInputElement>(null)
    const coverPhotoRef = React.useRef<HTMLInputElement>(null)
    const deletedRsvpIds = useRef<Set<string>>(new Set())
    // Import hint hotspot — show when guest list is empty and hint not dismissed
    const [showImportHint, setShowImportHint] = useState(false)
    useEffect(() => {
        if (isDemo) return
        const dismissed = userGetJSON<boolean>('partypal_import_hint_dismissed', false)
        if (!dismissed && guests.length === 0) setShowImportHint(true)
        else setShowImportHint(false)
    }, [guests.length, isDemo])
    const dismissImportHint = () => {
        setShowImportHint(false)
        userSetJSON('partypal_import_hint_dismissed', true)
    }
    // Cross-portal AI context
    const { getContextPayload, learn } = useAIContext(planData as Parameters<typeof useAIContext>[0], guests as unknown as Parameters<typeof useAIContext>[1])

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

    // Unified save function for event details
    const saveEventDetails = async () => {
        if (!draftDetails) return

        // Update local states immediately
        setEditableHostName(draftDetails.hostName)
        setRsvpByDate(draftDetails.rsvpBy)
        setEditableEventTime(draftDetails.time)
        setEditableTimezone(draftDetails.timezone)

        // Persist to localStorage
        const stored = userGet('partyplan')
        if (stored) {
            try {
                const d = JSON.parse(stored)
                d.hostName = draftDetails.hostName
                d.rsvpBy = draftDetails.rsvpBy
                d.time = draftDetails.time
                d.timezone = draftDetails.timezone
                userSetJSON('partyplan', d)

                // Sync to Firestore
                if (d.eventId) {
                    await fetch('/api/events', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            eventId: d.eventId,
                            hostName: draftDetails.hostName || undefined,
                            rsvpBy: draftDetails.rsvpBy || undefined,
                            time: draftDetails.time || undefined,
                            timezone: draftDetails.timezone || undefined
                        })
                    })
                }
            } catch (e) { console.error('Error saving details:', e) }
        }

        setIsEditingStrip(false)
        setDraftDetails(null)
        showToast('Event details saved!', 'success')
    }

    // (Effects for sync removed in favor of explicit save)


    // Sync timezone to localStorage
    useEffect(() => {
        if (typeof window === 'undefined' || !editableTimezone) return
        const stored = userGet('partyplan')
        if (stored) { try { const d = JSON.parse(stored); if (d.timezone !== editableTimezone) { d.timezone = editableTimezone; userSetJSON('partyplan', d) } } catch { /* */ } }
    }, [editableTimezone])

    // Sync gift registry to localStorage / Firestore
    useEffect(() => {
        userSetJSON(registryKey, giftRegistry)
        if (planData.eventId && giftRegistry.length >= 0) {
            fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: planData.eventId, giftRegistry }) }).catch(() => { })
        }
    }, [giftRegistry, registryKey, planData.eventId])

    // Detect if invite has changed since last publish
    const inviteFingerprint = invite ? JSON.stringify({ s: invite.subject, m: invite.message, sm: invite.smsVersion, ci: invite.customImage, cp: invite.coverPhoto }) : ''
    const hasUnpublishedChanges = invite && (!isPublished || inviteFingerprint !== lastPublishedInvite)

    // Bootstrap publishedInvite from server data if it exists but local state is empty
    useEffect(() => {
        if (invite && joinCode && !publishedInvite) {
            const savedPayload = { ...invite, customImage: invite.customImage || undefined, coverPhoto: invite.coverPhoto || undefined }
            setPublishedInvite(savedPayload)
            userSetJSON(publishedInviteKey, savedPayload)
            setLastPublishedInvite(inviteFingerprint)
            setIsPublished(true)
        }
    }, [invite, joinCode, publishedInvite, publishedInviteKey, inviteFingerprint])

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

    // Load contacts & circles from localStorage, and reload on navigation/tab switch
    const reloadContacts = () => {
        setCircleContacts(userGetJSON('partypal_contacts', []))
        setSavedCircles(userGetJSON('partypal_circles', ['Family', 'Friends', 'Work', 'School', 'Neighbors']))
    }
    useEffect(() => {
        reloadContacts()
        // Pull from cloud on initial mount (not on every focus to avoid excess API calls)
        if (user && !user.isAnonymous) {
            pullContactsFromCloud(user.uid).then(({ contacts, circles, changed }) => {
                if (changed) {
                    setCircleContacts(contacts)
                    setSavedCircles(circles)
                }
            }).catch(() => {})
        }
        const onFocus = () => reloadContacts()
        const onVisible = () => { if (document.visibilityState === 'visible') reloadContacts() }
        window.addEventListener('focus', onFocus)
        document.addEventListener('visibilitychange', onVisible)
        return () => {
            window.removeEventListener('focus', onFocus)
            document.removeEventListener('visibilitychange', onVisible)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                    // Capture joinCode from event data
                    if (data.joinCode && !joinCode) setJoinCode(data.joinCode)
                    if (!data.rsvps || data.rsvps.length === 0) return
                    setGuests(prev => {
                        let updated = [...prev]
                        let changed = false
                        for (const rsvp of data.rsvps) {
                            // Skip RSVPs that were deleted locally
                            if (deletedRsvpIds.current.has(rsvp.id)) continue
                            const rName = (rsvp.name || '').trim().toLowerCase()
                            const rEmail = (rsvp.email || '').trim().toLowerCase()
                            // Find matching guest
                            const existingIdx = updated.findIndex(g =>
                                (rEmail && g.email.toLowerCase() === rEmail) ||
                                g.name.toLowerCase() === rName
                            )
                            const rsvpStatus = rsvp.response === 'going' ? 'going' : rsvp.response === 'maybe' ? 'maybe' : rsvp.response === 'declined' ? 'declined' : 'pending'
                            if (existingIdx >= 0) {
                                // Always merge dietary + additional guests from RSVP
                                const newDietary = rsvp.dietary || updated[existingIdx].dietary
                                const newAdditional = (rsvp.additionalGuests || []).length > 0
                                    ? (rsvp.additionalGuests as { name: string; dietary?: string; relationship?: string; isChild?: boolean }[]).map((ag, i) => ({
                                        id: `rsvp_${rsvp.id}_${i}`,
                                        name: ag.name,
                                        dietary: ag.dietary || 'None',
                                        relationship: ag.relationship || 'Friend',
                                        isChild: ag.isChild || false,
                                    }))
                                    : updated[existingIdx].additionalGuests
                                if (updated[existingIdx].status !== rsvpStatus
                                    || updated[existingIdx].dietary !== newDietary
                                    || JSON.stringify(updated[existingIdx].additionalGuests) !== JSON.stringify(newAdditional)) {
                                    updated[existingIdx] = { ...updated[existingIdx], status: rsvpStatus as Guest['status'], dietary: newDietary, additionalGuests: newAdditional }
                                    changed = true
                                }
                            } else {
                                // Add new guest from RSVP
                                const avatar = rsvp.name ? rsvp.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() : '??'
                                const additionalGuests = (rsvp.additionalGuests || []).map((ag: { name: string; dietary?: string; relationship?: string; isChild?: boolean }, i: number) => ({
                                    id: `rsvp_${rsvp.id}_${i}`,
                                    name: ag.name,
                                    dietary: ag.dietary || 'None',
                                    relationship: ag.relationship || 'Friend',
                                    isChild: ag.isChild || false,
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
    }, [eventId, isDemo, storageKey, joinCode])

    const totalHeadcount = guests.reduce((sum, g) => sum + 1 + g.additionalGuests.length, 0)
    const goingHeadcount = guests.filter(g => g.status === 'going').reduce((sum, g) => sum + 1 + g.additionalGuests.length, 0)
    const confirmedGuests = guests.filter(g => g.status === 'going')
    const kidsCount = confirmedGuests.reduce((sum, g) => sum + g.additionalGuests.filter(ag => ag.isChild || ag.relationship === 'Child').length, 0)
    const adultsCount = goingHeadcount - kidsCount

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
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newGuest.email)) {
            showToast('Please enter a valid email address', 'error')
            return
        }
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

    // Sync an RSVP guest's edits back to Firestore
    const syncRsvpToCloud = (guestId: string, updatedGuests: Guest[]) => {
        if (!eventId || !guestId.startsWith('rsvp_')) return
        const rsvpId = guestId.replace('rsvp_', '')
        const guest = updatedGuests.find(g => g.id === guestId)
        if (!guest) return
        const statusMap: Record<string, string> = { going: 'going', maybe: 'maybe', declined: 'declined', pending: 'pending' }
        fetch(`/api/events/${eventId}/rsvp`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid: user?.uid,
                rsvpId,
                response: statusMap[guest.status] || guest.status,
                dietary: guest.dietary,
                additionalGuests: guest.additionalGuests,
                totalPartySize: 1 + guest.additionalGuests.length,
                kidCount: guest.additionalGuests.filter(ag => ag.isChild).length,
            }),
        }).catch(() => {})
    }

    const updateStatus = (id: string, status: Guest['status']) => {
        setGuests(prev => {
            const updated = prev.map(g => g.id === id ? { ...g, status } : g)
            syncRsvpToCloud(id, updated)
            return updated
        })
        showToast('RSVP updated', 'info')
    }
    const getGuestCircles = (g: Guest): string[] => {
        // Always read fresh from localStorage (single source of truth)
        const contacts = userGetJSON<{ name: string; email: string; circles: string[] }[]>('partypal_contacts', [])
        const contact = contacts.find(c =>
            (g.email && c.email && c.email.toLowerCase() === g.email.toLowerCase()) ||
            (!g.email && c.name && c.name.toLowerCase() === g.name.toLowerCase())
        )
        return contact?.circles || g.circles || []
    }

    const toggleGuestCircle = (guestId: string, circle: string) => {
        const guest = guests.find(g => g.id === guestId)
        if (!guest) return

        // Update contacts store (single source of truth)
        const contacts = userGetJSON<{ id: string; name: string; email: string; phone: string; circles: string[]; avatar: string; color: string }[]>('partypal_contacts', [])
        const contactIdx = contacts.findIndex(c =>
            (guest.email && c.email && c.email.toLowerCase() === guest.email.toLowerCase()) ||
            (!guest.email && c.name && c.name.toLowerCase() === guest.name.toLowerCase())
        )

        let updatedCircles: string[]
        if (contactIdx >= 0) {
            const current = contacts[contactIdx].circles || []
            updatedCircles = current.includes(circle) ? current.filter(c => c !== circle) : [...current, circle]
            contacts[contactIdx].circles = updatedCircles
        } else {
            // Contact doesn't exist yet — create one
            updatedCircles = [circle]
            contacts.push({
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                name: guest.name,
                email: guest.email || '',
                phone: '',
                circles: updatedCircles,
                avatar: guest.avatar || guest.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
                color: guest.color || '#4AADA8',
            })
        }
        userSetJSON('partypal_contacts', contacts)
        setCircleContacts(contacts)
        // Cloud sync (debounced)
        if (user && !user.isAnonymous) {
            pushContactsToCloud(user.uid, contacts)
        }

        // Also update the guest object for immediate UI feedback
        setGuests(prev => prev.map(g => {
            if (g.id !== guestId) return g
            return { ...g, circles: updatedCircles }
        }))
    }
    const removeGuest = async (id: string) => {
        const g = guests.find(x => x.id === id);

        // Track deleted RSVP IDs so polling doesn't re-add them
        if (id.startsWith('rsvp_') && eventId) {
            const rsvpId = id.replace('rsvp_', '')
            deletedRsvpIds.current.add(rsvpId)
        }

        // Remove from local state immediately for fast feedback
        setGuests(prev => prev.filter(x => x.id !== id));
        showToast(`${g?.name || 'Guest'} removed`, 'info');

        // If this guest was sourced from Firestore RSVPs, delete it permanently
        if (id.startsWith('rsvp_') && eventId) {
            const rsvpId = id.replace('rsvp_', '');
            try {
                await fetch(`/api/events/${eventId}/rsvp?rsvpId=${rsvpId}&uid=${user?.uid}`, { method: 'DELETE' });
            } catch (e) {
                console.error('Failed to delete RSVP from cloud', e);
            }
        }
    }
    const addAdditionalToExisting = (guestId: string) => { setGuests(prev => prev.map(g => g.id === guestId ? { ...g, additionalGuests: [...g.additionalGuests, { id: Date.now().toString(), name: '', dietary: 'None', relationship: 'Partner' }] } : g)) }
    const updateAdditionalExisting = (guestId: string, addId: string, field: string, value: string | boolean) => {
        setGuests(prev => {
            const updated = prev.map(g => g.id === guestId ? { ...g, additionalGuests: g.additionalGuests.map(ag => ag.id === addId ? { ...ag, [field]: value } : ag) } : g)
            syncRsvpToCloud(guestId, updated)
            return updated
        })
    }
    const removeAdditionalExisting = (guestId: string, addId: string) => {
        setGuests(prev => {
            const updated = prev.map(g => g.id === guestId ? { ...g, additionalGuests: g.additionalGuests.filter(ag => ag.id !== addId) } : g)
            syncRsvpToCloud(guestId, updated)
            return updated
        })
    }
    const updateGuestDietary = (guestId: string, dietary: string) => {
        setGuests(prev => {
            const updated = prev.map(g => g.id === guestId ? { ...g, dietary } : g)
            syncRsvpToCloud(guestId, updated)
            return updated
        })
    }

    // ── Guest Selection & Email ──────────────────────
    const toggleGuestSelection = (guestId: string) => {
        setSelectedGuestIds(prev => {
            const next = new Set(prev)
            if (next.has(guestId)) next.delete(guestId)
            else next.add(guestId)
            return next
        })
    }

    const selectAllFiltered = () => {
        const filtered = guests.filter(g => {
            if (filter !== 'all' && g.status !== filter) return false
            if (search && !g.name.toLowerCase().includes(search.toLowerCase()) && !g.email.toLowerCase().includes(search.toLowerCase())) return false
            return g.email?.includes('@')
        })
        setSelectedGuestIds(new Set(filtered.map(g => g.id)))
    }

    const clearSelection = () => {
        setSelectedGuestIds(new Set())
        setSelectionMode(false)
        setEmailAction(null)
    }

    const selectedGuestsWithEmail = guests.filter(g => selectedGuestIds.has(g.id) && g.email?.includes('@'))

    const handleSendRsvpEmail = async () => {
        if (selectedGuestsWithEmail.length === 0) return
        setSendingEmail(true)
        try {
            const rsvpBaseLink = joinCode ? `https://partypal.social/join/${joinCode}` : undefined
            const res = await fetch('/api/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'send_invitations',
                    guests: selectedGuestsWithEmail.map(g => ({ name: g.name, email: g.email })),
                    hostName: editableHostName || planData.hostName || 'Your Host',
                    eventName: planData.eventType || 'Party',
                    eventDate: planData.date ? new Date(planData.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '',
                    eventTime: editableEventTime ? formatTime12h(editableEventTime, editableTimezone || undefined) : undefined,
                    eventLocation: planData.location || '',
                    eventTheme: planData.theme || undefined,
                    inviteMessage: invite?.message || undefined,
                    rsvpBaseLink,
                    coverPhoto: invite?.coverPhoto || undefined,
                }),
            })
            const data = await res.json()
            if (data.success) {
                showToast(`RSVP invites sent to ${data.sent} guest${data.sent !== 1 ? 's' : ''}!`, 'success')
                clearSelection()
            } else {
                showToast(data.error || 'Failed to send emails', 'error')
            }
        } catch {
            showToast('Failed to send emails', 'error')
        } finally {
            setSendingEmail(false)
        }
    }

    const handleSendCustomMessage = async () => {
        if (selectedGuestsWithEmail.length === 0 || !customMessage.trim()) return
        setSendingEmail(true)
        try {
            const rsvpBaseLink = joinCode ? `https://partypal.social/join/${joinCode}` : undefined
            const res = await fetch('/api/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'custom_message',
                    guests: selectedGuestsWithEmail.map(g => ({ name: g.name, email: g.email })),
                    hostName: editableHostName || planData.hostName || 'Your Host',
                    eventName: planData.eventType || 'Party',
                    message: customMessage,
                    eventDate: planData.date ? new Date(planData.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : undefined,
                    eventTime: editableEventTime ? formatTime12h(editableEventTime, editableTimezone || undefined) : undefined,
                    eventLocation: planData.location || undefined,
                    rsvpBaseLink,
                    coverPhoto: invite?.coverPhoto || undefined,
                }),
            })
            const data = await res.json()
            if (data.success) {
                showToast(`Message sent to ${data.sent} guest${data.sent !== 1 ? 's' : ''}!`, 'success')
                setShowCustomMessageModal(false)
                setCustomMessage('')
                clearSelection()
            } else {
                showToast(data.error || 'Failed to send message', 'error')
            }
        } catch {
            showToast('Failed to send message', 'error')
        } finally {
            setSendingEmail(false)
        }
    }

    const generateInvite = async (retryCount = 0) => {
        setLoadingInvite(true)
        try {
            const res = await fetch('/api/guests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate_invite', eventDetails: { ...planData, inviteTheme, hostName: editableHostName || 'Your Host' }, temperature: inviteTemp, ...getContextPayload() }) })
            const data = await res.json()
            if (!res.ok || data.error) {
                // Retry once on transient server errors
                if (retryCount < 1 && res.status >= 500) {
                    setLoadingInvite(false)
                    return generateInvite(retryCount + 1)
                }
                showToast(data.error || `Server error (${res.status}). Please try again.`, 'error')
                setLoadingInvite(false)
                return
            }
            if (!data.subject && !data.message) {
                showToast('Received an empty invite. Please try again.', 'error')
                setLoadingInvite(false)
                return
            }
            setInvite(data); setIsEditingInvite(false)
            showToast('Invite generated!', 'success')
            learn({ type: 'invite_style_chosen', style: inviteTheme })
        } catch { showToast('Network error — check your connection and try again.', 'error') }
        setLoadingInvite(false)
    }

    const refineInvite = async () => {
        if (!refineInput.trim() || !invite) return
        setIsRefining(true)
        try {
            const res = await fetch('/api/guests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refine_invite', currentSubject: invite.subject, currentMessage: invite.message, instruction: refineInput, ...getContextPayload() }) })
            const data = await res.json()
            if (!res.ok || data.error) {
                showToast(data.error || `Failed to refine invite (${res.status}). Please try again.`, 'error')
                setIsRefining(false)
                return
            }
            if (data.subject) { setInvite(prev => prev ? { ...prev, subject: data.subject, message: data.message, smsVersion: data.smsVersion || prev?.smsVersion } : prev); setRefineInput(''); setIsEditingInvite(false); showToast('Invite refined!', 'success'); learn({ type: 'invite_refined', refinementText: refineInput.trim() }) }
        } catch { showToast('Network error — check your connection and try again.', 'error') }
        setIsRefining(false)
    }

    const getRSVPLink = () => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://partypal.social'
        if (joinCode) return `${origin}/join/${joinCode}`
        // Fallback to old format if no joinCode yet
        const eid = planData.eventId || eventId || ''
        return `${origin}/rsvp?e=${eid}`
    }

    const copyRSVPLink = async () => {
        if (isGuest && onRequireSignup) {
            onRequireSignup()
            return
        }

        const eid = planData.eventId || eventId || ''
        // Ensure the invite is published and joinCode exists
        if (eid && !joinCode) {
            try {
                const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: eid }) })
                const data = await res.json()
                if (data.joinCode) setJoinCode(data.joinCode)
                const origin = typeof window !== 'undefined' ? window.location.origin : 'https://partypal.social'
                const link = data.joinCode ? `${origin}/join/${data.joinCode}` : getRSVPLink()
                navigator.clipboard.writeText(link)
                setCopied(true); setTimeout(() => setCopied(false), 2000)
                showToast('RSVP link copied!', 'success')
                return
            } catch { /* best effort */ }
        }
        navigator.clipboard.writeText(getRSVPLink())
        setCopied(true); setTimeout(() => setCopied(false), 2000)
        showToast('RSVP link copied!', 'success')
    }

    const publishInvite = async () => {
        if (!invite || !planData.eventId) return
        const invitePayload = { ...invite, customImage: invite.customImage || null, coverPhoto: invite.coverPhoto || null }
        try {
            const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: planData.eventId, invite: invitePayload, rsvpBy: rsvpByDate || null, hostName: editableHostName || null, timezone: editableTimezone || null, giftRegistry: giftRegistry.length > 0 ? giftRegistry : null }) })
            const data = await res.json()
            if (data.joinCode) setJoinCode(data.joinCode)
            setIsPublished(true)
            const savedPayload = { ...invitePayload, customImage: invitePayload.customImage || undefined, coverPhoto: invitePayload.coverPhoto || undefined }
            setPublishedInvite(savedPayload)
            userSetJSON(publishedInviteKey, savedPayload)
            setLastPublishedInvite(JSON.stringify({ s: invite.subject, m: invite.message, sm: invite.smsVersion, ci: invite.customImage, cp: invite.coverPhoto }))
            showToast('Invite published! Live RSVP page updated.', 'success')
        } catch {
            showToast('Failed to publish', 'error')
        }
    }

    const revertToPublished = () => {
        if (publishedInvite) {
            setInvite(publishedInvite)
            showToast('Reverted to published invite', 'success')
        }
    }

    const dietaryCounts: Record<string, number> = {}
    guests.filter(g => g.status === 'going' || g.status === 'maybe').forEach(g => {
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
                        <button className={styles.actionBtn} onClick={() => generateInvite()} disabled={loadingInvite} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>{loadingInvite ? '⏳...' : '✨ Generate'}</button>
                        <button className={styles.secondaryBtn} onClick={() => setShowPreview(true)} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>👁️ Preview</button>
                        {hasUnpublishedChanges
                            ? (
                                <>
                                    <button onClick={publishInvite} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem', background: 'rgba(74,173,168,0.12)', border: '1.5px solid rgba(74,173,168,0.4)', borderRadius: 6, fontWeight: 800, color: 'var(--teal)', cursor: 'pointer' }}>📤 Publish</button>
                                    {publishedInvite && <button className={styles.secondaryBtn} onClick={revertToPublished} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem', borderColor: 'rgba(244,180,26,0.4)', color: '#c4880a' }}>Revert to Published</button>}
                                </>
                            )
                            : (
                                <>
                                    <button className={styles.secondaryBtn} onClick={copyRSVPLink} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>{copied ? '✓ Copied!' : '🔗 Copy'}</button>
                                </>
                            )
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
                                <button className={styles.actionBtn} onClick={() => generateInvite()} disabled={loadingInvite} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>{loadingInvite ? '⏳...' : '✨ Generate'}</button>
                                <button className={styles.secondaryBtn} onClick={() => setShowPreview(true)} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>👁️ Preview</button>
                                {hasUnpublishedChanges
                                    ? (
                                        <>
                                            <button onClick={publishInvite} style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: 'rgba(74,173,168,0.12)', border: '1.5px solid rgba(74,173,168,0.4)', borderRadius: 6, fontWeight: 800, color: 'var(--teal)', cursor: 'pointer' }}>📤 Publish</button>
                                            {publishedInvite && <button className={styles.secondaryBtn} onClick={revertToPublished} style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderColor: 'rgba(244,180,26,0.4)', color: '#c4880a' }}>Revert to Published</button>}
                                        </>
                                    )
                                    : (
                                        <>
                                            <button className={styles.secondaryBtn} onClick={copyRSVPLink} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>{copied ? '✓ Copied!' : '🔗 Copy'}</button>
                                        </>
                                    )
                                }
                            </div>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                                {!inviteCollapsed && (
                                    isEditingInvite ? (
                                        <>
                                            <button onClick={() => {
                                                if (draftInvite) setInvite(draftInvite)
                                                setIsEditingInvite(false)
                                            }} style={{ background: 'var(--teal)', border: 'none', borderRadius: 6, padding: '0.15rem 0.6rem', fontSize: '0.68rem', fontWeight: 700, color: 'white', cursor: 'pointer' }}>
                                                ✓ Save
                                            </button>
                                            <button onClick={() => {
                                                setDraftInvite(null)
                                                setIsEditingInvite(false)
                                            }} style={{ background: 'none', border: '1px solid #9aabbb', borderRadius: 6, padding: '0.15rem 0.5rem', fontSize: '0.68rem', fontWeight: 700, color: '#9aabbb', cursor: 'pointer' }}>
                                                ✕ Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => {
                                            setDraftInvite(invite)
                                            setIsEditingInvite(true)
                                        }} style={{ background: 'none', border: '1px solid var(--teal)', borderRadius: 6, padding: '0.15rem 0.5rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--teal)', cursor: 'pointer' }}>
                                            ✏️ Edit
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                        {!inviteCollapsed && (<div style={{ paddingTop: '0.8rem' }}>
                            {isEditingInvite ? (
                                <>
                                    <input value={draftInvite?.subject || ''} onChange={e => setDraftInvite(prev => prev ? { ...prev, subject: e.target.value } : { subject: e.target.value })} className={styles.addInput} style={{ width: '100%', marginBottom: '0.4rem', fontWeight: 700 }} placeholder="Subject line" />
                                    <textarea value={draftInvite?.message || ''} onChange={e => setDraftInvite(prev => prev ? { ...prev, message: e.target.value } : { message: e.target.value })} className={styles.addInput} style={{ width: '100%', minHeight: 100, marginBottom: '0.4rem', resize: 'vertical', lineHeight: 1.5 }} />
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
                        </div>)}
                    </div>
                )}
                {/* Event details + Host Name + RSVP by + Location + Upload — always visible below invitation */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.2rem', marginBottom: '1rem', background: '#fff', borderRadius: '0 0 12px 12px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                    {isEditingStrip ? (
                        <>
                            {/* Editable Fields */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', borderRight: '1px solid var(--border)', paddingRight: '0.6rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#9aabbb' }}>⏰</span>
                                <input type="time" value={draftDetails?.time || ''} onChange={e => setDraftDetails(prev => prev ? { ...prev, time: e.target.value } : prev)} className={styles.addInput} style={{ margin: 0, padding: '0.1rem 0.25rem', fontSize: '0.65rem', fontWeight: 700, minWidth: 85, color: 'var(--teal)' }} />
                                <select value={draftDetails?.timezone || ''} onChange={e => setDraftDetails(prev => prev ? { ...prev, timezone: e.target.value } : prev)} className={styles.addInput} style={{ margin: 0, padding: '0.1rem 0.15rem', fontSize: '0.58rem', fontWeight: 700, minWidth: 55, color: '#9aabbb', appearance: 'auto' }}>
                                    <option value="">TZ</option>
                                    {TZ_OPTIONS.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                                </select>
                            </div>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb' }}>Host</span>
                            <input value={draftDetails?.hostName || ''} onChange={e => setDraftDetails(prev => prev ? { ...prev, hostName: e.target.value } : prev)} className={styles.addInput} style={{ margin: 0, padding: '0.15rem 0.35rem', fontSize: '0.68rem', fontWeight: 700, flex: 1, minWidth: 100 }} />
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb' }}>RSVP by</span>
                            <input type="date" value={draftDetails?.rsvpBy || ''} onChange={e => setDraftDetails(prev => prev ? { ...prev, rsvpBy: e.target.value } : prev)} className={styles.addInput} style={{ margin: 0, padding: '0.15rem 0.35rem', fontSize: '0.68rem', flex: 1, minWidth: 110 }} />

                            <button onClick={saveEventDetails} style={{ background: 'var(--teal)', border: 'none', borderRadius: 6, padding: '0.2rem 0.6rem', fontSize: '0.65rem', fontWeight: 800, color: '#fff', cursor: 'pointer' }}>✓ Save</button>
                            <button onClick={() => { setIsEditingStrip(false); setDraftDetails(null) }} style={{ background: 'none', border: '1px solid #ccc', borderRadius: 6, padding: '0.2rem 0.5rem', fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', cursor: 'pointer' }}>✕ Cancel</button>
                        </>
                    ) : (
                        <>
                            {/* Read-only (Label mode) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', borderRight: '1px solid var(--border)', paddingRight: '0.6rem', cursor: 'pointer' }} onClick={() => { setDraftDetails({ hostName: editableHostName, rsvpBy: rsvpByDate || '', time: editableEventTime, timezone: editableTimezone }); setIsEditingStrip(true) }}>
                                {planData?.date && <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--navy)' }}>🗓️ {new Date(planData.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                                {editableEventTime && <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--teal)' }}>⏰ {formatTime12h(editableEventTime, editableTimezone || undefined)}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', borderRight: '1px solid var(--border)', paddingRight: '0.6rem', cursor: 'pointer' }} onClick={() => { setDraftDetails({ hostName: editableHostName, rsvpBy: rsvpByDate || '', time: editableEventTime, timezone: editableTimezone }); setIsEditingStrip(true) }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb' }}>Host:</span>
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--navy)' }}>{editableHostName || 'TBD'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginRight: 'auto', cursor: 'pointer' }} onClick={() => { setDraftDetails({ hostName: editableHostName, rsvpBy: rsvpByDate || '', time: editableEventTime, timezone: editableTimezone }); setIsEditingStrip(true) }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb' }}>RSVP by:</span>
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--navy)' }}>{rsvpByDate ? new Date(rsvpByDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Set date'}</span>
                            </div>

                            <button onClick={() => { setDraftDetails({ hostName: editableHostName, rsvpBy: rsvpByDate || '', time: editableEventTime, timezone: editableTimezone }); setIsEditingStrip(true) }} style={{ background: 'none', border: '1px solid var(--teal)', borderRadius: 6, padding: '0.15rem 0.5rem', fontSize: '0.65rem', fontWeight: 800, color: 'var(--teal)', cursor: 'pointer' }}>✏️ Edit Details</button>

                            <input ref={customInviteRef} type="file" accept="image/*" onChange={handleCustomInviteUpload} style={{ display: 'none' }} />
                            <input ref={coverPhotoRef} type="file" accept="image/*" onChange={handleCoverPhotoUpload} style={{ display: 'none' }} />
                            <button onClick={() => customInviteRef.current?.click()} style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid var(--border)', borderRadius: 6, padding: '0.15rem 0.5rem', fontSize: '0.65rem', fontWeight: 800, color: 'var(--navy)', cursor: 'pointer' }}>🖼️ Invite</button>
                            <button onClick={() => coverPhotoRef.current?.click()} style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid var(--border)', borderRadius: 6, padding: '0.15rem 0.5rem', fontSize: '0.65rem', fontWeight: 800, color: 'var(--navy)', cursor: 'pointer' }}>📸 Cover</button>
                            <button onClick={() => setShowRegistryForm(!showRegistryForm)} style={{ background: giftRegistry.length > 0 ? 'rgba(123,94,167,0.08)' : 'rgba(0,0,0,0.04)', border: `1.5px solid ${giftRegistry.length > 0 ? 'rgba(123,94,167,0.3)' : 'var(--border)'}`, borderRadius: 6, padding: '0.15rem 0.5rem', fontSize: '0.65rem', fontWeight: 800, color: giftRegistry.length > 0 ? '#7B5EA7' : 'var(--navy)', cursor: 'pointer' }}>🎁 Registry{giftRegistry.length > 0 ? ` (${giftRegistry.length})` : ''}</button>
                        </>
                    )}
                </div>
                {/* Gift Registry Section */}
                {showRegistryForm && (
                    <div style={{ padding: '0.6rem 1.2rem', background: '#fff', borderTop: '1px solid var(--border)', marginBottom: '0.5rem', borderRadius: '0 0 12px 12px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>🎁 Gift Registry Links <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#9aabbb' }}>— shown on your RSVP page</span></div>
                        {giftRegistry.map((reg, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem', padding: '0.3rem 0.5rem', background: 'rgba(123,94,167,0.05)', borderRadius: 8, border: '1px solid rgba(123,94,167,0.12)' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7B5EA7', minWidth: 60 }}>{reg.name}</span>
                                <a href={reg.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.68rem', color: 'var(--teal)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textDecoration: 'underline' }}>{reg.url}</a>
                                <button onClick={() => setGiftRegistry(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E8896A', fontWeight: 800, fontSize: '0.7rem', padding: '0.1rem 0.3rem' }}>✕</button>
                            </div>
                        ))}
                        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                            <select value={registryForm.name} onChange={e => setRegistryForm(prev => ({ ...prev, name: e.target.value }))} className={styles.addInput} style={{ margin: 0, padding: '0.2rem 0.3rem', fontSize: '0.68rem', fontWeight: 700, minWidth: 100 }}>
                                <option value="">Platform...</option>
                                <option>Amazon</option>
                                <option>Target</option>
                                <option>Zola</option>
                                <option>Crate & Barrel</option>
                                <option>Etsy</option>
                                <option>Custom</option>
                            </select>
                            <input value={registryForm.url} onChange={e => setRegistryForm(prev => ({ ...prev, url: e.target.value }))} placeholder="https://registry-link.com/..." className={styles.addInput} style={{ margin: 0, padding: '0.2rem 0.35rem', fontSize: '0.68rem', flex: 1, minWidth: 160 }} />
                            <button disabled={!registryForm.name || !registryForm.url} onClick={() => { if (registryForm.name && registryForm.url) { setGiftRegistry(prev => [...prev, { name: registryForm.name, url: registryForm.url.startsWith('http') ? registryForm.url : `https://${registryForm.url}` }]); setRegistryForm({ name: '', url: '' }); showToast('Registry link added!', 'success') } }} style={{ background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 6, padding: '0.2rem 0.5rem', fontSize: '0.68rem', fontWeight: 800, cursor: !registryForm.name || !registryForm.url ? 'not-allowed' : 'pointer', opacity: !registryForm.name || !registryForm.url ? 0.5 : 1, whiteSpace: 'nowrap' }}>+ Add</button>
                        </div>
                    </div>
                )}

                <div className={styles.mainLayout}>
                    <div>

                        {/* Guest management actions */}
                        <div className={styles.actionsRow}>
                            <button className={styles.actionBtn} onClick={() => { setShowAdd(!showAdd); setShowBulk(false); setShowCircles(false) }}>+ Add Guest</button>
                            <button className={styles.secondaryBtn} onClick={() => { setShowBulk(!showBulk); setShowAdd(false); setShowCircles(false) }}>📋 Bulk Import</button>
                            <div style={{ position: 'relative', display: 'inline-flex' }}>
                                <button className={styles.secondaryBtn} onClick={() => { setShowCircles(!showCircles); setShowAdd(false); setShowBulk(false); setSelectedContactIds(new Set()); setSelectedCircleFilter(null); dismissImportHint() }}>👥 From Circles</button>
                                {showImportHint && (
                                    <div style={{ position: 'absolute', top: '-2.2rem', left: '50%', transform: 'translateX(-50%)', background: 'var(--navy)', color: '#fff', fontSize: '0.6rem', fontWeight: 800, padding: '0.25rem 0.5rem', borderRadius: 6, whiteSpace: 'nowrap', zIndex: 50, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', pointerEvents: 'none' }}>
                                        Import from Guest Management 👥
                                        <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid var(--navy)' }} />
                                    </div>
                                )}
                                {showImportHint && (
                                    <span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: '#E8896A', animation: 'pulse 1.5s infinite', zIndex: 51 }} />
                                )}
                            </div>
                            {!isGuest && guests.length > 0 && (
                                <button className={styles.secondaryBtn} onClick={() => { setSelectionMode(!selectionMode); setSelectedGuestIds(new Set()); setEmailAction(null) }}>
                                    {selectionMode ? '✕ Cancel' : '✉️ Email Guests'}
                                </button>
                            )}
                        </div>

                        {/* Selection toolbar */}
                        {selectionMode && (
                            <div className={styles.selectionBar}>
                                <span className={styles.selectionCount}>
                                    {selectedGuestIds.size === 0 ? 'Select guests to email' : `${selectedGuestIds.size} guest${selectedGuestIds.size !== 1 ? 's' : ''} selected`}
                                </span>
                                <button className={styles.selectionBtn} onClick={selectAllFiltered}>Select All</button>
                                {selectedGuestIds.size > 0 && (
                                    <>
                                        <button className={styles.selectionBtn} onClick={() => setSelectedGuestIds(new Set())}>Deselect All</button>
                                        <button className={styles.selectionBtnPrimary} onClick={() => { setEmailAction('rsvp'); handleSendRsvpEmail() }} disabled={sendingEmail}>
                                            {sendingEmail && emailAction === 'rsvp' ? '⏳ Sending...' : '📨 Send RSVP'}
                                        </button>
                                        <button className={styles.selectionBtnPrimary} onClick={() => { setEmailAction('custom'); setShowCustomMessageModal(true) }}>
                                            💌 Custom Message
                                        </button>
                                    </>
                                )}
                                <button className={styles.selectionBtnCancel} onClick={clearSelection}>✕</button>
                            </div>
                        )}

                        {/* Search */}
                        <input className={styles.searchInput} placeholder="🔍 Search guests..." value={search} onChange={e => setSearch(e.target.value)} />

                        {/* Add Form */}
                        {showAdd && (
                            <div className={styles.addForm}>
                                <h4 style={{ fontFamily: "'Fredoka One',cursive", marginBottom: '0.8rem', color: 'var(--navy)', fontSize: '0.95rem' }}>Add New Guest</h4>
                                <div className={styles.addRow}>
                                    <input placeholder="Full Name *" value={newGuest.name} onChange={e => setNewGuest({ ...newGuest, name: e.target.value })} className={styles.addInput} />
                                    <input placeholder="Email *" type="email" value={newGuest.email} onChange={e => setNewGuest({ ...newGuest, email: e.target.value })} className={styles.addInput} />
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
                                                    avatar: c.avatar, color: c.color,
                                                    circles: c.circles || [],
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
                            ) : filteredGuests.map(g => {
                                const gCircles = getGuestCircles(g)
                                return (
                                <div key={g.id} className={styles.guestEntry}>
                                    <div className={styles.guestRow} onClick={() => setExpandedGuest(expandedGuest === g.id ? null : g.id)} style={{ cursor: 'pointer' }}>
                                        {selectionMode && (
                                            <input
                                                type="checkbox"
                                                className={styles.selectCheckbox}
                                                checked={selectedGuestIds.has(g.id)}
                                                onChange={e => { e.stopPropagation(); toggleGuestSelection(g.id) }}
                                                onClick={e => e.stopPropagation()}
                                            />
                                        )}
                                        <div className={styles.guestAvatar} style={{ background: g.color }}>{g.avatar}</div>
                                        <div className={styles.guestInfo}>
                                            <div className={styles.guestName}>{g.name}</div>
                                            <div className={styles.guestEmail}>{g.email}</div>
                                        </div>
                                        {g.dietary !== 'None' && <span className={styles.dietary}>{g.dietary}</span>}
                                        {g.additionalGuests.length > 0 && <span className={styles.partySize} title={g.additionalGuests.map(ag => ag.name || 'Guest').join(', ')}>👥 +{g.additionalGuests.length}</span>}
                                        {gCircles.length > 0 && gCircles.map(c => (
                                            <span key={c} style={{
                                                padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.65rem',
                                                fontWeight: 700, background: 'rgba(74,173,168,0.1)', color: 'var(--teal)',
                                                border: '1px solid rgba(74,173,168,0.2)', whiteSpace: 'nowrap',
                                            }}>{c}</span>
                                        ))}
                                        {!isGuest && (
                                            <div className={styles.circleDropdown} onClick={e => e.stopPropagation()}>
                                                <button
                                                    className={`${styles.circleBtn} ${gCircles.length > 0 ? styles.circleBtnActive : ''}`}
                                                    title="Assign circle"
                                                    onClick={() => setOpenCircleDropdown(openCircleDropdown === g.id ? null : g.id)}
                                                >
                                                    🏷️ {gCircles.length > 0 ? gCircles.length : '+'}
                                                </button>
                                            </div>
                                        )}
                                        <select value={g.status} onChange={e => { e.stopPropagation(); updateStatus(g.id, e.target.value as Guest['status']) }} onClick={e => e.stopPropagation()} className={styles.statusSelect} style={{ background: STATUS_BG[g.status], color: STATUS_COLORS[g.status] }}>
                                            <option value="going">✓ Going</option>
                                            <option value="maybe">? Maybe</option>
                                            <option value="declined">✗ Declined</option>
                                            <option value="pending">⏳ Pending</option>
                                        </select>
                                        <button className={styles.removeBtn} onClick={e => { e.stopPropagation(); removeGuest(g.id) }}>✕</button>
                                        <span className={styles.expandIcon}>{expandedGuest === g.id ? '▾' : '▸'}</span>
                                    </div>

                                    {/* Inline circle assignment — shows below the row */}
                                    {openCircleDropdown === g.id && (
                                        <div onClick={e => e.stopPropagation()} style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
                                            padding: '0.5rem 1rem 0.5rem 2.5rem',
                                            background: 'rgba(74,173,168,0.04)',
                                            borderTop: '1px dashed var(--border)',
                                        }}>
                                            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '0.3rem' }}>Circles:</span>
                                            {savedCircles.map(c => (
                                                <label key={c} style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                                                    padding: '0.2rem 0.5rem', borderRadius: 6,
                                                    background: gCircles.includes(c) ? 'rgba(74,173,168,0.12)' : 'transparent',
                                                    border: `1px solid ${gCircles.includes(c) ? 'rgba(74,173,168,0.3)' : 'var(--border)'}`,
                                                    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                                    color: gCircles.includes(c) ? 'var(--teal)' : 'var(--navy)',
                                                    transition: 'all 0.15s',
                                                }}>
                                                    <input type="checkbox" checked={gCircles.includes(c)}
                                                        onChange={() => toggleGuestCircle(g.id, c)}
                                                        style={{ accentColor: 'var(--teal)' }} />
                                                    {c}
                                                </label>
                                            ))}
                                            {savedCircles.length === 0 && (
                                                <span style={{ fontSize: '0.75rem', color: '#9aabbb', fontWeight: 600 }}>No circles yet. <a href="/guests" style={{ color: 'var(--teal)', fontWeight: 800 }}>Create circles</a></span>
                                            )}
                                            <button onClick={() => setOpenCircleDropdown(null)} style={{
                                                marginLeft: 'auto', border: 'none', background: 'none',
                                                color: '#9aabbb', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                                            }}>Done</button>
                                        </div>
                                    )}

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
                                                        <button
                                                            onClick={() => updateAdditionalExisting(g.id, ag.id, 'isChild', !ag.isChild)}
                                                            style={{
                                                                padding: '0.3rem 0.7rem', borderRadius: 16,
                                                                border: `1.5px solid ${ag.isChild ? 'rgba(247,201,72,0.5)' : 'rgba(61,140,110,0.3)'}`,
                                                                background: ag.isChild ? 'rgba(247,201,72,0.12)' : 'rgba(61,140,110,0.08)',
                                                                color: ag.isChild ? '#c4880a' : '#3D8C6E',
                                                                fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s',
                                                                whiteSpace: 'nowrap', flexShrink: 0,
                                                            }}
                                                        >
                                                            {ag.isChild ? '👶 Kid' : '🧑 Adult'}
                                                        </button>
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
                            )})}
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
                            <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#3D8C6E', textTransform: 'uppercase', textAlign: 'center', marginBottom: '0.4rem' }}>✓ Confirmed</div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '1.2rem' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1.5rem', color: 'var(--navy)' }}>{adultsCount}</div>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase' }}>🧑 Adults</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1.5rem', color: '#c4880a' }}>{kidsCount}</div>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase' }}>👶 Kids</div>
                                    </div>
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
                                        {planData.date && <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', margin: '0 0 0.2rem', fontWeight: 600 }}>🗓️ {new Date(planData.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}{editableEventTime ? ` (${formatTime12h(editableEventTime, editableTimezone || undefined)})` : ''}</p>}
                                        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', margin: 0, fontWeight: 600 }}>📍 {planData.location || 'Location TBD'}</p>
                                        {rsvpByDate && <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.75rem', margin: '0.3rem 0 0', fontWeight: 600 }}>⏰ RSVP by {new Date(rsvpByDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>}
                                        {editableHostName && <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.72rem', margin: '0.2rem 0 0', fontWeight: 600 }}>Host: {editableHostName}</p>}
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
                                {giftRegistry.length > 0 && (
                                    <div style={{ padding: '0.8rem 1.2rem', borderTop: '1px solid rgba(0,0,0,0.05)', background: 'rgba(123,94,167,0.04)' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7B5EA7', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>🎁 Gift Registry</div>
                                        {giftRegistry.map((reg, idx) => (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', padding: '0.3rem 0.5rem', background: '#fff', borderRadius: 8, border: '1px solid rgba(123,94,167,0.12)' }}>
                                                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#7B5EA7' }}>{reg.name}</span>
                                                <span style={{ fontSize: '0.62rem', color: 'var(--teal)', fontWeight: 600 }}>→ View</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div style={{ textAlign: 'center' as const, padding: '0.5rem', fontSize: '0.65rem', color: '#ccc', fontWeight: 600 }}>Powered by <img src="/logo.png" alt="" style={{ height: 12, borderRadius: 2, verticalAlign: 'middle' }} /> PartyPal</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Message Modal */}
            {showCustomMessageModal && (
                <div className={styles.modalOverlay} onClick={() => { setShowCustomMessageModal(false); setCustomMessage('') }}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <span className={styles.modalTitle}>💌 Send Custom Message</span>
                            <button className={styles.modalClose} onClick={() => { setShowCustomMessageModal(false); setCustomMessage('') }}>✕</button>
                        </div>
                        <div className={styles.modalBody}>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>
                                To ({selectedGuestsWithEmail.length} guest{selectedGuestsWithEmail.length !== 1 ? 's' : ''})
                            </label>
                            <div className={styles.modalRecipients}>
                                {selectedGuestsWithEmail.map(g => (
                                    <span key={g.id} className={styles.recipientChip}>{g.name}</span>
                                ))}
                            </div>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>
                                Your Message
                            </label>
                            <textarea
                                className={styles.modalTextarea}
                                placeholder="Type your message to guests here..."
                                value={customMessage}
                                onChange={e => setCustomMessage(e.target.value)}
                                autoFocus
                            />
                            <p style={{ fontSize: '0.72rem', color: '#b0bfcc', fontWeight: 600, marginTop: '0.4rem' }}>
                                This message will be sent as a styled email matching the PartyPal look and feel, including your event details.
                            </p>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.modalCancelBtn} onClick={() => { setShowCustomMessageModal(false); setCustomMessage('') }}>Cancel</button>
                            <button
                                className={styles.modalSendBtn}
                                disabled={!customMessage.trim() || sendingEmail}
                                onClick={handleSendCustomMessage}
                            >
                                {sendingEmail ? '⏳ Sending...' : `Send to ${selectedGuestsWithEmail.length} Guest${selectedGuestsWithEmail.length !== 1 ? 's' : ''}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
