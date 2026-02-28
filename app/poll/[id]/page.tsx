'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import styles from './poll.module.css'

interface PollOption {
    id: string
    text: string
    votes: number
    voters: string[]
}

interface Poll {
    id: string
    question: string
    type: string
    allowMultiple: boolean
    options: PollOption[]
    creatorName: string
    createdAt: string
    closed: boolean
    totalVotes: number
    eventContext?: {
        eventType?: string
        date?: string
        location?: string
        theme?: string
    }
    contextHint?: string
}

export default function PollPage() {
    const params = useParams()
    const pollId = params.id as string
    const [poll, setPoll] = useState<Poll | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [voterName, setVoterName] = useState('')
    const [voted, setVoted] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [showNamePrompt, setShowNamePrompt] = useState(false)
    const [pendingOptionId, setPendingOptionId] = useState<string | null>(null)

    const fetchPoll = useCallback(async () => {
        try {
            const res = await fetch(`/api/polls?id=${pollId}`)
            if (!res.ok) throw new Error('Poll not found')
            const data = await res.json()
            setPoll(data)
        } catch {
            setError('Poll not found or has expired')
        }
        setLoading(false)
    }, [pollId])

    useEffect(() => { fetchPoll() }, [fetchPoll])

    // Check if already voted
    useEffect(() => {
        const storedName = localStorage.getItem(`poll_voted_${pollId}`)
        if (storedName) {
            setVoterName(storedName)
            setVoted(true)
        }
    }, [pollId])

    // Auto-refresh results every 15s
    useEffect(() => {
        if (!voted) return
        const iv = setInterval(fetchPoll, 15000)
        return () => clearInterval(iv)
    }, [voted, fetchPoll])

    const handleOptionTap = (optId: string) => {
        if (voted || poll?.closed) return
        // If name already known, vote directly
        const storedName = localStorage.getItem(`poll_voted_${pollId}`) || voterName
        if (storedName.trim()) {
            submitVote(optId, storedName.trim())
        } else {
            setPendingOptionId(optId)
            setShowNamePrompt(true)
        }
    }

    const submitVote = async (optionId: string, name: string) => {
        setSubmitting(true)
        setShowNamePrompt(false)
        try {
            const res = await fetch('/api/polls', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pollId, optionIds: [optionId], voterName: name }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to vote')
            setPoll(data)
            setVoted(true)
            setVoterName(name)
            localStorage.setItem(`poll_voted_${pollId}`, name)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to vote')
        }
        setSubmitting(false)
    }

    const confirmNameAndVote = () => {
        if (!voterName.trim() || !pendingOptionId) return
        submitVote(pendingOptionId, voterName.trim())
    }

    if (loading) {
        return (
            <main className={styles.pollPage}>
                <div className={styles.pollCard}>
                    <div className="spinner" style={{ width: 36, height: 36, margin: '3rem auto' }} />
                    <p style={{ textAlign: 'center', color: '#9aabbb' }}>Loading poll...</p>
                </div>
            </main>
        )
    }

    if (error || !poll) {
        return (
            <main className={styles.pollPage}>
                <div className={styles.pollCard}>
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>😕</div>
                        <h2 style={{ color: 'var(--navy)' }}>{error || 'Poll not found'}</h2>
                        <a href="/" style={{ color: 'var(--teal)', fontWeight: 700, marginTop: '1rem', display: 'inline-block' }}>
                            ← Go to PartyPal
                        </a>
                    </div>
                </div>
            </main>
        )
    }

    const maxVotes = Math.max(...poll.options.map(o => o.votes), 1)
    const totalVotes = poll.totalVotes || 0

    return (
        <main className={styles.pollPage}>
            <div className={styles.pollCard}>
                {/* Header */}
                <div className={styles.pollHeader}>
                    <div className={styles.pollBadge}>🎊 PartyPal Poll</div>

                    {/* Event context banner */}
                    {poll.eventContext?.eventType && (
                        <div style={{
                            padding: '0.35rem 0.8rem', borderRadius: 8, marginBottom: '0.5rem',
                            background: 'rgba(74,173,168,0.06)', border: '1px solid rgba(74,173,168,0.12)',
                            fontSize: '0.72rem', fontWeight: 700, color: 'var(--teal)',
                            display: 'inline-block',
                        }}>
                            🎉 {[poll.eventContext.eventType,
                            poll.eventContext.date && poll.eventContext.date !== 'TBD' ? new Date(poll.eventContext.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null,
                            poll.eventContext.location && poll.eventContext.location !== 'TBD' ? poll.eventContext.location.split(',')[0].trim() : null,
                            ].filter(Boolean).join(' · ')}
                        </div>
                    )}

                    <h1 className={styles.pollQuestion}>{poll.question}</h1>

                    {/* Smart context hint */}
                    {poll.contextHint && (
                        <div style={{
                            fontSize: '0.72rem', fontWeight: 700, color: '#E8896A',
                            background: 'rgba(232,137,106,0.06)', padding: '0.25rem 0.7rem',
                            borderRadius: 6, display: 'inline-block', marginBottom: '0.4rem',
                        }}>
                            {poll.contextHint}
                        </div>
                    )}

                    <p className={styles.pollMeta}>
                        by <strong>{poll.creatorName}</strong> · {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                        {poll.allowMultiple && <span className={styles.multiTag}>Multi-select</span>}
                        {poll.closed && <span className={styles.closedTag}>Closed</span>}
                    </p>
                </div>

                {/* Inline options — tap to vote, results show immediately */}
                <div className={styles.voting}>
                    {poll.options.map((opt, i) => {
                        const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0
                        const barWidth = totalVotes > 0 ? Math.max(2, (opt.votes / maxVotes) * 100) : 0
                        const isLeader = i === 0 && opt.votes > 0 && voted
                        const sortedOpts = voted ? [...poll.options].sort((a, b) => b.votes - a.votes) : poll.options
                        const sortedOpt = voted ? sortedOpts[i] : opt
                        const sortedPct = totalVotes > 0 ? Math.round((sortedOpt.votes / totalVotes) * 100) : 0
                        const sortedBarWidth = totalVotes > 0 ? Math.max(2, (sortedOpt.votes / maxVotes) * 100) : 0
                        const sortedIsLeader = voted && i === 0 && sortedOpt.votes > 0
                        const myVote = voted && sortedOpt.voters.includes(voterName)

                        if (voted) {
                            return (
                                <div key={sortedOpt.id} className={`${styles.optionResult} ${sortedIsLeader ? styles.optionLeader : ''} ${myVote ? styles.optionMyVote : ''}`}>
                                    <div className={styles.optionResultBar} style={{
                                        width: `${sortedBarWidth}%`,
                                        background: sortedIsLeader
                                            ? 'linear-gradient(90deg, rgba(247,201,72,0.18), rgba(232,137,106,0.12))'
                                            : 'rgba(74,173,168,0.08)',
                                    }} />
                                    <div className={styles.optionResultContent}>
                                        <span className={styles.optionResultText}>
                                            {sortedIsLeader && '👑 '}{myVote && '✓ '}{sortedOpt.text}
                                        </span>
                                        <span className={styles.optionResultPct}>{sortedPct}%</span>
                                    </div>
                                    <div className={styles.optionResultMeta}>
                                        <span>{sortedOpt.votes} {sortedOpt.votes === 1 ? 'vote' : 'votes'}</span>
                                        {sortedOpt.voters.length > 0 && (
                                            <div className={styles.voterChips}>
                                                {sortedOpt.voters.slice(0, 8).map((v, vi) => (
                                                    <span key={vi} className={styles.voterChip}>{v}</span>
                                                ))}
                                                {sortedOpt.voters.length > 8 && (
                                                    <span className={styles.voterChip}>+{sortedOpt.voters.length - 8}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        }

                        // Not yet voted — show tappable options
                        return (
                            <button
                                key={opt.id}
                                className={styles.optionTap}
                                onClick={() => handleOptionTap(opt.id)}
                                disabled={submitting}
                            >
                                <span className={styles.optionTapText}>{opt.text}</span>
                                {totalVotes > 0 && (
                                    <span className={styles.optionTapCount}>{opt.votes}</span>
                                )}
                            </button>
                        )
                    })}

                    {voted && (
                        <div className={styles.votedFooter}>
                            <span>You voted as <strong>{voterName}</strong></span>
                            <button className={styles.refreshBtn} onClick={fetchPoll}>🔄 Refresh</button>
                        </div>
                    )}

                    {submitting && (
                        <div style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--teal)', fontSize: '0.82rem', fontWeight: 700 }}>
                            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />
                            Submitting your vote...
                        </div>
                    )}
                </div>

                {/* Name prompt overlay */}
                {showNamePrompt && (
                    <div className={styles.nameOverlay}>
                        <div className={styles.nameModal}>
                            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>👋</div>
                            <div style={{ fontWeight: 800, color: 'var(--navy)', marginBottom: '0.3rem' }}>
                                What&apos;s your name?
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#9aabbb', marginBottom: '0.8rem' }}>
                                So others can see who voted
                            </div>
                            <input
                                type="text"
                                value={voterName}
                                onChange={e => setVoterName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && confirmNameAndVote()}
                                placeholder="Your name..."
                                autoFocus
                                maxLength={30}
                                className={styles.nameModalInput}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => setShowNamePrompt(false)} className={styles.nameModalCancel}>Cancel</button>
                                <button onClick={confirmNameAndVote} disabled={!voterName.trim()} className={styles.nameModalSubmit}>Vote</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className={styles.pollFooter}>
                    <a href="/">🎊 Powered by PartyPal</a>
                </div>
            </div>
        </main>
    )
}
