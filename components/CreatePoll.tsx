'use client'
import { useState } from 'react'
import { showToast } from './Toast'

interface CreatePollProps {
    eventId?: string
    creatorName: string
    onCreated?: (poll: { id: string; shareUrl: string }) => void
    onClose: () => void
}

const PRESET_POLLS = [
    { icon: '📅', label: 'Best date', question: 'Which date works best for you?', placeholder: 'e.g. Saturday March 15, Friday March 21, Sunday March 23' },
    { icon: '📍', label: 'Venue choice', question: "Which venue do you prefer?", placeholder: 'e.g. Rooftop Bar, Community Center, My backyard' },
    { icon: '🎭', label: 'Theme vote', question: "Which party theme sounds best?", placeholder: 'e.g. 80s Retro, Tropical Luau, Black & Gold, Masquerade' },
    { icon: '🍽️', label: 'Food preference', question: "What food should we serve?", placeholder: 'e.g. BBQ, Italian, Mexican, Sushi' },
    { icon: '🎵', label: 'Music style', question: "What music vibe do you want?", placeholder: 'e.g. DJ/Dance, Live band, Chill acoustic, Mixed playlist' },
    { icon: '⏰', label: 'Start time', question: "What time works best?", placeholder: 'e.g. 2:00 PM, 5:00 PM, 7:00 PM' },
]

export default function CreatePoll({ eventId, creatorName, onCreated, onClose }: CreatePollProps) {
    const [question, setQuestion] = useState('')
    const [optionsText, setOptionsText] = useState('')
    const [allowMultiple, setAllowMultiple] = useState(false)
    const [creating, setCreating] = useState(false)

    const usePreset = (preset: typeof PRESET_POLLS[0]) => {
        setQuestion(preset.question)
        setOptionsText(preset.placeholder)
    }

    const createPoll = async () => {
        const options = optionsText
            .split(/[,\n]/)
            .map(o => o.trim())
            .filter(o => o.length > 0)

        if (!question.trim() || options.length < 2) {
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
                    options,
                    eventId,
                    creatorName,
                    allowMultiple,
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
                            🗳️ Create a Poll
                        </h2>
                        <p style={{ fontSize: '0.78rem', color: '#9aabbb', margin: '0.2rem 0 0', fontWeight: 600 }}>
                            Let friends & family vote on your party decisions
                        </p>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', fontSize: '1.4rem',
                        cursor: 'pointer', color: '#9aabbb', padding: '0.3rem',
                    }}>✕</button>
                </div>

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

                    <button onClick={createPoll} disabled={creating} style={{
                        width: '100%', padding: '0.9rem', borderRadius: 14,
                        background: 'linear-gradient(135deg, var(--teal), var(--green))',
                        color: 'white', fontSize: '1rem', fontWeight: 800,
                        fontFamily: "'Fredoka One',cursive", cursor: 'pointer',
                        border: 'none', transition: 'all 0.3s', letterSpacing: '0.02em',
                        opacity: creating ? 0.6 : 1,
                    }}>
                        {creating ? '⏳ Creating...' : '🗳️ Create Poll'}
                    </button>
                </div>
            </div>
        </div>
    )
}
