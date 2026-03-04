'use client'
import { userGet, userGetJSON, userSetJSON } from '@/lib/userStorage'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './rsvp.module.css'

interface AdditionalGuest {
    id: string; name: string; dietary: string; relationship: string; isChild: boolean
}

const DIETARY_OPTIONS = ['None', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Nut Allergy', 'Kosher', 'Halal', 'Dairy-Free', 'Shellfish Allergy']
const RELATIONSHIP_OPTIONS = ['Partner', 'Spouse', 'Child', 'Family', 'Friend', 'Other']
const getTZAbbr = () => { try { const d = new Date(); const parts = d.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' '); return parts[parts.length - 1] } catch { return '' } }
const formatTime12h = (t: string, tz?: string) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); const ampm = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 || 12; const tzStr = tz ? ` ${tz}` : ''; return `${h12}:${m.toString().padStart(2, '0')} ${ampm}${tzStr}` }

function generateICS(event: { name: string; date?: string; time?: string; timezone?: string; location?: string; description?: string }): string {
    const pad = (n: number) => n.toString().padStart(2, '0')
    const now = new Date()
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
    let dtStart = stamp
    let dtEnd = stamp
    if (event.date) {
        const [y, mo, d] = event.date.split('-').map(Number)
        const hh = event.time ? parseInt(event.time.split(':')[0]) : 18
        const mm = event.time ? parseInt(event.time.split(':')[1]) : 0
        dtStart = `${y}${pad(mo)}${pad(d)}T${pad(hh)}${pad(mm)}00`
        const endH = hh + 2
        dtEnd = `${y}${pad(mo)}${pad(d)}T${pad(endH > 23 ? 23 : endH)}${pad(mm)}00`
    }
    const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n')
    const lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PartyPal//RSVP//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
        'BEGIN:VEVENT', `DTSTART:${dtStart}`, `DTEND:${dtEnd}`, `DTSTAMP:${stamp}`,
        `UID:${Date.now()}@partypal.social`, `SUMMARY:${esc(event.name)}`,
        event.location ? `LOCATION:${esc(event.location)}` : '',
        event.description ? `DESCRIPTION:${esc(event.description)}` : '',
        'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR',
    ].filter(Boolean)
    return lines.join('\r\n')
}
function downloadICS(icsContent: string, filename: string) {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

function RSVPContent() {
    const params = useSearchParams()
    const [eventData, setEventData] = useState<{ eventType?: string; date?: string; time?: string; timezone?: string; location?: string; theme?: string; eventId?: string; inviteSubject?: string; inviteMessage?: string; rsvpBy?: string; customImage?: string; coverPhoto?: string; hostName?: string }>({})
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [response, setResponse] = useState<'going' | 'maybe' | 'declined' | ''>('')
    const [dietary, setDietary] = useState('None')
    const [additionalGuests, setAdditionalGuests] = useState<AdditionalGuest[]>([])
    const [submitted, setSubmitted] = useState(false)
    const [isUpdate, setIsUpdate] = useState(false)
    const [lookingUp, setLookingUp] = useState(false)

    // Look up previous RSVP from Firestore by email
    const lookupRsvp = async (lookupEmail: string) => {
        if (!lookupEmail || !eventData.eventId) return
        setLookingUp(true)
        try {
            const res = await fetch(`/api/events/${eventData.eventId}/rsvp?email=${encodeURIComponent(lookupEmail.trim().toLowerCase())}`)
            const data = await res.json()
            if (data.found && data.rsvp) {
                const prev = data.rsvp
                if (prev.name) setName(prev.name)
                if (prev.response) setResponse(prev.response)
                if (prev.dietary && prev.dietary !== 'None') setDietary(prev.dietary)
                if (prev.additionalGuests?.length) setAdditionalGuests(prev.additionalGuests)
                setIsUpdate(true)
            }
        } catch { /* ignore */ }
        setLookingUp(false)
    }

    useEffect(() => {
        const eventId = params.get('e') || undefined
        const eventType = params.get('n') || params.get('event') || undefined
        const date = params.get('d') || params.get('date') || undefined
        const location = params.get('l') || params.get('location') || undefined
        const theme = params.get('t') || params.get('theme') || undefined

        const versionId = params.get('v') || undefined

        // Try Firestore first (for guests who don't have localStorage)
        if (eventId) {
            fetch(`/api/events/${eventId}`)
                .then(res => res.json())
                .then(data => {
                    if (data && !data.error) {
                        // If version ID specified, load that frozen version; otherwise fall back to live invite
                        let invSubject = data.invite?.subject
                        let invMessage = data.invite?.message
                        let invCustomImage = data.invite?.customImage
                        let invCoverPhoto = data.invite?.coverPhoto
                        if (versionId && data.inviteVersions && data.inviteVersions[versionId]) {
                            const ver = data.inviteVersions[versionId]
                            invSubject = ver.subject
                            invMessage = ver.message
                            if (ver.customImage) invCustomImage = ver.customImage
                            if (ver.coverPhoto) invCoverPhoto = ver.coverPhoto
                        }
                        setEventData({
                            eventId,
                            eventType: data.eventType || eventType || 'Party',
                            date: data.date || date || '',
                            time: data.time,
                            timezone: data.timezone,
                            location: data.location || location || '',
                            theme: data.theme || theme || '',
                            inviteSubject: invSubject,
                            inviteMessage: invMessage,
                            rsvpBy: data.rsvpBy,
                            customImage: invCustomImage,
                            coverPhoto: invCoverPhoto,
                            hostName: data.hostName,
                        })
                        return
                    }
                })
                .catch(() => { })
        }

        // Fallback: localStorage then URL params
        const stored = userGet('partyplan')
        if (stored) {
            const p = JSON.parse(stored)
            setEventData({
                eventId,
                eventType: eventType || p.eventType || 'Party',
                date: date || p.date,
                time: p.time,
                timezone: p.timezone,
                location: location || p.location,
                theme: theme || p.theme,
                hostName: p.hostName,
            })
        } else {
            setEventData({
                eventId,
                eventType: eventType || 'Party',
                date: date || '',
                location: location || '',
                theme: theme || '',
            })
        }
    }, [params])

    const addAdditionalGuest = () => {
        setAdditionalGuests(prev => [...prev, {
            id: Date.now().toString(),
            name: '',
            dietary: 'None',
            relationship: 'Partner',
            isChild: false
        }])
    }

    const updateAdditionalGuest = (id: string, field: string, value: string) => {
        setAdditionalGuests(prev => prev.map(ag => ag.id === id ? { ...ag, [field]: value } : ag))
    }

    const removeAdditionalGuest = (id: string) => {
        setAdditionalGuests(prev => prev.filter(ag => ag.id !== id))
    }

    const handleSubmit = () => {
        if (!name || !email || !response) return
        const validAdditional = additionalGuests.filter(ag => ag.name.trim())
        const kidCount = validAdditional.filter(ag => ag.isChild).length
        // Save to Firestore (upserts by email)
        if (eventData.eventId) {
            fetch(`/api/events/${eventData.eventId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, response, dietary, additionalGuests: validAdditional, totalPartySize: 1 + validAdditional.length, kidCount }),
            }).catch(() => { })
        }
        // Save to localStorage (legacy)
        const rsvps = userGetJSON('partypal_rsvps', [] as Record<string, unknown>[])
        rsvps.push({ name, email, response, dietary, eventId: eventData.eventId, additionalGuests: validAdditional, totalPartySize: 1 + validAdditional.length, kidCount, timestamp: new Date().toISOString() })
        userSetJSON('partypal_rsvps', rsvps)
        // Send thank-you / update email
        if (email) {
            const eventDateStr = eventData.date
                ? new Date(eventData.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                : 'TBD'
            fetch('/api/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'rsvp_confirmation',
                    guestEmail: email,
                    guestName: name,
                    eventName: eventName,
                    eventDate: eventDateStr,
                    eventTime: eventData.time ? formatTime12h(eventData.time, eventData.timezone) : undefined,
                    eventLocation: eventData.location || 'Location TBD',
                    response,
                    additionalGuests: validAdditional.length,
                    rsvpLink: typeof window !== 'undefined' ? window.location.href : '',
                }),
            }).catch(() => { })
        }
        setSubmitted(true)
    }

    const handleAddToCalendar = () => {
        const desc = eventData.inviteMessage || `You're invited to ${eventName}!`
        const ics = generateICS({
            name: eventName,
            date: eventData.date,
            time: eventData.time,
            timezone: eventData.timezone,
            location: eventData.location,
            description: desc,
        })
        downloadICS(ics, `${eventName.replace(/[^a-zA-Z0-9]/g, '_')}.ics`)
    }

    const eventEmoji = eventData.eventType?.split(' ')[0] || '🎉'
    const eventName = eventData.eventType?.replace(/^[^\s]+\s/, '') || 'Party'
    const totalPartySize = 1 + additionalGuests.length

    return (
        <div className={styles.rsvpPage}>
            <div className={styles.rsvpCard}>
                <div className={styles.rsvpHeader} style={eventData.coverPhoto ? { backgroundImage: `url(${eventData.coverPhoto})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' as const } : undefined}>
                    {eventData.coverPhoto && <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,37,53,0.65)', borderRadius: 'inherit' }} />}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <span className={styles.rsvpEmoji}>{eventEmoji}</span>
                        <h1 className={styles.rsvpEventName} style={eventData.coverPhoto ? { color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.4)' } : undefined}>{eventName}</h1>
                        {eventData.date && (
                            <p className={styles.rsvpDetails} style={eventData.coverPhoto ? { color: 'rgba(255,255,255,0.9)' } : { marginBottom: '0.2rem' }}>
                                🗓️ {new Date(eventData.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}{eventData.time ? ` (${formatTime12h(eventData.time, eventData.timezone || undefined)})` : ''}
                            </p>
                        )}
                        <p className={styles.rsvpDetails} style={eventData.coverPhoto ? { color: 'rgba(255,255,255,0.9)' } : undefined}>
                            📍 {eventData.location || 'Location TBD'}
                        </p>
                        {eventData.rsvpBy && (
                            <p className={styles.rsvpDetails} style={eventData.coverPhoto ? { color: 'rgba(255,255,255,0.85)', marginTop: '0.2rem' } : { marginTop: '0.2rem' }}>
                                ⏰ RSVP by {new Date(eventData.rsvpBy + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                        )}
                        {eventData.hostName && (
                            <p className={styles.rsvpDetails} style={eventData.coverPhoto ? { color: 'rgba(255,255,255,0.75)', marginTop: '0.15rem', fontSize: '0.78rem' } : { marginTop: '0.15rem', fontSize: '0.78rem' }}>
                                Host: {eventData.hostName}
                            </p>
                        )}
                    </div>
                </div>

                {/* Show custom invite image if uploaded, otherwise show text */}
                {eventData.customImage ? (
                    <div style={{ padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <img src={eventData.customImage} alt="Event Invitation" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
                    </div>
                ) : eventData.inviteMessage && (
                    <div style={{ padding: '1.2rem 1.5rem', background: 'rgba(247,201,72,0.08)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        {eventData.inviteSubject && <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: '0.95rem', color: 'var(--navy)', marginBottom: '0.6rem' }}>{eventData.inviteSubject}</div>}
                        {eventData.inviteMessage.split('\n').map((line, i) => (
                            <p key={i} style={{ fontSize: '0.85rem', color: '#4a5568', lineHeight: 1.65, fontWeight: 500, margin: line.trim() ? '0 0 0.5rem 0' : '0 0 0.3rem 0' }}>{line || '\u00A0'}</p>
                        ))}
                    </div>
                )}

                {!submitted ? (
                    <div className={styles.rsvpBody}>
                        <div>
                            <div className={styles.rsvpLabel}>Your Name *</div>
                            <input className={styles.rsvpInput} placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div>
                            <div className={styles.rsvpLabel}>Email *</div>
                            <input className={styles.rsvpInput} type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} onBlur={e => { if (e.target.value.includes('@')) lookupRsvp(e.target.value) }} required style={{ borderColor: !email && name ? '#E8896A' : isUpdate ? '#4AADA8' : undefined }} />
                            {lookingUp && <div style={{ fontSize: '0.7rem', color: '#4AADA8', fontWeight: 700, marginTop: '0.2rem' }}>🔍 Looking up your RSVP...</div>}
                            {isUpdate && !lookingUp && <div style={{ fontSize: '0.7rem', color: '#4AADA8', fontWeight: 700, marginTop: '0.2rem' }}>✅ Welcome back! Your previous RSVP has been loaded.</div>}
                            {!email && name && !isUpdate && <div style={{ fontSize: '0.7rem', color: '#E8896A', fontWeight: 700, marginTop: '0.2rem' }}>Email is required so we can send you event details</div>}
                        </div>
                        <div>
                            <div className={styles.rsvpLabel}>Will You Attend? *</div>
                            <div className={styles.rsvpOptions}>
                                {[
                                    { val: 'going' as const, label: '✓ Going', emoji: '🎉' },
                                    { val: 'maybe' as const, label: '? Maybe', emoji: '🤔' },
                                    { val: 'declined' as const, label: '✗ Can\'t', emoji: '😢' },
                                ].map(opt => (
                                    <div
                                        key={opt.val}
                                        className={`${styles.rsvpOption} ${response === opt.val ? styles.rsvpOptionActive : ''}`}
                                        onClick={() => setResponse(opt.val)}
                                    >
                                        <div style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>{opt.emoji}</div>
                                        {opt.label}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <div className={styles.rsvpLabel}>Your Dietary Needs</div>
                            <select className={styles.rsvpInput} value={dietary} onChange={e => setDietary(e.target.value)} style={{ cursor: 'pointer' }}>
                                {DIETARY_OPTIONS.map(d => <option key={d}>{d}</option>)}
                            </select>
                        </div>

                        {/* Additional Guests Section */}
                        <div className={styles.additionalSection}>
                            <div className={styles.additionalHeader}>
                                <div>
                                    <div className={styles.additionalTitle}>👥 Bringing Anyone?</div>
                                    <div className={styles.additionalSubtitle}>Tap to add your crew</div>
                                </div>
                            </div>

                            {/* Quick +N buttons */}
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                                {[1, 2, 3, 4].map(n => {
                                    const isActive = additionalGuests.length === n
                                    return (
                                        <button key={n} onClick={() => {
                                            if (additionalGuests.length < n) {
                                                const toAdd = n - additionalGuests.length
                                                setAdditionalGuests(prev => [...prev, ...Array.from({ length: toAdd }, (_, i) => ({ id: (Date.now() + i).toString(), name: `Guest ${prev.length + i + 2}`, dietary: 'None', relationship: 'Friend', isChild: false }))])
                                            } else if (additionalGuests.length > n) {
                                                setAdditionalGuests(prev => prev.slice(0, n))
                                            }
                                        }} style={{ padding: '0.45rem 1rem', borderRadius: 20, border: `1.5px solid ${isActive ? 'rgba(74,173,168,0.5)' : 'rgba(0,0,0,0.1)'}`, background: isActive ? 'rgba(74,173,168,0.1)' : 'white', color: isActive ? 'var(--teal)' : '#6b7c93', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s' }}>+{n}</button>
                                    )
                                })}
                                {additionalGuests.length > 0 && (
                                    <button onClick={() => setAdditionalGuests([])} style={{ padding: '0.45rem 0.8rem', borderRadius: 20, border: '1.5px solid rgba(232,137,106,0.3)', background: 'rgba(232,137,106,0.05)', color: '#E8896A', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>Clear</button>
                                )}
                            </div>

                            {additionalGuests.map((ag, idx) => (
                                <div key={ag.id} className={styles.additionalCard}>
                                    <div className={styles.additionalCardHeader}>
                                        <span className={styles.additionalCardNum}>Guest {idx + 2}: {ag.name}</span>
                                        <button className={styles.additionalRemove} onClick={() => removeAdditionalGuest(ag.id)} title="Remove">✕</button>
                                    </div>
                                    <div className={styles.additionalCardBody}>
                                        <div className={styles.additionalFieldRow}>
                                            <div className={styles.additionalField}>
                                                <label className={styles.additionalFieldLabel}>Name</label>
                                                <input className={styles.additionalInput} placeholder={`Guest ${idx + 2}`} value={ag.name === `Guest ${idx + 2}` ? '' : ag.name} onChange={e => updateAdditionalGuest(ag.id, 'name', e.target.value || `Guest ${idx + 2}`)} />
                                            </div>
                                            <div className={styles.additionalField}>
                                                <label className={styles.additionalFieldLabel}>Dietary Needs</label>
                                                <select className={styles.additionalInput} value={ag.dietary} onChange={e => updateAdditionalGuest(ag.id, 'dietary', e.target.value)}>
                                                    {DIETARY_OPTIONS.map(d => <option key={d}>{d}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => setAdditionalGuests(prev => prev.map(g => g.id === ag.id ? { ...g, isChild: !g.isChild } : g))}
                                                style={{
                                                    padding: '0.3rem 0.8rem', borderRadius: 16,
                                                    border: `1.5px solid ${ag.isChild ? 'rgba(247,201,72,0.5)' : 'rgba(0,0,0,0.1)'}`,
                                                    background: ag.isChild ? 'rgba(247,201,72,0.12)' : 'white',
                                                    color: ag.isChild ? '#c4880a' : '#9aabbb',
                                                    fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s',
                                                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                                                }}
                                            >
                                                {ag.isChild ? '👶 Child' : '👶 Child?'}
                                            </button>
                                            {ag.isChild && <span style={{ fontSize: '0.68rem', color: '#c4880a', fontWeight: 600 }}>Under 12</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {additionalGuests.length === 0 && (
                                <div className={styles.additionalEmpty}>
                                    <span style={{ fontSize: '1.5rem' }}>👨‍👩‍👧‍👦</span>
                                    <span>Coming solo? No problem! Or tap +1, +2, +3 above.</span>
                                </div>
                            )}
                        </div>

                        {totalPartySize > 1 && (() => {
                            const kidCount = additionalGuests.filter(ag => ag.isChild).length
                            const adultCount = totalPartySize - kidCount
                            return (
                                <div className={styles.partySummary}>
                                    🎟️ Party size: <strong>{totalPartySize} {totalPartySize === 1 ? 'person' : 'people'}</strong>
                                    {kidCount > 0 && <span style={{ marginLeft: '0.4rem', fontSize: '0.78rem', color: '#c4880a', fontWeight: 700 }}>({adultCount} adult{adultCount !== 1 ? 's' : ''}, {kidCount} kid{kidCount !== 1 ? 's' : ''})</span>}
                                </div>
                            )
                        })()}

                        <button className={styles.rsvpSubmit} onClick={handleSubmit} disabled={!name || !email || !response}>
                            {isUpdate ? 'Update My RSVP' : 'Send My RSVP'} {totalPartySize > 1 ? `(${totalPartySize} people)` : ''} 🎊
                        </button>
                    </div>
                ) : (
                    <div className={styles.rsvpSuccess}>
                        <span className={styles.rsvpSuccessIcon}>
                            {response === 'going' ? '🎉' : response === 'maybe' ? '🤞' : '💌'}
                        </span>
                        <h2 className={styles.rsvpSuccessTitle}>
                            {response === 'going' ? 'See You There!' : response === 'maybe' ? 'We Hope to See You!' : 'Thanks for Letting Us Know'}
                        </h2>
                        <p className={styles.rsvpSuccessMsg}>
                            {response === 'going'
                                ? `Thank you ${name}! We're excited to have ${totalPartySize > 1 ? `your party of ${totalPartySize}` : 'you'} at the ${eventName}. Check your email for more details soon.`
                                : response === 'maybe'
                                    ? `Thanks ${name}! We'll save ${totalPartySize > 1 ? `${totalPartySize} spots` : 'a spot'} for you. Let us know when you've decided!`
                                    : `We'll miss you, ${name}! Maybe next time. 💛`
                            }
                        </p>
                        {response === 'going' && totalPartySize > 1 && (
                            <div className={styles.successPartyList}>
                                <div className={styles.successPartyTitle}>Your Party</div>
                                <div className={styles.successPartyItem}>
                                    <span className={styles.successPartyDot} style={{ background: 'var(--teal)' }} />
                                    {name} {dietary !== 'None' && <span className={styles.successDietary}>{dietary}</span>}
                                </div>
                                {additionalGuests.filter(ag => ag.name.trim()).map(ag => (
                                    <div key={ag.id} className={styles.successPartyItem}>
                                        <span className={styles.successPartyDot} style={{ background: 'var(--yellow)' }} />
                                        {ag.name}
                                        {ag.dietary !== 'None' && <span className={styles.successDietary}>{ag.dietary}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                        {(response === 'going' || response === 'maybe') && eventData.date && (
                            <button onClick={handleAddToCalendar} className={styles.rsvpSubmit} style={{ marginTop: '0.8rem', background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
                                📅 Add to Calendar
                            </button>
                        )}
                    </div>
                )}

                <div className={styles.rsvpPowered}>Powered by <img src="/logo.png" alt="PartyPal" style={{ height: 16, borderRadius: 3, verticalAlign: 'middle' }} /> PartyPal</div>
            </div>
        </div >
    )
}

export default function RSVPPage() {
    return (
        <Suspense fallback={<div className={styles.rsvpPage}><div className="spinner" /></div>}>
            <RSVPContent />
        </Suspense>
    )
}
