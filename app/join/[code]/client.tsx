import { useState } from 'react'
import { SITE_EMAILS } from '@/lib/constants'

interface AdditionalGuest {
    id: string; name: string; dietary: string; relationship: string; isChild: boolean
}

const DIETARY_OPTIONS = ['None', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Nut Allergy', 'Kosher', 'Halal', 'Dairy-Free', 'Shellfish Allergy']

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
        // Default 2h duration
        const endH = hh + 2
        dtEnd = `${y}${pad(mo)}${pad(d)}T${pad(endH > 23 ? 23 : endH)}${pad(mm)}00`
    }

    const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n')

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//PartyPal//RSVP//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `DTSTAMP:${stamp}`,
        `UID:${Date.now()}@${SITE_EMAILS.systemDomain}`,
        `SUMMARY:${esc(event.name)}`,
        event.location ? `LOCATION:${esc(event.location)}` : '',
        event.description ? `DESCRIPTION:${esc(event.description)}` : '',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR',
    ].filter(Boolean)

    return lines.join('\r\n')
}

function downloadICS(icsContent: string, filename: string) {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

interface EventData {
    eventId: string
    eventType?: string
    date?: string
    time?: string
    timezone?: string
    location?: string
    theme?: string
    hostName?: string
    rsvpBy?: string
    invite?: { subject?: string; message?: string; customImage?: string; coverPhoto?: string }
    customImage?: string
    coverPhoto?: string
}

export default function JoinRSVPClient({ eventData }: { eventData: EventData }) {
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

    const eventEmoji = eventData.eventType?.split(' ')[0] || '🎉'
    const eventName = eventData.eventType?.replace(/^[^\s]+\s/, '') || 'Party'
    const totalPartySize = 1 + additionalGuests.length

    const coverPhoto = eventData.invite?.coverPhoto || eventData.coverPhoto
    const customImage = eventData.invite?.customImage || eventData.customImage
    const inviteSubject = eventData.invite?.subject
    const inviteMessage = eventData.invite?.message

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
        // Save to Firestore
        if (eventData.eventId) {
            fetch(`/api/events/${eventData.eventId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name, email, response, dietary,
                    additionalGuests: validAdditional,
                    totalPartySize: 1 + validAdditional.length,
                    kidCount,
                }),
            }).catch(() => { })
        }
        // Send thank-you email
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
        const desc = inviteMessage || `You're invited to ${eventName}!`
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

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e9f0 100%)',
            fontFamily: "'Nunito', sans-serif",
            padding: '1rem',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '480px',
                background: '#fff',
                borderRadius: '20px',
                boxShadow: '0 8px 40px rgba(0,0,0,0.1)',
                overflow: 'hidden',
            }}>
                {/* Header with cover photo or gradient */}
                <div style={{
                    padding: coverPhoto ? '2rem 1.5rem 1.5rem' : '2rem 1.5rem 1.2rem',
                    textAlign: 'center',
                    position: 'relative',
                    ...(coverPhoto ? {
                        backgroundImage: `url(${coverPhoto})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    } : {
                        background: 'linear-gradient(135deg, #1a2535 0%, #2d4059 100%)',
                    }),
                }}>
                    {coverPhoto && <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,37,53,0.65)', borderRadius: 'inherit' }} />}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.3rem' }}>{eventEmoji}</div>
                        <h1 style={{
                            fontFamily: "'Fredoka One', cursive",
                            fontSize: '1.6rem',
                            color: '#fff',
                            margin: '0 0 0.5rem',
                            textShadow: coverPhoto ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
                            lineHeight: 1.2,
                        }}>
                            {eventName}
                        </h1>
                        {eventData.date && (
                            <p style={{
                                color: 'rgba(255,255,255,0.9)',
                                fontWeight: 700,
                                fontSize: '0.88rem',
                                margin: '0 0 0.2rem',
                            }}>
                                🗓️ {new Date(eventData.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                {eventData.time ? ` (${formatTime12h(eventData.time, eventData.timezone)})` : ''}
                            </p>
                        )}
                        <p style={{
                            color: 'rgba(255,255,255,0.9)',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            margin: '0 0 0.2rem',
                        }}>
                            📍 {eventData.location || 'Location TBD'}
                        </p>
                        {eventData.rsvpBy && (
                            <p style={{
                                color: 'rgba(255,255,255,0.85)',
                                fontWeight: 600,
                                fontSize: '0.78rem',
                                margin: '0.2rem 0 0',
                            }}>
                                ⏰ RSVP by {new Date(eventData.rsvpBy + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                        )}
                        {eventData.hostName && (
                            <p style={{
                                color: 'rgba(255,255,255,0.75)',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                margin: '0.15rem 0 0',
                            }}>
                                Host: {eventData.hostName}
                            </p>
                        )}
                    </div>
                </div>

                {/* Custom invite image */}
                {customImage ? (
                    <div style={{ padding: '0.5rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <img src={customImage} alt="Event Invitation" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
                    </div>
                ) : inviteMessage && (
                    <div style={{ padding: '1.2rem 1.5rem', background: 'rgba(247,201,72,0.08)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        {inviteSubject && <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: '0.95rem', color: '#1a2535', marginBottom: '0.6rem' }}>{inviteSubject}</div>}
                        {inviteMessage.split('\n').map((line: string, i: number) => (
                            <p key={i} style={{ fontSize: '0.85rem', color: '#4a5568', lineHeight: 1.65, fontWeight: 500, margin: line.trim() ? '0 0 0.5rem 0' : '0 0 0.3rem 0' }}>{line || '\u00A0'}</p>
                        ))}
                    </div>
                )}

                {/* RSVP Form or Success */}
                {!submitted ? (
                    <div style={{ padding: '1.5rem' }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#1a2535', marginBottom: '0.3rem', letterSpacing: '0.03em' }}>Your Name *</label>
                            <input
                                placeholder="Full name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.65rem 0.8rem', borderRadius: 10,
                                    border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600,
                                    outline: 'none', boxSizing: 'border-box',
                                    fontFamily: "'Nunito', sans-serif",
                                }}
                            />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#1a2535', marginBottom: '0.3rem', letterSpacing: '0.03em' }}>Email *</label>
                            <input
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                onBlur={e => { if (e.target.value.includes('@')) lookupRsvp(e.target.value) }}
                                required
                                style={{
                                    width: '100%', padding: '0.65rem 0.8rem', borderRadius: 10,
                                    border: `1.5px solid ${!email && name ? '#E8896A' : isUpdate ? '#4AADA8' : '#e2e8f0'}`, fontSize: '0.9rem', fontWeight: 600,
                                    outline: 'none', boxSizing: 'border-box',
                                    fontFamily: "'Nunito', sans-serif",
                                }}
                            />
                            {lookingUp && <div style={{ fontSize: '0.7rem', color: '#4AADA8', fontWeight: 700, marginTop: '0.2rem' }}>🔍 Looking up your RSVP...</div>}
                            {isUpdate && !lookingUp && <div style={{ fontSize: '0.7rem', color: '#4AADA8', fontWeight: 700, marginTop: '0.2rem' }}>✅ Welcome back! Your previous RSVP has been loaded.</div>}
                            {!email && name && !isUpdate && <div style={{ fontSize: '0.7rem', color: '#E8896A', fontWeight: 700, marginTop: '0.2rem' }}>Email is required so we can send you event details</div>}
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#1a2535', marginBottom: '0.3rem', letterSpacing: '0.03em' }}>Will You Attend? *</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {[
                                    { val: 'going' as const, label: '✓ Going', emoji: '🎉', color: '#3D8C6E' },
                                    { val: 'maybe' as const, label: '? Maybe', emoji: '🤔', color: '#c4880a' },
                                    { val: 'declined' as const, label: "✗ Can't", emoji: '😢', color: '#E8896A' },
                                ].map(opt => (
                                    <button
                                        key={opt.val}
                                        onClick={() => setResponse(opt.val)}
                                        style={{
                                            flex: 1, padding: '0.7rem 0.3rem', borderRadius: 12,
                                            border: `2px solid ${response === opt.val ? opt.color : '#e2e8f0'}`,
                                            background: response === opt.val ? `${opt.color}10` : '#fff',
                                            cursor: 'pointer', textAlign: 'center',
                                            transition: 'all 0.15s',
                                            fontFamily: "'Nunito', sans-serif",
                                        }}
                                    >
                                        <div style={{ fontSize: '1.3rem', marginBottom: '0.2rem' }}>{opt.emoji}</div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: response === opt.val ? opt.color : '#6b7c93' }}>{opt.label}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#1a2535', marginBottom: '0.3rem', letterSpacing: '0.03em' }}>Your Dietary Needs</label>
                            <select
                                value={dietary}
                                onChange={e => setDietary(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.65rem 0.8rem', borderRadius: 10,
                                    border: '1.5px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 600,
                                    cursor: 'pointer', outline: 'none', boxSizing: 'border-box',
                                    fontFamily: "'Nunito', sans-serif",
                                }}
                            >
                                {DIETARY_OPTIONS.map(d => <option key={d}>{d}</option>)}
                            </select>
                        </div>

                        {/* Additional guests */}
                        <div style={{
                            padding: '1rem',
                            background: '#f8fafc',
                            borderRadius: 12,
                            border: '1.5px solid #e2e8f0',
                            marginBottom: '1rem',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1a2535' }}>👥 Bringing Anyone?</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
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
                                        }} style={{
                                            padding: '0.35rem 0.8rem', borderRadius: 20,
                                            border: `1.5px solid ${isActive ? 'rgba(74,173,168,0.5)' : '#e2e8f0'}`,
                                            background: isActive ? 'rgba(74,173,168,0.1)' : 'white',
                                            color: isActive ? '#4AADA8' : '#6b7c93',
                                            fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
                                            fontFamily: "'Nunito', sans-serif",
                                        }}>+{n}</button>
                                    )
                                })}
                                {additionalGuests.length > 0 && (
                                    <button onClick={() => setAdditionalGuests([])} style={{
                                        padding: '0.35rem 0.6rem', borderRadius: 20,
                                        border: '1.5px solid rgba(232,137,106,0.3)',
                                        background: 'rgba(232,137,106,0.05)',
                                        color: '#E8896A', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer',
                                        fontFamily: "'Nunito', sans-serif",
                                    }}>Clear</button>
                                )}
                            </div>
                            {additionalGuests.map((ag, idx) => (
                                <div key={ag.id} style={{
                                    display: 'flex', gap: '0.4rem', alignItems: 'center',
                                    marginBottom: '0.4rem', padding: '0.4rem', background: '#fff',
                                    borderRadius: 8, border: '1px solid #e2e8f0',
                                }}>
                                    <input
                                        placeholder={`Guest ${idx + 2}`}
                                        value={ag.name === `Guest ${idx + 2}` ? '' : ag.name}
                                        onChange={e => updateAdditionalGuest(ag.id, 'name', e.target.value || `Guest ${idx + 2}`)}
                                        style={{
                                            flex: 1, padding: '0.3rem 0.5rem', borderRadius: 6,
                                            border: '1px solid #e2e8f0', fontSize: '0.78rem', fontWeight: 600,
                                            outline: 'none', fontFamily: "'Nunito', sans-serif",
                                        }}
                                    />
                                    <select
                                        value={ag.dietary}
                                        onChange={e => updateAdditionalGuest(ag.id, 'dietary', e.target.value)}
                                        style={{
                                            padding: '0.3rem 0.3rem', borderRadius: 6,
                                            border: '1px solid #e2e8f0', fontSize: '0.72rem', fontWeight: 600,
                                            fontFamily: "'Nunito', sans-serif",
                                        }}
                                    >
                                        {DIETARY_OPTIONS.map(d => <option key={d}>{d}</option>)}
                                    </select>
                                    <button
                                        onClick={() => setAdditionalGuests(prev => prev.map(g => g.id === ag.id ? { ...g, isChild: !g.isChild } : g))}
                                        style={{
                                            padding: '0.2rem 0.5rem', borderRadius: 12,
                                            border: `1px solid ${ag.isChild ? 'rgba(247,201,72,0.5)' : '#e2e8f0'}`,
                                            background: ag.isChild ? 'rgba(247,201,72,0.12)' : '#fff',
                                            color: ag.isChild ? '#c4880a' : '#9aabbb',
                                            fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer',
                                            fontFamily: "'Nunito', sans-serif",
                                        }}
                                    >
                                        {ag.isChild ? '👶' : '👶?'}
                                    </button>
                                    <button onClick={() => removeAdditionalGuest(ag.id)} style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: '#E8896A', fontWeight: 800, fontSize: '0.85rem',
                                    }}>✕</button>
                                </div>
                            ))}
                            {additionalGuests.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '0.5rem', color: '#9aabbb', fontSize: '0.78rem', fontWeight: 600 }}>
                                    👨‍👩‍👧‍👦 Coming solo? No problem! Or tap +1, +2, +3 above.
                                </div>
                            )}
                        </div>

                        {totalPartySize > 1 && (
                            <div style={{
                                padding: '0.6rem 1rem',
                                background: 'rgba(74,173,168,0.08)',
                                borderRadius: 10,
                                marginBottom: '1rem',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                color: '#1a2535',
                            }}>
                                🎟️ Party size: <strong>{totalPartySize} {totalPartySize === 1 ? 'person' : 'people'}</strong>
                                {(() => {
                                    const kidCount = additionalGuests.filter(ag => ag.isChild).length
                                    if (kidCount > 0) {
                                        const adultCount = totalPartySize - kidCount
                                        return <span style={{ marginLeft: '0.4rem', fontSize: '0.78rem', color: '#c4880a', fontWeight: 700 }}>({adultCount} adult{adultCount !== 1 ? 's' : ''}, {kidCount} kid{kidCount !== 1 ? 's' : ''})</span>
                                    }
                                    return null
                                })()}
                            </div>
                        )}

                        <button
                            onClick={handleSubmit}
                            disabled={!name || !email || !response}
                            style={{
                                width: '100%', padding: '0.85rem',
                                background: !name || !email || !response ? '#ccc' : 'linear-gradient(135deg, #4AADA8, #3D8C6E)',
                                color: '#fff', border: 'none', borderRadius: 12,
                                fontSize: '1rem', fontWeight: 800, cursor: !name || !email || !response ? 'not-allowed' : 'pointer',
                                fontFamily: "'Fredoka One', cursive",
                                transition: 'all 0.2s',
                            }}
                        >
                            {isUpdate ? 'Update My RSVP' : 'Send My RSVP'} {totalPartySize > 1 ? `(${totalPartySize} people)` : ''} 🎊
                        </button>
                    </div>
                ) : (
                    <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                            {response === 'going' ? '🎉' : response === 'maybe' ? '🤞' : '💌'}
                        </div>
                        <h2 style={{
                            fontFamily: "'Fredoka One', cursive",
                            color: '#1a2535',
                            fontSize: '1.3rem',
                            marginBottom: '0.5rem',
                        }}>
                            {response === 'going' ? 'See You There!' : response === 'maybe' ? 'We Hope to See You!' : 'Thanks for Letting Us Know'}
                        </h2>
                        <p style={{ color: '#6b7c93', fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.6 }}>
                            {response === 'going'
                                ? `Thank you ${name}! We're excited to have ${totalPartySize > 1 ? `your party of ${totalPartySize}` : 'you'} at the ${eventName}. Check your email for more details soon.`
                                : response === 'maybe'
                                    ? `Thanks ${name}! We'll save ${totalPartySize > 1 ? `${totalPartySize} spots` : 'a spot'} for you. Let us know when you've decided!`
                                    : `We'll miss you, ${name}! Maybe next time. 💛`
                            }
                        </p>
                        {response === 'going' && totalPartySize > 1 && (
                            <div style={{
                                marginTop: '1rem',
                                padding: '0.8rem',
                                background: '#f8fafc',
                                borderRadius: 12,
                                textAlign: 'left',
                            }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1a2535', marginBottom: '0.4rem' }}>Your Party</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.2rem' }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4AADA8', display: 'inline-block' }} />
                                    {name} {dietary !== 'None' && <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.3rem', borderRadius: 4, background: 'rgba(74,173,168,0.1)', color: '#4AADA8', fontWeight: 700 }}>{dietary}</span>}
                                </div>
                                {additionalGuests.filter(ag => ag.name.trim()).map(ag => (
                                    <div key={ag.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.2rem' }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F7C948', display: 'inline-block' }} />
                                        {ag.name}
                                        {ag.dietary !== 'None' && <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.3rem', borderRadius: 4, background: 'rgba(247,201,72,0.15)', color: '#c4880a', fontWeight: 700 }}>{ag.dietary}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                        {(response === 'going' || response === 'maybe') && eventData.date && (
                            <button
                                onClick={handleAddToCalendar}
                                style={{
                                    marginTop: '1rem',
                                    width: '100%',
                                    padding: '0.75rem',
                                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 12,
                                    fontSize: '0.9rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    fontFamily: "'Fredoka One', cursive",
                                    transition: 'all 0.2s',
                                }}
                            >
                                📅 Add to Calendar
                            </button>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div style={{
                    padding: '0.7rem',
                    textAlign: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#9aabbb',
                    borderTop: '1px solid #f0f0f0',
                }}>
                    Powered by <img src="/logo.png" alt="PartyPal" style={{ height: 14, borderRadius: 3, verticalAlign: 'middle' }} /> PartyPal
                </div>
            </div>
        </div>
    )
}
