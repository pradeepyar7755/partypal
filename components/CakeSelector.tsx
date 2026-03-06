'use client'
import { useState } from 'react'
import styles from './ThemeTab.module.css'
import { showToast } from '@/components/Toast'
import { userGetJSON, userSetJSON } from '@/lib/userStorage'
import type { InteractionSignal } from '@/lib/ai-memory'
import type { UserPreferences } from '@/lib/ai-context'

interface CakeConcept {
    id: string
    name: string
    style: string
    tiers: number
    servings: string
    flavors: string[]
    decorationStyle: string
    dietaryNotes: string
    estimatedPrice: string
    emoji: string
    colorAccents: string[]
    description: string
}

interface CakeSelectorState {
    concepts: CakeConcept[]
    selectedConceptId: string | null
    refinementHistory: string[]
    generatedAt: string
}

interface CakeSelectorProps {
    eventId: string
    theme: string
    eventType: string
    guests: string
    budget: string
    getContextPayload: () => Record<string, unknown>
    learn: (signal: InteractionSignal) => UserPreferences
    isDemo: boolean
}

const DEMO_CAKES: CakeConcept[] = [
    {
        id: 'demo_cake_1', name: 'Tropical Cascade', style: 'Buttercream with tropical fondant accents',
        tiers: 3, servings: '40-50', flavors: ['Coconut Cream', 'Passion Fruit', 'Madagascar Vanilla'],
        decorationStyle: 'Hand-painted tropical leaves with edible gold leaf', dietaryNotes: 'Can be made GF with almond flour (+$25)',
        estimatedPrice: '$180-$250', emoji: '🌺', colorAccents: ['#F7C948', '#4AADA8', '#E8896A'],
        description: 'A showstopping three-tier cake cascading with tropical blooms and golden shimmer.',
    },
    {
        id: 'demo_cake_2', name: 'Island Sunset', style: 'Ombre buttercream with fresh fruit',
        tiers: 2, servings: '35-45', flavors: ['Mango', 'Lime Zest', 'White Chocolate'],
        decorationStyle: 'Sunset ombre in coral-to-gold with fresh tropical fruit garland', dietaryNotes: 'Nut-free option available',
        estimatedPrice: '$150-$200', emoji: '🌅', colorAccents: ['#E8896A', '#F7C948', '#ff6b6b'],
        description: 'A warm ombre cake that captures the colors of a tropical sunset, crowned with fresh mango and starfruit.',
    },
    {
        id: 'demo_cake_3', name: 'Minimalist Palm', style: 'Smooth white fondant with botanical detail',
        tiers: 2, servings: '30-40', flavors: ['Lemon Elderflower', 'Vanilla Bean', 'Coconut'],
        decorationStyle: 'Clean white fondant, single palm frond in sugar paste, gold geometric topper', dietaryNotes: 'Vegan option +$30',
        estimatedPrice: '$200-$280', emoji: '🌴', colorAccents: ['#2D4059', '#4AADA8', '#ffffff'],
        description: 'Sleek and sophisticated — a modern take on tropical with clean lines and a single statement palm.',
    },
    {
        id: 'demo_cake_4', name: 'Tiki Party', style: 'Naked cake with tropical drip',
        tiers: 2, servings: '35-45', flavors: ['Pineapple Upside Down', 'Rum Caramel', 'Banana'],
        decorationStyle: 'Semi-naked with gold caramel drip, mini tiki umbrella toppers, edible hibiscus', dietaryNotes: 'Contains rum — non-alcoholic version available',
        estimatedPrice: '$120-$170', emoji: '🍹', colorAccents: ['#F7C948', '#E8896A', '#3D8C6E'],
        description: 'Fun, playful, and full of personality — a party cake that doubles as a conversation piece.',
    },
    {
        id: 'demo_cake_5', name: 'Floral Luxe', style: 'Buttercream with cascading sugar flowers',
        tiers: 3, servings: '50-60', flavors: ['Rose Water', 'Pistachio', 'Dark Chocolate Ganache'],
        decorationStyle: 'Cascading sugar orchids and plumeria in palette colors, gold leaf accents', dietaryNotes: 'Contains nuts (pistachio) — can substitute',
        estimatedPrice: '$280-$380', emoji: '🌸', colorAccents: ['#E8896A', '#4AADA8', '#F7C948'],
        description: 'The ultimate statement cake — three tiers of luxury with handcrafted sugar flowers cascading elegantly.',
    },
]

export default function CakeSelector({ eventId, theme, eventType, guests, budget, getContextPayload, learn, isDemo }: CakeSelectorProps) {
    const storageKey = `partypal_cake_${eventId}`
    const [state, setState] = useState<CakeSelectorState>(() => {
        if (isDemo) return { concepts: DEMO_CAKES, selectedConceptId: 'demo_cake_1', refinementHistory: [], generatedAt: new Date().toISOString() }
        const saved = userGetJSON<CakeSelectorState | null>(storageKey, null)
        return saved || { concepts: [], selectedConceptId: null, refinementHistory: [], generatedAt: '' }
    })
    const [loading, setLoading] = useState(false)
    const [refining, setRefining] = useState(false)
    const [refineInput, setRefineInput] = useState('')

    const contextPayload = getContextPayload()
    const dietarySummary = (contextPayload.guestContext as { dietarySummary?: string } | undefined)?.dietarySummary || ''
    const hasDietaryNeeds = dietarySummary && dietarySummary !== 'No special requirements tracked'

    const persist = (next: CakeSelectorState) => {
        setState(next)
        if (!isDemo) userSetJSON(storageKey, next)
    }

    const generate = async () => {
        if (isDemo) return
        setLoading(true)
        try {
            const res = await fetch('/api/theme/cake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme, eventType, guests, budget, ...getContextPayload() }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Failed' }))
                showToast(err.error || 'Failed to generate cake concepts', 'error')
                setLoading(false)
                return
            }
            const { concepts } = await res.json()
            const next: CakeSelectorState = { concepts, selectedConceptId: null, refinementHistory: [], generatedAt: new Date().toISOString() }
            persist(next)
            learn({ type: 'theme_selected', refinementText: theme })
            showToast('Cake concepts ready!', 'success')
        } catch {
            showToast('Something went wrong', 'error')
        }
        setLoading(false)
    }

    const refine = async () => {
        if (!refineInput.trim() || state.concepts.length === 0 || isDemo) return
        setRefining(true)
        try {
            const res = await fetch('/api/theme/cake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'refine', currentConcepts: state.concepts, instruction: refineInput.trim(), theme, eventType, guests, budget, ...getContextPayload() }),
            })
            if (!res.ok) {
                showToast('Failed to refine cake concepts', 'error')
                setRefining(false)
                return
            }
            const { concepts } = await res.json()
            const next: CakeSelectorState = {
                ...state,
                concepts,
                refinementHistory: [...state.refinementHistory, refineInput.trim()].slice(-10),
                generatedAt: new Date().toISOString(),
            }
            persist(next)
            setRefineInput('')
            learn({ type: 'plan_refined', refinementText: refineInput.trim() })
            showToast('Cake concepts updated!', 'success')
        } catch {
            showToast('Something went wrong', 'error')
        }
        setRefining(false)
    }

    const selectConcept = (id: string) => {
        persist({ ...state, selectedConceptId: state.selectedConceptId === id ? null : id })
    }

    if (loading) {
        return (
            <div className={styles.aiLoading}>
                <div className="spinner" />
                Designing cake concepts...
            </div>
        )
    }

    if (state.concepts.length === 0) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyEmoji}>🎂</div>
                <div className={styles.emptyTitle}>Cake Designer</div>
                <div className={styles.emptyDesc}>Generate AI-curated cake concepts that match your theme, guest count, and dietary needs.</div>
                <button className={styles.generateBtn} onClick={generate} disabled={isDemo}>
                    ✨ Suggest Cakes
                </button>
            </div>
        )
    }

    return (
        <div>
            {/* Dietary Banner */}
            {hasDietaryNeeds && (
                <div className={styles.dietaryBanner}>
                    <span>🍽️</span>
                    <span>Guest dietary needs: <strong>{dietarySummary}</strong> — cake concepts include accommodation notes.</span>
                </div>
            )}

            {/* Cake Grid */}
            <div className={styles.cakeGrid}>
                {state.concepts.map((cake) => {
                    const isSelected = state.selectedConceptId === cake.id
                    return (
                        <div
                            key={cake.id}
                            className={`${styles.cakeCard} ${isSelected ? styles.cakeCardSelected : ''}`}
                            onClick={() => selectConcept(cake.id)}
                        >
                            {isSelected && <div className={styles.selectedBadge}>Selected</div>}
                            <div className={styles.cakeEmoji}>{cake.emoji}</div>
                            <div className={styles.cakeName}>{cake.name}</div>
                            <div className={styles.cakeStyle}>{cake.style}</div>

                            <div className={styles.cakeDetails}>
                                <div className={styles.cakeDetail}>🎂 {cake.tiers} tier{cake.tiers !== 1 ? 's' : ''} · {cake.servings} servings</div>
                            </div>

                            <div className={styles.flavorTags}>
                                {cake.flavors.map((f, i) => (
                                    <span key={i} className={styles.flavorTag}>{f}</span>
                                ))}
                            </div>

                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5a7a9a', marginBottom: '0.4rem', lineHeight: 1.4 }}>
                                {cake.decorationStyle}
                            </div>

                            <div className={styles.cakePrice}>{cake.estimatedPrice}</div>

                            {cake.dietaryNotes && (
                                <div className={styles.cakeDietary}>{cake.dietaryNotes}</div>
                            )}

                            {cake.colorAccents && cake.colorAccents.length > 0 && (
                                <div className={styles.cakeColorAccents}>
                                    {cake.colorAccents.map((hex, i) => (
                                        <div key={i} className={styles.cakeColorDot} style={{ background: hex }} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Selected description */}
            {state.selectedConceptId && (() => {
                const selected = state.concepts.find(c => c.id === state.selectedConceptId)
                return selected ? (
                    <div className={styles.vibeText} style={{ marginTop: 0 }}>
                        {selected.emoji} <strong>{selected.name}:</strong> {selected.description}
                    </div>
                ) : null
            })()}

            {/* Refine */}
            <div className={styles.refineRow}>
                <input
                    className={styles.refineInput}
                    value={refineInput}
                    onChange={e => setRefineInput(e.target.value)}
                    placeholder="Combine flowers from option 2 with flavors from 4... Make it gluten-free... More whimsical..."
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

export type { CakeConcept, CakeSelectorState }
