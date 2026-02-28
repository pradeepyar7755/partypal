'use client'
import { userGet, userSetJSON } from '@/lib/userStorage'
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
    const [vendorActuals, setVendorActuals] = useState<{ category: string; cost: number }[]>([])
    const [isEstimated, setIsEstimated] = useState(false)
    const [editingTotal, setEditingTotal] = useState(false)
    const [totalEditValue, setTotalEditValue] = useState('')

    useEffect(() => {
        const stored = userGet('partyplan')
        if (!stored) { router.push('/'); return }
        const data = JSON.parse(stored)
        setBreakdown(data.plan?.budget?.breakdown || [])
        setTips(data.plan?.tips || [])
        setEventType(data.eventType || '')

        // Check if budget was AI-estimated
        const budgetWasEstimated = data.plan?.budget?.budgetEstimated === true || !data.budget || data.budget === '' || data.budget === 'Flexible'
        setIsEstimated(budgetWasEstimated)

        const budgetStr = data.budget || data.plan?.budget?.total || '$2,000'
        const nums = budgetStr.match(/[\d,]+/g)?.map((n: string) => parseInt(n.replace(/,/g, ''))) || [2000]
        const parsed = nums.length >= 2 ? Math.round((nums[0] + nums[1]) / 2) : (nums[0] || 2000)
        setTotalBudget(parsed)
        // Load vendor actuals
        const eventId = data.eventId
        if (eventId) {
            const vendors: { category: string; costEstimate?: number; confirmed: boolean }[] = JSON.parse(localStorage.getItem(`partypal_vendors_${eventId}`) || '[]')
            const actuals = vendors.filter(v => v.costEstimate).map(v => ({ category: v.category, cost: v.costEstimate || 0 }))
            setVendorActuals(actuals)
        }
    }, [router])

    const setCustomBudget = () => {
        const newTotal = parseInt(totalEditValue) || totalBudget
        setTotalBudget(newTotal)
        setIsEstimated(false)
        setEditingTotal(false)
        // Recalculate percentages and save
        const updated = breakdown.map(b => ({
            ...b,
            percentage: Math.round((b.amount / newTotal) * 100),
        }))
        setBreakdown(updated)
        const stored = userGet('partyplan')
        if (stored) {
            const data = JSON.parse(stored)
            data.budget = `$${newTotal.toLocaleString()}`
            if (data.plan?.budget) {
                data.plan.budget.total = `$${newTotal.toLocaleString()}`
                data.plan.budget.breakdown = updated
                data.plan.budget.budgetEstimated = false
            }
            userSetJSON('partyplan', data)
        }
        showToast(`Budget set to $${newTotal.toLocaleString()}`, 'success')
    }

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
        const stored = userGet('partyplan')
        if (stored) {
            const data = JSON.parse(stored)
            data.plan.budget.breakdown = updated
            userSetJSON('partyplan', data)
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
        const stored = userGet('partyplan')
        if (stored) {
            const data = JSON.parse(stored)
            data.plan.budget.breakdown = updated
            userSetJSON('partyplan', data)
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

            {/* AI Budget Estimation Banner */}
            {isEstimated && (
                <div style={{
                    maxWidth: 900, margin: '0 auto 1.5rem', padding: '1rem 1.5rem',
                    background: 'linear-gradient(135deg, rgba(247,201,72,0.12), rgba(74,173,168,0.08))',
                    border: '1px solid rgba(247,201,72,0.3)', borderRadius: 14,
                    display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
                }}>
                    <div style={{ fontSize: '1.8rem' }}>🤖</div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontFamily: "'Fredoka One',cursive", fontSize: '0.92rem', color: 'var(--navy)', marginBottom: 2 }}>
                            AI-Suggested Budget: ${totalBudget.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#6b7c8a', lineHeight: 1.4 }}>
                            Based on your {eventType || 'event'} details, we estimated this budget. You can adjust it anytime.
                        </div>
                    </div>
                    {editingTotal ? (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, color: 'var(--navy)' }}>$</span>
                            <input
                                type="number"
                                value={totalEditValue}
                                onChange={e => setTotalEditValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') setCustomBudget(); if (e.key === 'Escape') setEditingTotal(false) }}
                                autoFocus
                                placeholder={totalBudget.toString()}
                                style={{
                                    width: 100, padding: '0.4rem 0.6rem', borderRadius: 8,
                                    border: '2px solid var(--teal)', fontWeight: 700, fontSize: '0.9rem',
                                    fontFamily: 'inherit', outline: 'none',
                                }}
                            />
                            <button
                                onClick={setCustomBudget}
                                style={{
                                    padding: '0.4rem 0.8rem', borderRadius: 8, fontWeight: 700,
                                    background: 'var(--teal)', color: 'white', border: 'none',
                                    cursor: 'pointer', fontSize: '0.8rem',
                                }}
                            >Save</button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => { setEditingTotal(true); setTotalEditValue(totalBudget.toString()) }}
                                style={{
                                    padding: '0.5rem 1rem', borderRadius: 10, fontWeight: 700,
                                    background: 'var(--navy)', color: 'white', border: 'none',
                                    cursor: 'pointer', fontSize: '0.8rem',
                                }}
                            >✏️ Set My Budget</button>
                            <button
                                onClick={() => { setIsEstimated(false); showToast('Budget accepted!', 'success') }}
                                style={{
                                    padding: '0.5rem 1rem', borderRadius: 10, fontWeight: 700,
                                    background: 'transparent', color: 'var(--teal)', border: '2px solid var(--teal)',
                                    cursor: 'pointer', fontSize: '0.8rem',
                                }}
                            >✅ Looks Good</button>
                        </div>
                    )}
                </div>
            )}

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

                        {/* Actuals vs Budget */}
                        <div className={`card ${styles.statusCard}`} style={{ marginTop: '1rem' }}>
                            <h3 style={{ fontFamily: "'Fredoka One',cursive", fontSize: '0.95rem', color: 'var(--navy)', marginBottom: '0.8rem' }}>📊 Actuals vs. Budget</h3>
                            {breakdown.map((b, i) => {
                                const actual = vendorActuals.filter(v => v.category.toLowerCase().includes(b.category.toLowerCase().split(' ')[0]) || b.category.toLowerCase().includes(v.category.toLowerCase().split(' ')[0])).reduce((s, v) => s + v.cost, 0)
                                const pctUsed = b.amount > 0 ? Math.round((actual / b.amount) * 100) : 0
                                return (
                                    <div key={i} style={{ marginBottom: '0.6rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                            <span style={{ color: 'var(--navy)' }}>{b.category}</span>
                                            <span style={{ color: actual > b.amount ? 'var(--coral)' : 'var(--teal)' }}>${actual.toLocaleString()} / ${b.amount.toLocaleString()}</span>
                                        </div>
                                        <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, pctUsed)}%`, background: actual > b.amount ? 'var(--coral)' : pctUsed >= 80 ? '#c4880a' : b.color, transition: 'width 0.4s ease' }} />
                                        </div>
                                    </div>
                                )
                            })}
                            {vendorActuals.length === 0 && (
                                <p style={{ fontSize: '0.78rem', color: '#9aabbb', fontWeight: 600, textAlign: 'center', padding: '0.5rem 0' }}>No vendor costs recorded yet. Add costs in the Vendors tab.</p>
                            )}
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
        </main >
    )
}
