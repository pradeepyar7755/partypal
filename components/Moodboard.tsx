'use client'
import { useState } from 'react'
import styles from './ThemeTab.module.css'
import { showToast } from '@/components/Toast'
import { userGetJSON, userSetJSON } from '@/lib/userStorage'
import type { InteractionSignal } from '@/lib/ai-memory'
import type { UserPreferences } from '@/lib/ai-context'

interface PaletteColor { hex: string; name: string; usage: string }
interface MoodTile { emoji: string; title: string; description: string; category: string }

interface MoodboardData {
    title: string
    vibe: string
    palette: PaletteColor[]
    tiles: MoodTile[]
    tablescape: string
    lighting: string
    welcomeSign: string
    partyFavor: string
    hashtag: string
}

interface MoodboardState {
    board: MoodboardData | null
    pinnedTileIndices: number[]
    refinementHistory: string[]
    generatedAt: string
}

interface MoodboardProps {
    eventId: string
    theme: string
    eventType: string
    budget: string
    getContextPayload: () => Record<string, unknown>
    learn: (signal: InteractionSignal) => UserPreferences
    isDemo: boolean
}

const DEMO_MOODBOARD: MoodboardData = {
    title: 'Tropical Paradise Mood Board',
    vibe: 'A lush, vibrant celebration dripping with island energy. Think golden sunsets, swaying palms, and tropical blooms that transport your guests to paradise.',
    palette: [
        { hex: '#F7C948', name: 'Golden Sun', usage: 'tablecloths, balloons' },
        { hex: '#E8896A', name: 'Coral Bliss', usage: 'florals, napkins' },
        { hex: '#4AADA8', name: 'Teal Dream', usage: 'accent pieces, candles' },
        { hex: '#2D4059', name: 'Midnight Navy', usage: 'backdrop, linens' },
        { hex: '#FFFFFF', name: 'Crisp White', usage: 'base, plates, signage' },
    ],
    tiles: [
        { emoji: '🌿', title: 'Lush Greenery', description: 'Cascading eucalyptus and ferns as centerpieces', category: 'florals' },
        { emoji: '🕯️', title: 'Candlelight Magic', description: 'Clusters of pillar and taper candles at varying heights', category: 'lighting' },
        { emoji: '🎂', title: 'Statement Cake', description: '3-tier cake with tropical fondant accents and gold leaf', category: 'food' },
        { emoji: '🎊', title: 'Balloon Installation', description: 'Organic balloon arch in palette colors at entrance', category: 'decor' },
        { emoji: '📸', title: 'Photo Moment', description: 'Tropical leaf wall backdrop with neon sign', category: 'photos' },
        { emoji: '🎵', title: 'Island Beats', description: 'Upbeat reggae and tropical house playlist', category: 'music' },
    ],
    tablescape: 'Rattan charger plates on navy linen runners, gold flatware, small monstera leaf place cards, scattered frangipani blooms',
    lighting: 'String lights draped overhead in a canopy pattern, amber uplighting behind the bar, floating candles in glass cylinders on tables',
    welcomeSign: 'Welcome to Paradise! 🌴 Maya\'s 30th',
    partyFavor: 'Mini bottles of tropical hot sauce with custom labels and a thank-you tag',
    hashtag: '#MayasTropicalThirty',
}

const TILE_BG_COLORS: Record<string, string> = {
    florals: 'rgba(61, 140, 110, 0.08)',
    lighting: 'rgba(247, 201, 72, 0.08)',
    food: 'rgba(232, 137, 106, 0.08)',
    decor: 'rgba(74, 173, 168, 0.08)',
    photos: 'rgba(45, 64, 89, 0.06)',
    music: 'rgba(147, 112, 219, 0.08)',
}

export default function Moodboard({ eventId, theme, eventType, budget, getContextPayload, learn, isDemo }: MoodboardProps) {
    const storageKey = `partypal_moodboard_${eventId}`
    const [state, setState] = useState<MoodboardState>(() => {
        if (isDemo) return { board: DEMO_MOODBOARD, pinnedTileIndices: [0, 3], refinementHistory: [], generatedAt: new Date().toISOString() }
        const saved = userGetJSON<MoodboardState | null>(storageKey, null)
        return saved || { board: null, pinnedTileIndices: [], refinementHistory: [], generatedAt: '' }
    })
    const [loading, setLoading] = useState(false)
    const [refining, setRefining] = useState(false)
    const [refineInput, setRefineInput] = useState('')
    const [copiedColor, setCopiedColor] = useState<string | null>(null)

    const persist = (next: MoodboardState) => {
        setState(next)
        if (!isDemo) userSetJSON(storageKey, next)
    }

    const generate = async () => {
        if (isDemo) return
        setLoading(true)
        try {
            const res = await fetch('/api/moodboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme: theme || 'Modern Elegant', eventType: eventType || 'Party', budget, ...getContextPayload() }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Failed' }))
                showToast(err.error || 'Failed to generate moodboard', 'error')
                setLoading(false)
                return
            }
            const board: MoodboardData = await res.json()
            const next: MoodboardState = { board, pinnedTileIndices: [], refinementHistory: [], generatedAt: new Date().toISOString() }
            persist(next)
            learn({ type: 'moodboard_generated' })
            showToast('Moodboard generated!', 'success')
        } catch {
            showToast('Something went wrong', 'error')
        }
        setLoading(false)
    }

    const refine = async () => {
        if (!refineInput.trim() || !state.board || isDemo) return
        setRefining(true)
        try {
            const pinnedTiles = state.pinnedTileIndices.map(i => state.board!.tiles[i]).filter(Boolean)
            const res = await fetch('/api/moodboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'refine',
                    currentBoard: state.board,
                    pinnedTiles,
                    instruction: refineInput.trim(),
                    theme, eventType, budget,
                    ...getContextPayload(),
                }),
            })
            if (!res.ok) {
                showToast('Failed to refine moodboard', 'error')
                setRefining(false)
                return
            }
            const board: MoodboardData = await res.json()
            const next: MoodboardState = {
                board,
                pinnedTileIndices: state.pinnedTileIndices.filter(i => i < board.tiles.length),
                refinementHistory: [...state.refinementHistory, refineInput.trim()].slice(-10),
                generatedAt: new Date().toISOString(),
            }
            persist(next)
            setRefineInput('')
            learn({ type: 'plan_refined', refinementText: refineInput.trim() })
            showToast('Moodboard updated!', 'success')
        } catch {
            showToast('Something went wrong', 'error')
        }
        setRefining(false)
    }

    const togglePin = (idx: number) => {
        const next = { ...state }
        if (next.pinnedTileIndices.includes(idx)) {
            next.pinnedTileIndices = next.pinnedTileIndices.filter(i => i !== idx)
        } else {
            next.pinnedTileIndices = [...next.pinnedTileIndices, idx]
        }
        persist(next)
    }

    const copyColor = (hex: string) => {
        navigator.clipboard.writeText(hex).catch(() => {})
        setCopiedColor(hex)
        setTimeout(() => setCopiedColor(null), 1500)
        showToast(`Copied ${hex}`, 'success')
    }

    const { board } = state

    if (loading) {
        return (
            <div className={styles.aiLoading}>
                <div className="spinner" />
                Designing your moodboard...
            </div>
        )
    }

    if (!board) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyEmoji}>🎨</div>
                <div className={styles.emptyTitle}>{theme ? `${theme} Theme` : 'Decor Moodboard'}</div>
                <div className={styles.emptyDesc}>Generate an AI-curated moodboard with color palettes, decor inspiration, and styling details for your event.</div>
                <button className={styles.generateBtn} onClick={generate} disabled={isDemo}>
                    ✨ Generate Moodboard
                </button>
            </div>
        )
    }

    return (
        <div>
            {/* Vibe */}
            <div className={styles.vibeText}>{board.vibe}</div>

            {/* Color Palette */}
            <div className={styles.sectionCard}>
                <div className={styles.cardHeader}>
                    <div className={styles.cardTitleGroup}>
                        <span className={styles.cardIcon}>🎨</span>
                        <span className={styles.cardTitle}>Color Palette</span>
                    </div>
                    <span className={styles.aiBadge}>AI CURATED</span>
                </div>
                <div className={styles.paletteRow}>
                    {board.palette.map((c, i) => (
                        <div key={i} className={styles.paletteSwatch} onClick={() => copyColor(c.hex)} title={`Click to copy ${c.hex}`}>
                            <div className={styles.swatchCircle} style={{ background: c.hex }} />
                            <span className={styles.swatchName}>{copiedColor === c.hex ? '✓ Copied' : c.name}</span>
                            <span className={styles.swatchUsage}>{c.usage}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Inspiration Tiles */}
            <div className={styles.sectionCard}>
                <div className={styles.cardHeader}>
                    <div className={styles.cardTitleGroup}>
                        <span className={styles.cardIcon}>💡</span>
                        <span className={styles.cardTitle}>Inspiration</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9aabbb' }}>
                        {state.pinnedTileIndices.length > 0 && `📌 ${state.pinnedTileIndices.length} pinned`}
                    </span>
                </div>
                <div className={styles.tileGrid}>
                    {board.tiles.map((tile, i) => {
                        const isPinned = state.pinnedTileIndices.includes(i)
                        return (
                            <div
                                key={i}
                                className={`${styles.tile} ${isPinned ? styles.tilePinned : ''}`}
                                style={{ background: TILE_BG_COLORS[tile.category] || 'var(--light-bg)' }}
                            >
                                <button
                                    className={`${styles.pinBtn} ${isPinned ? styles.pinBtnActive : ''}`}
                                    onClick={(e) => { e.stopPropagation(); togglePin(i) }}
                                    title={isPinned ? 'Unpin' : 'Pin (keep during refinement)'}
                                >
                                    {isPinned ? '📌' : '📍'}
                                </button>
                                <div>
                                    <div className={styles.tileEmoji}>{tile.emoji}</div>
                                    <div className={styles.tileTitle}>{tile.title}</div>
                                    <div className={styles.tileDesc}>{tile.description}</div>
                                </div>
                                <div className={styles.tileCategoryBadge}>{tile.category}</div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Details */}
            <div className={styles.sectionCard}>
                <div className={styles.cardHeader}>
                    <div className={styles.cardTitleGroup}>
                        <span className={styles.cardIcon}>✨</span>
                        <span className={styles.cardTitle}>Styling Details</span>
                    </div>
                </div>
                <div className={styles.detailGrid}>
                    <div className={styles.detailCard}>
                        <div className={styles.detailLabel}>🍽️ Tablescape</div>
                        <div className={styles.detailText}>{board.tablescape}</div>
                    </div>
                    <div className={styles.detailCard}>
                        <div className={styles.detailLabel}>💡 Lighting</div>
                        <div className={styles.detailText}>{board.lighting}</div>
                    </div>
                    <div className={styles.detailCard}>
                        <div className={styles.detailLabel}>🪧 Welcome Sign</div>
                        <div className={styles.detailText}>{board.welcomeSign}</div>
                    </div>
                    <div className={styles.detailCard}>
                        <div className={styles.detailLabel}>🎁 Party Favor</div>
                        <div className={styles.detailText}>{board.partyFavor}</div>
                    </div>
                </div>
                {board.hashtag && <div className={styles.hashtagBadge}>{board.hashtag}</div>}
            </div>

            {/* Refine */}
            <div className={styles.refineRow}>
                <input
                    className={styles.refineInput}
                    value={refineInput}
                    onChange={e => setRefineInput(e.target.value)}
                    placeholder="Make it more rustic... Add outdoor elements... Use warmer colors..."
                    onKeyDown={e => e.key === 'Enter' && !refining && refine()}
                    disabled={refining || isDemo}
                />
                <button className={styles.refineBtn} onClick={refine} disabled={!refineInput.trim() || refining || isDemo}>
                    {refining ? '...' : '✨ Refine'}
                </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button className={styles.generateBtn} onClick={generate} disabled={isDemo} style={{ fontSize: '0.78rem', padding: '0.5rem 1rem' }}>
                    🔄 Regenerate
                </button>
            </div>
        </div>
    )
}
