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
}

export default function PollPage() {
    const params = useParams()
    const pollId = params.id as string
    const [poll, setPoll] = useState<Poll | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [voterName, setVoterName] = useState('')
    const [selected, setSelected] = useState<string[]>([])
    const [voted, setVoted] = useState(false)
    const [submitting, setSubmitting] = useState(false)

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

    const toggleOption = (optId: string) => {
        if (poll?.allowMultiple) {
            setSelected(prev => prev.includes(optId) ? prev.filter(s => s !== optId) : [...prev, optId])
        } else {
            setSelected([optId])
        }
    }

    const submitVote = async () => {
        if (!voterName.trim() || selected.length === 0) return
        setSubmitting(true)
        try {
            const res = await fetch('/api/polls', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pollId, optionIds: selected, voterName: voterName.trim() }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to vote')
            setPoll(data)
            setVoted(true)
            localStorage.setItem(`poll_voted_${pollId}`, voterName.trim())
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to submit vote')
        }
        setSubmitting(false)
    }

    // Check if already voted
    useEffect(() => {
        const storedName = localStorage.getItem(`poll_voted_${pollId}`)
        if (storedName) {
            setVoterName(storedName)
            setVoted(true)
        }
    }, [pollId])

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

    return (
        <main className={styles.pollPage}>
            <div className={styles.pollCard}>
                {/* Header */}
                <div className={styles.pollHeader}>
                    <div className={styles.pollBadge}>
                        🎊 PartyPal Poll
                    </div>
                    <h1 className={styles.pollQuestion}>{poll.question}</h1>
                    <p className={styles.pollMeta}>
                        Created by <strong>{poll.creatorName}</strong> · {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}
                        {poll.allowMultiple && <span className={styles.multiTag}>Select multiple</span>}
                    </p>
                </div>

                {/* Voting or Results */}
                {voted || poll.closed ? (
                    <div className={styles.results}>
                        <h3 className={styles.resultsLabel}>
                            {poll.closed ? '🔒 Poll Closed — Final Results' : '✅ Thanks for voting!'}
                        </h3>
                        {poll.options
                            .sort((a, b) => b.votes - a.votes)
                            .map((opt, i) => {
                                const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0
                                const isWinner = i === 0 && opt.votes > 0
                                return (
                                    <div key={opt.id} className={`${styles.resultRow} ${isWinner ? styles.winner : ''}`}>
                                        <div className={styles.resultInfo}>
                                            <span className={styles.resultText}>
                                                {isWinner && '👑 '}{opt.text}
                                            </span>
                                            <span className={styles.resultCount}>
                                                {opt.votes} {opt.votes === 1 ? 'vote' : 'votes'} · {pct}%
                                            </span>
                                        </div>
                                        <div className={styles.resultBarBg}>
                                            <div
                                                className={styles.resultBarFill}
                                                style={{
                                                    width: `${Math.max(2, (opt.votes / maxVotes) * 100)}%`,
                                                    background: isWinner
                                                        ? 'linear-gradient(90deg, #F7C948, #E8896A)'
                                                        : 'linear-gradient(90deg, #4AADA8, #3D8C6E)',
                                                }}
                                            />
                                        </div>
                                        {opt.voters.length > 0 && (
                                            <div className={styles.voterList}>
                                                {opt.voters.map((v, vi) => (
                                                    <span key={vi} className={styles.voterChip}>{v}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        <button className={styles.refreshBtn} onClick={fetchPoll}>
                            🔄 Refresh Results
                        </button>
                    </div>
                ) : (
                    <div className={styles.voting}>
                        {/* Name input */}
                        <div className={styles.nameInput}>
                            <label>Your name</label>
                            <input
                                type="text"
                                value={voterName}
                                onChange={e => setVoterName(e.target.value)}
                                placeholder="Enter your name..."
                                maxLength={50}
                            />
                        </div>

                        {/* Options */}
                        <div className={styles.optionsList}>
                            {poll.options.map(opt => (
                                <button
                                    key={opt.id}
                                    className={`${styles.optionBtn} ${selected.includes(opt.id) ? styles.optionSelected : ''}`}
                                    onClick={() => toggleOption(opt.id)}
                                >
                                    <div className={styles.optionCheck}>
                                        {selected.includes(opt.id) ? '✓' : ''}
                                    </div>
                                    <span>{opt.text}</span>
                                </button>
                            ))}
                        </div>

                        {/* Submit */}
                        <button
                            className={styles.voteBtn}
                            onClick={submitVote}
                            disabled={submitting || !voterName.trim() || selected.length === 0}
                        >
                            {submitting ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                                    <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                                    Submitting...
                                </span>
                            ) : '🗳️ Submit Vote'}
                        </button>
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
