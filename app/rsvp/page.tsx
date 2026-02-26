'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './rsvp.module.css'

interface AdditionalGuest {
    id: string; name: string; dietary: string; relationship: string
}

const DIETARY_OPTIONS = ['None', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Nut Allergy', 'Kosher', 'Halal', 'Dairy-Free', 'Shellfish Allergy']
const RELATIONSHIP_OPTIONS = ['Partner', 'Spouse', 'Child', 'Family', 'Friend', 'Other']

function RSVPContent() {
    const params = useSearchParams()
    const [eventData, setEventData] = useState<{ eventType?: string; date?: string; time?: string; location?: string; theme?: string; eventId?: string; inviteSubject?: string; inviteMessage?: string }>({})
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [response, setResponse] = useState<'going' | 'maybe' | 'declined' | ''>('')
    const [dietary, setDietary] = useState('None')
    const [additionalGuests, setAdditionalGuests] = useState<AdditionalGuest[]>([])
    const [submitted, setSubmitted] = useState(false)

    useEffect(() => {
        const eventId = params.get('e') || undefined
        const eventType = params.get('n') || params.get('event') || undefined
        const date = params.get('d') || params.get('date') || undefined
        const location = params.get('l') || params.get('location') || undefined
        const theme = params.get('t') || params.get('theme') || undefined

        // Try Firestore first (for guests who don't have localStorage)
        if (eventId) {
            fetch(`/api/events/${eventId}`)
                .then(res => res.json())
                .then(data => {
                    if (data && !data.error) {
                        setEventData({
                            eventId,
                            eventType: data.eventType || eventType || 'Party',
                            date: data.date || date || '',
                            time: data.time,
                            location: data.location || location || '',
                            theme: data.theme || theme || '',
                            inviteSubject: data.invite?.subject,
                            inviteMessage: data.invite?.message,
                        })
                        return
                    }
                })
                .catch(() => { })
        }

        // Fallback: localStorage then URL params
        const stored = localStorage.getItem('partyplan')
        if (stored) {
            const p = JSON.parse(stored)
            setEventData({
                eventId,
                eventType: eventType || p.eventType || 'Party',
                date: date || p.date,
                time: p.time,
                location: location || p.location,
                theme: theme || p.theme,
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
            relationship: 'Partner'
        }])
    }

    const updateAdditionalGuest = (id: string, field: string, value: string) => {
        setAdditionalGuests(prev => prev.map(ag => ag.id === id ? { ...ag, [field]: value } : ag))
    }

    const removeAdditionalGuest = (id: string) => {
        setAdditionalGuests(prev => prev.filter(ag => ag.id !== id))
    }

    const handleSubmit = () => {
        if (!name || !response) return
        const validAdditional = additionalGuests.filter(ag => ag.name.trim())
        // Save to localStorage
        const rsvps = JSON.parse(localStorage.getItem('partypal_rsvps') || '[]')
        rsvps.push({
            name, email, response, dietary,
            eventId: eventData.eventId,
            additionalGuests: validAdditional,
            totalPartySize: 1 + validAdditional.length,
            timestamp: new Date().toISOString()
        })
        localStorage.setItem('partypal_rsvps', JSON.stringify(rsvps))
        // Save to Firestore
        if (eventData.eventId) {
            fetch(`/api/events/${eventData.eventId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, response, dietary, additionalGuests: validAdditional, totalPartySize: 1 + validAdditional.length }),
            }).catch(() => { })
        }
        setSubmitted(true)
    }

    const eventEmoji = eventData.eventType?.split(' ')[0] || '🎉'
    const eventName = eventData.eventType?.replace(/^[^\s]+\s/, '') || 'Party'
    const totalPartySize = 1 + additionalGuests.length

    return (
        <div className={styles.rsvpPage}>
            <div className={styles.rsvpCard}>
                <div className={styles.rsvpHeader}>
                    <span className={styles.rsvpEmoji}>{eventEmoji}</span>
                    <h1 className={styles.rsvpEventName}>{eventName}</h1>
                    <p className={styles.rsvpDetails}>
                        {eventData.date && `${new Date(eventData.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · `}
                        {eventData.location || 'Location TBD'}
                        {eventData.theme && ` · ${eventData.theme} Theme`}
                    </p>
                    {eventData.eventId && <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.3rem' }}>Event ID: {eventData.eventId}</p>}
                </div>

                {/* Show invite message if present */}
                {eventData.inviteMessage && (
                    <div style={{ padding: '1rem 1.5rem', background: 'rgba(247,201,72,0.08)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        {eventData.inviteSubject && <div style={{ fontFamily: "'Fredoka One', cursive", fontSize: '0.9rem', color: 'var(--navy)', marginBottom: '0.4rem' }}>{eventData.inviteSubject}</div>}
                        <p style={{ fontSize: '0.82rem', color: '#6b7c93', lineHeight: 1.5, fontWeight: 600 }}>{eventData.inviteMessage}</p>
                    </div>
                )}

                {!submitted ? (
                    <div className={styles.rsvpBody}>
                        <div>
                            <div className={styles.rsvpLabel}>Your Name *</div>
                            <input className={styles.rsvpInput} placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div>
                            <div className={styles.rsvpLabel}>Email</div>
                            <input className={styles.rsvpInput} type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
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
                                    <div className={styles.additionalSubtitle}>Add family members, a partner, or friends</div>
                                </div>
                                <button type="button" className={styles.addGuestBtn} onClick={addAdditionalGuest}>+ Add Person</button>
                            </div>

                            {additionalGuests.map((ag, idx) => (
                                <div key={ag.id} className={styles.additionalCard}>
                                    <div className={styles.additionalCardHeader}>
                                        <span className={styles.additionalCardNum}>Guest {idx + 2}</span>
                                        <button className={styles.additionalRemove} onClick={() => removeAdditionalGuest(ag.id)} title="Remove">✕</button>
                                    </div>
                                    <div className={styles.additionalCardBody}>
                                        <div className={styles.additionalField}>
                                            <label className={styles.additionalFieldLabel}>Name *</label>
                                            <input
                                                className={styles.additionalInput}
                                                placeholder="Full name"
                                                value={ag.name}
                                                onChange={e => updateAdditionalGuest(ag.id, 'name', e.target.value)}
                                            />
                                        </div>
                                        <div className={styles.additionalFieldRow}>
                                            <div className={styles.additionalField}>
                                                <label className={styles.additionalFieldLabel}>Relationship</label>
                                                <select
                                                    className={styles.additionalInput}
                                                    value={ag.relationship}
                                                    onChange={e => updateAdditionalGuest(ag.id, 'relationship', e.target.value)}
                                                >
                                                    {RELATIONSHIP_OPTIONS.map(r => <option key={r}>{r}</option>)}
                                                </select>
                                            </div>
                                            <div className={styles.additionalField}>
                                                <label className={styles.additionalFieldLabel}>Dietary Needs</label>
                                                <select
                                                    className={styles.additionalInput}
                                                    value={ag.dietary}
                                                    onChange={e => updateAdditionalGuest(ag.id, 'dietary', e.target.value)}
                                                >
                                                    {DIETARY_OPTIONS.map(d => <option key={d}>{d}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {additionalGuests.length === 0 && (
                                <div className={styles.additionalEmpty}>
                                    <span style={{ fontSize: '1.5rem' }}>👨‍👩‍👧‍👦</span>
                                    <span>Coming solo? No problem! Or add your crew above.</span>
                                </div>
                            )}
                        </div>

                        {totalPartySize > 1 && (
                            <div className={styles.partySummary}>
                                🎟️ Party size: <strong>{totalPartySize} {totalPartySize === 1 ? 'person' : 'people'}</strong>
                            </div>
                        )}

                        <button className={styles.rsvpSubmit} onClick={handleSubmit} disabled={!name || !response}>
                            Send My RSVP {totalPartySize > 1 ? `(${totalPartySize} people)` : ''} 🎊
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
                                        <span className={styles.successRelationship}>{ag.relationship}</span>
                                        {ag.dietary !== 'None' && <span className={styles.successDietary}>{ag.dietary}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className={styles.rsvpPowered}>Powered by 🎊 PartyPal</div>
            </div>
        </div>
    )
}

export default function RSVPPage() {
    return (
        <Suspense fallback={<div className={styles.rsvpPage}><div className="spinner" /></div>}>
            <RSVPContent />
        </Suspense>
    )
}
