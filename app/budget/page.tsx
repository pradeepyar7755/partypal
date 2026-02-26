'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './budget.module.css'
import { showToast } from '@/components/Toast'

interface BudgetItem { category: string; amount: number; percentage: number; color: string }

export default function Budget() {
    const router = useRouter()
    const [breakdown, setBreakdown] = useState<BudgetItem[]>([])
    const [totalBudget, setTotalBudget] = useState(2000)
    const [editingIdx, setEditingIdx] = useState<number | null>(null)
    const [editValue, setEditValue] = useState('')
    const [tips, setTips] = useState<string[]>([])
    const [eventType, setEventType] = useState('')

    useEffect(() => {
        const stored = localStorage.getItem('partyplan')
        if (!stored) { router.push('/'); return }
        const data = JSON.parse(stored)
        setBreakdown(data.plan?.budget?.breakdown || [])
        setTips(data.plan?.tips || [])
        setEventType(data.eventType || '')
        const parsed = parseInt(data.budget?.replace(/[^0-9]/g, '') || '2000')
        setTotalBudget(parsed || 2000)
    }, [router])

    const allocated = breakdown.reduce((s, b) => s + b.amount, 0)
    const pct = Math.min(100, Math.round((allocated / totalBudget) * 100))
    const remaining = totalBudget - allocated
    const isOver = remaining < 0

    const startEdit = (idx: number) => {
        setEditingIdx(idx)
        setEditValue(breakdown[idx].amount.toString())
    }

    const saveEdit = (idx: number) => {
        const val = parseInt(editValue) || 0
        const updated = breakdown.map((b, i) => {
            if (i !== idx) return b
            const newPct = Math.round((val / totalBudget) * 100)
            return { ...b, amount: val, percentage: newPct }
        })
        setBreakdown(updated)
        setEditingIdx(null)

        // Save back to localStorage
        const stored = localStorage.getItem('partyplan')
        if (stored) {
            const data = JSON.parse(stored)
            data.plan.budget.breakdown = updated
            localStorage.setItem('partyplan', JSON.stringify(data))
        }
        showToast(`${breakdown[idx].category} updated to $${val}`, 'success')
    }

    const addCategory = () => {
        const name = prompt('Category name:')
        if (!name) return
        const amtStr = prompt('Amount ($):')
        const amt = parseInt(amtStr || '0') || 0
        const colors = ['#E8896A', '#4AADA8', '#F7C948', '#7B5EA7', '#3D8C6E', '#C4A882', '#2D4059']
        const newItem: BudgetItem = {
            category: name,
            amount: amt,
            percentage: Math.round((amt / totalBudget) * 100),
            color: colors[breakdown.length % colors.length],
        }
        const updated = [...breakdown, newItem]
        setBreakdown(updated)
        const stored = localStorage.getItem('partyplan')
        if (stored) {
            const data = JSON.parse(stored)
            data.plan.budget.breakdown = updated
            localStorage.setItem('partyplan', JSON.stringify(data))
        }
        showToast(`Added ${name} to budget`, 'success')
    }

    // SVG Donut chart
    const radius = 90
    const circumference = 2 * Math.PI * radius
    let cumulativeOffset = 0

    return (
        <main className="page-enter">
            <header className={styles.budgetHeader}>
                <div className={styles.budgetHeaderInner}>
                    <button className="back-btn" onClick={() => router.back()}>← Back</button>
                    <div className="breadcrumb">
                        <a href="/">Home</a> › {eventType && <><a href="/results">{eventType}</a> › </>}<span className="breadcrumb current">Budget</span>
                    </div>
                    <h1 className={styles.budgetTitle}>💰 Budget Tracker</h1>
                    <p className={styles.budgetSub}>Track and manage your party spending across all categories</p>
                </div>
            </header>

            <div className={styles.budgetContent}>
                <div className={styles.budgetGrid}>
                    {/* Main Column */}
                    <div>
                        {/* Donut Chart */}
                        <div className="card" style={{ marginBottom: '1.5rem' }}>
                            <div className={styles.donutWrap}>
                                <div className={styles.donutContainer}>
                                    <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                        <circle cx="100" cy="100" r={radius} fill="none" stroke="var(--border)" strokeWidth="16" />
                                        {breakdown.map((item, i) => {
                                            const segmentPct = (item.amount / (allocated || 1))
                                            const segmentLen = segmentPct * circumference
                                            const offset = cumulativeOffset
                                            cumulativeOffset += segmentLen
                                            return (
                                                <circle
                                                    key={i}
                                                    cx="100"
                                                    cy="100"
                                                    r={radius}
                                                    fill="none"
                                                    stroke={item.color}
                                                    strokeWidth="16"
                                                    strokeDasharray={`${segmentLen} ${circumference - segmentLen}`}
                                                    strokeDashoffset={-offset}
                                                    strokeLinecap="round"
                                                    style={{ transition: 'all 0.6s ease' }}
                                                />
                                            )
                                        })}
                                    </svg>
                                    <div className={styles.donutCenter}>
                                        <div className={styles.donutTotal}>${allocated.toLocaleString()}</div>
                                        <div className={styles.donutLabel}>of ${totalBudget.toLocaleString()}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Budget Items */}
                        <div className={styles.budgetItemList}>
                            {breakdown.map((item, i) => (
                                <div key={i} className={styles.budgetItem} onClick={() => startEdit(i)}>
                                    <div className={styles.budgetDot} style={{ background: item.color }} />
                                    <span className={styles.budgetCat}>{item.category}</span>
                                    {editingIdx === i ? (
                                        <input
                                            className={styles.budgetInput}
                                            value={editValue}
                                            onChange={e => setEditValue(e.target.value)}
                                            onBlur={() => saveEdit(i)}
                                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(i); if (e.key === 'Escape') setEditingIdx(null) }}
                                            autoFocus
                                            onClick={e => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className={styles.budgetAmt}>${item.amount.toLocaleString()}</span>
                                    )}
                                    <span className={styles.budgetPct}>{item.percentage}%</span>
                                </div>
                            ))}
                            <button className={styles.addCatBtn} onClick={addCategory}>+ Add Category</button>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className={styles.sidebar}>
                        {/* Status Card */}
                        <div className={`card ${styles.statusCard}`}>
                            <div className={styles.statusIcon}>{isOver ? '⚠️' : pct >= 80 ? '🔶' : '✅'}</div>
                            <div className={styles.statusTitle} style={{ color: isOver ? 'var(--coral)' : pct >= 80 ? '#c4880a' : 'var(--green)' }}>
                                {isOver ? 'Over Budget!' : pct >= 80 ? 'Getting Close' : 'On Track'}
                            </div>
                            <p className={styles.statusMsg}>
                                {isOver
                                    ? `You're $${Math.abs(remaining).toLocaleString()} over your ${totalBudget.toLocaleString()} budget. Consider adjusting categories.`
                                    : `You have $${remaining.toLocaleString()} remaining in your budget. ${pct >= 80 ? 'Watch your spending!' : 'Looking great!'}`
                                }
                            </p>
                            <div className={styles.progressBar}>
                                <div
                                    className={styles.progressFill}
                                    style={{
                                        width: `${Math.min(100, pct)}%`,
                                        background: isOver ? 'var(--coral)' : pct >= 80 ? '#c4880a' : 'linear-gradient(90deg, var(--teal), var(--yellow))',
                                    }}
                                />
                            </div>
                            <div className={styles.progressLabel}>
                                <span>{pct}% used</span>
                                <span>${remaining.toLocaleString()} left</span>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="card">
                            <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1rem', color: 'var(--navy)', marginBottom: '1rem' }}>⚡ Quick Actions</h3>
                            <button className={styles.addCatBtn} style={{ marginBottom: '0.5rem' }} onClick={() => router.push('/vendors')}>🛍️ Browse Vendors</button>
                            <button className={styles.addCatBtn} style={{ marginBottom: '0.5rem' }} onClick={() => router.push('/results')}>📋 View Party Plan</button>
                            <button className={styles.addCatBtn} onClick={() => router.push('/dashboard')}>📊 Go to Dashboard</button>
                        </div>

                        {/* Tips */}
                        {tips.length > 0 && (
                            <div className={`card ${styles.tipCard}`}>
                                <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '1rem', color: 'var(--navy)', marginBottom: '1rem' }}>💡 Budget Tips</h3>
                                {tips.slice(0, 3).map((tip, i) => (
                                    <div key={i} className={styles.tipItem}>
                                        <span className={styles.tipNum}>{i + 1}</span>
                                        <span className={styles.tipText}>{tip}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    )
}
