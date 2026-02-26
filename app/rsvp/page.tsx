'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './rsvp.module.css'

function RSVPContent() {
    const params = useSearchParams()
    const [eventData, setEventData] = useState<{ eventType?: string; date?: string; time?: string; location?: string; theme?: string }>({})
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [response, setResponse] = useState<'going' | 'maybe' | 'declined' | ''>('')
    const [dietary, setDietary] = useState('None')
    const [plusOne, setPlusOne] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    useEffect(() => {
        // In a real app, this would fetch event data from a database
        // For now, read from localStorage or URL params
        const stored = localStorage.getItem('partyplan')
        if (stored) {
            const p = JSON.parse(stored)
            setEventData({
                eventType: params.get('event') || p.eventType || 'Party',
                date: p.date,
                time: p.time,
                location: p.location,
                theme: p.theme,
            })
        } else {
            setEventData({
                eventType: params.get('event') || 'Party',
                date: params.get('date') || '',
                location: params.get('location') || '',
                theme: params.get('theme') || '',
            })
        }
    }, [params])

    const handleSubmit = () => {
        if (!name || !response) return
        // Save RSVP to localStorage (simulated)
        const rsvps = JSON.parse(localStorage.getItem('partypal_rsvps') || '[]')
        rsvps.push({ name, email, response, dietary, plusOne, timestamp: new Date().toISOString() })
        localStorage.setItem('partypal_rsvps', JSON.stringify(rsvps))
        setSubmitted(true)
    }

    const eventEmoji = eventData.eventType?.split(' ')[0] || '🎉'
    const eventName = eventData.eventType?.replace(/^[^\s]+\s/, '') || 'Party'

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
                </div>

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
                            <div className={styles.rsvpLabel}>Dietary Needs</div>
                            <select className={styles.rsvpInput} value={dietary} onChange={e => setDietary(e.target.value)} style={{ cursor: 'pointer' }}>
                                <option>None</option>
                                <option>Vegetarian</option>
                                <option>Vegan</option>
                                <option>Gluten-Free</option>
                                <option>Nut Allergy</option>
                                <option>Kosher</option>
                                <option>Halal</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                            <input type="checkbox" id="plusOne" checked={plusOne} onChange={e => setPlusOne(e.target.checked)} />
                            <label htmlFor="plusOne" style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--navy)', cursor: 'pointer' }}>Bringing a +1</label>
                        </div>
                        <button className={styles.rsvpSubmit} onClick={handleSubmit} disabled={!name || !response}>
                            Send My RSVP 🎊
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
                                ? `Thank you ${name}! We're excited to have you at the ${eventName}. Check your email for more details soon.`
                                : response === 'maybe'
                                    ? `Thanks ${name}! We'll save a spot for you. Let us know when you've decided!`
                                    : `We'll miss you, ${name}! Maybe next time. 💛`
                            }
                        </p>
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
