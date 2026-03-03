'use client'
import { useState, useMemo } from 'react'
import { showToast } from './Toast'

interface EventContext {
    eventType: string
    date?: string
    location?: string
    theme?: string
}

interface CreatePollProps {
    eventId?: string
    creatorName: string
    eventContext?: EventContext
    onCreated?: (poll: { id: string; shareUrl: string }) => void
    onClose: () => void
}

const PRESET_POLLS = [
    { icon: '📅', label: 'Best date', question: 'Which date works best for you?', placeholder: 'e.g. Saturday March 15, Friday March 21, Sunday March 23', field: 'date' as const },
    { icon: '📍', label: 'Venue choice', question: "Which venue do you prefer?", placeholder: 'e.g. Rooftop Bar, Community Center, My backyard', field: 'location' as const },
    { icon: '🎭', label: 'Theme vote', question: "Which party theme sounds best?", placeholder: 'e.g. 80s Retro, Tropical Luau, Black & Gold, Masquerade', field: 'theme' as const },
    { icon: '🍽️', label: 'Food preference', question: "What food should we serve?", placeholder: 'e.g. BBQ, Italian, Mexican, Sushi', field: null },
    { icon: '🎵', label: 'Music style', question: "What music vibe do you want?", placeholder: 'e.g. DJ/Dance, Live band, Chill acoustic, Mixed playlist', field: null },
    { icon: '⏰', label: 'Start time', question: "What time works best?", placeholder: 'e.g. 2:00 PM, 5:00 PM, 7:00 PM', field: null },
]

// Smart context hint based on poll topic
function getContextHint(question: string, ctx?: EventContext): string | null {
    if (!ctx) return null
    const q = question.toLowerCase()
    // Date polls
    if ((q.includes('date') || q.includes('when') || q.includes('day')) && ctx.date && ctx.date !== 'TBD') {
        const d = new Date(ctx.date + 'T12:00:00')
        const formatted = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        return `📅 Planned date: ${formatted}`
    }
    // Venue / location polls
    if ((q.includes('venue') || q.includes('location') || q.includes('where') || q.includes('place')) && ctx.location && ctx.location !== 'TBD') {
        return `📍 Current venue: ${ctx.location}`
    }
    // Theme polls
    if ((q.includes('theme') || q.includes('vibe') || q.includes('style')) && ctx.theme) {
        return `🎭 Current theme: ${ctx.theme}`
    }
    return null
}

// Format the event banner text
function formatEventBanner(ctx?: EventContext): string | null {
    if (!ctx?.eventType) return null
    const parts = [ctx.eventType]
    if (ctx.date && ctx.date !== 'TBD') {
        const d = new Date(ctx.date + 'T12:00:00')
        parts.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    }
    if (ctx.location && ctx.location !== 'TBD') {
        // Show just first part of location (business name)
        const short = ctx.location.split(',')[0].trim()
        if (short.length <= 30) parts.push(short)
    }
    return parts.join(' · ')
}

export default function CreatePoll({ eventId, creatorName, eventContext, onCreated, onClose }: CreatePollProps) {
    const [question, setQuestion] = useState('')
    const [optionsText, setOptionsText] = useState('')
    const [allowMultiple, setAllowMultiple] = useState(false)
    const [creating, setCreating] = useState(false)
    const [showPreview, setShowPreview] = useState(false)

    const usePreset = (preset: typeof PRESET_POLLS[0]) => {
        setQuestion(preset.question)
        setOptionsText(preset.placeholder)
    }

    const parsedOptions = optionsText
        .split(/[,\n]/)
        .map(o => o.trim())
        .filter(o => o.length > 0)

    const isValid = question.trim().length > 0 && parsedOptions.length >= 2

    const contextHint = useMemo(() => getContextHint(question, eventContext), [question, eventContext])
    const eventBanner = useMemo(() => formatEventBanner(eventContext), [eventContext])

    const createPoll = async () => {
        if (!isValid) {
            showToast('Need a question and at least 2 options', 'error')
            return
        }

        setCreating(true)
        try {
            const res = await fetch('/api/polls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: question.trim(),
                    options: parsedOptions,
                    eventId,
                    creatorName,
                    allowMultiple,
                    // Include event context — API will store it
                    eventContext: eventContext ? {
                        eventType: eventContext.eventType,
                        date: (eventContext.date && eventContext.date !== 'TBD') ? eventContext.date : undefined,
                        location: (eventContext.location && eventContext.location !== 'TBD') ? eventContext.location : undefined,
                        theme: eventContext.theme || undefined,
                    } : undefined,
                    contextHint: contextHint || undefined,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            showToast('Poll created! Share the link with your guests.', 'success')
            onCreated?.({ id: data.poll.id, shareUrl: data.shareUrl })
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to create poll', 'error')
        }
        setCreating(false)
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
        }} onClick={onClose}>
            <div style={{
                background: 'white', borderRadius: 20, maxWidth: 520, width: '100%',
                maxHeight: '90vh', overflow: 'auto',
                boxShadow: '0 12px 48px rgba(0,0,0,0.15)',
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem 2rem 1.2rem',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <div>
                        <h2 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1.2rem', color: 'var(--navy)', margin: 0 }}>
                            {showPreview ? '👀 Preview Poll' : '🗳️ Create a Poll'}
                        </h2>
                        <p style={{ fontSize: '0.78rem', color: '#9aabbb', margin: '0.2rem 0 0', fontWeight: 600 }}>
                            {showPreview ? 'This is how your poll will look to voters' : 'Let friends & family vote on your party decisions'}
                        </p>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', fontSize: '1.4rem',
                        cursor: 'pointer', color: '#9aabbb', padding: '0.3rem',
                    }}>✕</button>
                </div>

                {showPreview ? (
                    /* ── PREVIEW MODE ── */
                    <div style={{ padding: '1.2rem 2rem 1.5rem' }}>
                        <div style={{
                            border: '2px solid var(--border)', borderRadius: 16, overflow: 'hidden',
                            background: '#fafbfc',
                        }}>
                            {/* Poll header */}
                            <div style={{ padding: '1.2rem 1.2rem 0.8rem', textAlign: 'center', borderBottom: '1px solid var(--border)', background: 'white' }}>
                                <div style={{
                                    display: 'inline-block', padding: '0.2rem 0.7rem', borderRadius: 16,
                                    background: 'linear-gradient(135deg, rgba(247,201,72,0.15), rgba(74,173,168,0.1))',
                                    border: '1px solid rgba(247,201,72,0.3)',
                                    fontSize: '0.65rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '0.4rem',
                                }}><img src="/logo.png" alt="" style={{ height: 14, width: 'auto', borderRadius: 3, verticalAlign: 'middle' }} /> PartyPal Poll</div>

                                {/* Event context banner */}
                                {eventBanner && (
                                    <div style={{
                                        padding: '0.3rem 0.7rem', borderRadius: 8, marginBottom: '0.5rem',
                                        background: 'rgba(74,173,168,0.06)', border: '1px solid rgba(74,173,168,0.12)',
                                        fontSize: '0.68rem', fontWeight: 700, color: 'var(--teal)',
                                    }}>
                                        🎉 {eventBanner}
                                    </div>
                                )}

                                <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1.1rem', color: 'var(--navy)', margin: '0 0 0.3rem', lineHeight: 1.3 }}>
                                    {question}
                                </h3>

                                {/* Smart context hint */}
                                {contextHint && (
                                    <div style={{
                                        fontSize: '0.7rem', fontWeight: 700, color: '#E8896A',
                                        background: 'rgba(232,137,106,0.06)', padding: '0.2rem 0.6rem',
                                        borderRadius: 6, display: 'inline-block', marginBottom: '0.3rem',
                                    }}>
                                        {contextHint}
                                    </div>
                                )}

                                <div style={{ fontSize: '0.72rem', color: '#9aabbb', fontWeight: 600 }}>
                                    by <strong>{creatorName}</strong> · 0 votes
                                    {allowMultiple && <span style={{ marginLeft: 6, padding: '0.08rem 0.35rem', borderRadius: 4, background: 'rgba(74,173,168,0.1)', color: 'var(--teal)', fontSize: '0.62rem', fontWeight: 800 }}>Multi-select</span>}
                                </div>
                            </div>

                            {/* Options */}
                            <div style={{ padding: '0.8rem 1.2rem 1rem' }}>
                                {parsedOptions.map((opt, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '0.7rem 0.9rem', marginBottom: '0.4rem',
                                        border: '2px solid var(--border)', borderRadius: 12,
                                        background: 'white', cursor: 'default',
                                    }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy)' }}>{opt}</span>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#ccc', background: 'rgba(0,0,0,0.03)', padding: '0.1rem 0.4rem', borderRadius: 8 }}>0</span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ padding: '0.6rem 1.2rem', borderTop: '1px solid var(--border)', background: 'white', textAlign: 'center' }}>
                                <span style={{ fontSize: '0.68rem', color: '#9aabbb', fontWeight: 700 }}><img src="/logo.png" alt="" style={{ height: 10, width: 'auto', borderRadius: 2, verticalAlign: 'middle' }} /> Powered by PartyPal</span>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.2rem' }}>
                            <button onClick={() => setShowPreview(false)} style={{
                                flex: 1, padding: '0.75rem', borderRadius: 12,
                                border: '2px solid var(--border)', background: 'transparent',
                                fontWeight: 800, fontSize: '0.88rem', color: 'var(--navy)',
                                cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                                ← Edit
                            </button>
                            <button onClick={createPoll} disabled={creating} style={{
                                flex: 2, padding: '0.75rem', borderRadius: 12,
                                background: 'linear-gradient(135deg, var(--teal), var(--green))',
                                color: 'white', fontSize: '0.95rem', fontWeight: 800,
                                fontFamily: "'Fredoka One',cursive", cursor: 'pointer',
                                border: 'none', opacity: creating ? 0.6 : 1,
                            }}>
                                {creating ? '⏳ Creating...' : '🚀 Send Poll'}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* ── EDIT MODE ── */
                    <>
                        {/* Event context banner */}
                        {eventBanner && (
                            <div style={{
                                margin: '0.8rem 2rem 0', padding: '0.5rem 0.8rem', borderRadius: 10,
                                background: 'linear-gradient(135deg, rgba(74,173,168,0.06), rgba(247,201,72,0.04))',
                                border: '1px solid rgba(74,173,168,0.15)',
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                            }}>
                                <span style={{ fontSize: '1rem' }}>🎉</span>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--navy)' }}>Creating poll for:</div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--teal)' }}>{eventBanner}</div>
                                </div>
                            </div>
                        )}

                        {/* Presets */}
                        <div style={{ padding: '1rem 2rem 0' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#9aabbb', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Quick templates
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.2rem' }}>
                                {PRESET_POLLS.map((p, i) => (
                                    <button key={i} onClick={() => usePreset(p)} style={{
                                        padding: '0.35rem 0.7rem', borderRadius: 8,
                                        border: '1px solid var(--border)', background: '#fafbfc',
                                        cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
                                        color: 'var(--navy)', fontFamily: 'inherit',
                                        transition: 'all 0.2s',
                                    }}>
                                        {p.icon} {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Form */}
                        <div style={{ padding: '0 2rem 1.5rem' }}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '0.3rem' }}>
                                    Question
                                </label>
                                <input
                                    type="text"
                                    value={question}
                                    onChange={e => setQuestion(e.target.value)}
                                    placeholder="What do you want to decide?"
                                    style={{
                                        width: '100%', padding: '0.7rem 1rem', borderRadius: 12,
                                        border: '2px solid var(--border)', fontSize: '0.9rem',
                                        fontWeight: 600, fontFamily: 'inherit', outline: 'none',
                                        boxSizing: 'border-box', transition: 'border-color 0.2s',
                                    }}
                                    onFocus={e => e.target.style.borderColor = 'var(--teal)'}
                                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                                />
                                {/* Smart context hint */}
                                {contextHint && (
                                    <div style={{
                                        marginTop: '0.35rem', padding: '0.25rem 0.6rem', borderRadius: 6,
                                        background: 'rgba(232,137,106,0.06)', border: '1px solid rgba(232,137,106,0.12)',
                                        fontSize: '0.72rem', fontWeight: 700, color: '#E8896A',
                                    }}>
                                        {contextHint} — this info will show on the poll
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '0.3rem' }}>
                                    Options <span style={{ fontWeight: 600, color: '#9aabbb' }}>(comma or line separated)</span>
                                </label>
                                <textarea
                                    value={optionsText}
                                    onChange={e => setOptionsText(e.target.value)}
                                    placeholder={'Option 1\nOption 2\nOption 3'}
                                    rows={4}
                                    style={{
                                        width: '100%', padding: '0.7rem 1rem', borderRadius: 12,
                                        border: '2px solid var(--border)', fontSize: '0.9rem',
                                        fontWeight: 600, fontFamily: 'inherit', outline: 'none',
                                        resize: 'vertical', boxSizing: 'border-box',
                                        transition: 'border-color 0.2s',
                                    }}
                                    onFocus={e => e.target.style.borderColor = 'var(--teal)'}
                                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                                />
                                {optionsText.trim() && (
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: parsedOptions.length >= 2 ? 'var(--teal)' : '#E8896A', marginTop: '0.3rem' }}>
                                        {parsedOptions.length} option{parsedOptions.length !== 1 ? 's' : ''} detected
                                        {parsedOptions.length < 2 && ' — need at least 2'}
                                    </div>
                                )}
                            </div>

                            <label style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy)',
                                cursor: 'pointer', marginBottom: '1.5rem',
                            }}>
                                <input
                                    type="checkbox"
                                    checked={allowMultiple}
                                    onChange={e => setAllowMultiple(e.target.checked)}
                                    style={{ width: 18, height: 18 }}
                                />
                                Allow voters to select multiple options
                            </label>

                            <div style={{ display: 'flex', gap: '0.6rem' }}>
                                <button
                                    onClick={() => isValid && setShowPreview(true)}
                                    disabled={!isValid}
                                    style={{
                                        flex: 1, padding: '0.75rem', borderRadius: 12,
                                        border: '2px solid var(--border)', background: 'transparent',
                                        fontWeight: 800, fontSize: '0.88rem', color: isValid ? 'var(--navy)' : '#ccc',
                                        cursor: isValid ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    👀 Preview
                                </button>
                                <button onClick={createPoll} disabled={creating || !isValid} style={{
                                    flex: 1.5, padding: '0.75rem', borderRadius: 12,
                                    background: isValid ? 'linear-gradient(135deg, var(--teal), var(--green))' : '#e0e0e0',
                                    color: 'white', fontSize: '0.95rem', fontWeight: 800,
                                    fontFamily: "'Fredoka One',cursive", cursor: isValid ? 'pointer' : 'not-allowed',
                                    border: 'none', transition: 'all 0.3s',
                                    opacity: creating ? 0.6 : 1,
                                }}>
                                    {creating ? '⏳ Creating...' : '🗳️ Create'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
