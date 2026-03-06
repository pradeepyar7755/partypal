'use client'
import { useState } from 'react'
import styles from './ThemeTab.module.css'
import { showToast } from '@/components/Toast'
import { userGetJSON, userSetJSON } from '@/lib/userStorage'
import InvitationCard from './InvitationCard'
import type { InvitationDesign } from './InvitationCard'
import type { InteractionSignal } from '@/lib/ai-memory'
import type { UserPreferences } from '@/lib/ai-context'

interface InvitationDesignerState {
    designs: InvitationDesign[]
    selectedDesignId: string | null
    customizations: Record<string, Partial<InvitationDesign>>
    refinementHistory: string[]
    generatedAt: string
    syncedToInvite: boolean
}

interface InvitationDesignerProps {
    eventId: string
    theme: string
    eventType: string
    eventName?: string
    date?: string
    location?: string
    hostName?: string
    getContextPayload: () => Record<string, unknown>
    learn: (signal: InteractionSignal) => UserPreferences
    onSyncToInvite: (invite: { subject: string; message: string; smsVersion: string; designId: string }) => void
    isDemo: boolean
}

const DEMO_DESIGNS: InvitationDesign[] = [
    {
        id: 'demo_1', name: 'Garden Elegance', layout: 'centered',
        backgroundColor: '#fef9ef', backgroundGradient: 'linear-gradient(135deg, #fef9ef 0%, #fff5e6 100%)',
        accentColor: '#4AADA8', textColor: '#4a5568', headingColor: '#2D4059',
        fontFamily: 'serif', decorativeMotif: 'floral-corners', motifEmoji: '🌿',
        headerText: "You're Invited!", bodyText: 'Join us for an unforgettable tropical celebration filled with island vibes, great food, and even better company.',
        footerText: "We can't wait to see you there!", borderStyle: 'thin', borderRadius: 16,
    },
    {
        id: 'demo_2', name: 'Bold Tropical', layout: 'centered',
        backgroundColor: '#2D4059', backgroundGradient: 'linear-gradient(135deg, #2D4059 0%, #1a2a3a 100%)',
        accentColor: '#F7C948', textColor: 'rgba(255,255,255,0.85)', headingColor: '#F7C948',
        fontFamily: 'display', decorativeMotif: 'confetti', motifEmoji: '🌴',
        headerText: 'Paradise Awaits!', bodyText: "Get ready for a tropical throwdown you won't forget. Sun, sips, and good times ahead!",
        footerText: 'See you in paradise!', borderStyle: 'none', borderRadius: 20,
    },
    {
        id: 'demo_3', name: 'Clean & Modern', layout: 'minimal',
        backgroundColor: '#ffffff', accentColor: '#E8896A', textColor: '#5a6a7a', headingColor: '#2D4059',
        fontFamily: 'sans-serif', decorativeMotif: 'minimal-line', motifEmoji: '✨',
        headerText: 'Come Celebrate!', bodyText: 'An evening of tropical elegance and celebration. Cocktails, dinner, and dancing under the stars.',
        footerText: 'RSVP below', borderStyle: 'thin', borderRadius: 12,
    },
    {
        id: 'demo_4', name: 'Island Vibes', layout: 'split',
        backgroundColor: '#f0faf9', backgroundGradient: 'linear-gradient(135deg, #f0faf9 0%, #e8f5f3 100%)',
        accentColor: '#4AADA8', textColor: '#4a5a6a', headingColor: '#2D4059',
        fontFamily: 'sans-serif', decorativeMotif: 'watercolor-wash', motifEmoji: '🌺',
        headerText: 'Aloha & Welcome!', bodyText: 'Transport yourself to a tropical paradise for an evening of celebration, laughter, and memories.',
        footerText: 'We hope you can make it!', borderStyle: 'decorative', borderRadius: 16,
    },
]

export default function InvitationDesigner({ eventId, theme, eventType, eventName, date, location, hostName, getContextPayload, learn, onSyncToInvite, isDemo }: InvitationDesignerProps) {
    const storageKey = `partypal_invitation_designs_${eventId}`
    const [state, setState] = useState<InvitationDesignerState>(() => {
        if (isDemo) return { designs: DEMO_DESIGNS, selectedDesignId: 'demo_1', customizations: {}, refinementHistory: [], generatedAt: new Date().toISOString(), syncedToInvite: false }
        const saved = userGetJSON<InvitationDesignerState | null>(storageKey, null)
        return saved || { designs: [], selectedDesignId: null, customizations: {}, refinementHistory: [], generatedAt: '', syncedToInvite: false }
    })
    const [loading, setLoading] = useState(false)
    const [refining, setRefining] = useState(false)
    const [refineInput, setRefineInput] = useState('')
    const [editingField, setEditingField] = useState<{ designId: string; field: string } | null>(null)
    const [editValue, setEditValue] = useState('')

    const persist = (next: InvitationDesignerState) => {
        setState(next)
        if (!isDemo) userSetJSON(storageKey, next)
    }

    const generate = async () => {
        if (isDemo) return
        setLoading(true)
        try {
            const res = await fetch('/api/theme/invitation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme, eventType, eventName, date, location, hostName, ...getContextPayload() }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Failed' }))
                showToast(err.error || 'Failed to generate designs', 'error')
                setLoading(false)
                return
            }
            const { designs } = await res.json()
            const next: InvitationDesignerState = { designs, selectedDesignId: null, customizations: {}, refinementHistory: [], generatedAt: new Date().toISOString(), syncedToInvite: false }
            persist(next)
            learn({ type: 'invite_style_chosen', style: theme })
            showToast('Invitation designs ready!', 'success')
        } catch {
            showToast('Something went wrong', 'error')
        }
        setLoading(false)
    }

    const refine = async () => {
        if (!refineInput.trim() || state.designs.length === 0 || isDemo) return
        setRefining(true)
        try {
            const res = await fetch('/api/theme/invitation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'refine', currentDesigns: getEffectiveDesigns(), instruction: refineInput.trim(), theme, eventType, ...getContextPayload() }),
            })
            if (!res.ok) {
                showToast('Failed to refine designs', 'error')
                setRefining(false)
                return
            }
            const { designs } = await res.json()
            const next: InvitationDesignerState = {
                ...state,
                designs,
                customizations: {},
                refinementHistory: [...state.refinementHistory, refineInput.trim()].slice(-10),
                generatedAt: new Date().toISOString(),
                syncedToInvite: false,
            }
            persist(next)
            setRefineInput('')
            learn({ type: 'plan_refined', refinementText: refineInput.trim() })
            showToast('Designs updated!', 'success')
        } catch {
            showToast('Something went wrong', 'error')
        }
        setRefining(false)
    }

    const getEffectiveDesign = (design: InvitationDesign): InvitationDesign => {
        const customs = state.customizations[design.id]
        return customs ? { ...design, ...customs } : design
    }

    const getEffectiveDesigns = () => state.designs.map(getEffectiveDesign)

    const startEdit = (designId: string, field: string, value: string) => {
        setEditingField({ designId, field })
        setEditValue(value)
    }

    const saveEdit = () => {
        if (!editingField) return
        const next = { ...state }
        next.customizations = { ...next.customizations }
        next.customizations[editingField.designId] = {
            ...next.customizations[editingField.designId],
            [editingField.field]: editValue,
        }
        next.syncedToInvite = false
        persist(next)
        setEditingField(null)
        setEditValue('')
    }

    const selectDesign = (id: string) => {
        persist({ ...state, selectedDesignId: state.selectedDesignId === id ? null : id, syncedToInvite: false })
    }

    const syncToInvite = () => {
        const selected = state.designs.find(d => d.id === state.selectedDesignId)
        if (!selected) return
        const effective = getEffectiveDesign(selected)
        onSyncToInvite({
            subject: effective.headerText,
            message: effective.bodyText + '\n\n' + effective.footerText,
            smsVersion: effective.bodyText.slice(0, 155) + (effective.bodyText.length > 155 ? '...' : ''),
            designId: effective.id,
        })
        persist({ ...state, syncedToInvite: true })
    }

    if (loading) {
        return (
            <div className={styles.aiLoading}>
                <div className="spinner" />
                Designing your invitations...
            </div>
        )
    }

    if (state.designs.length === 0) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyEmoji}>💌</div>
                <div className={styles.emptyTitle}>Invitation Designer</div>
                <div className={styles.emptyDesc}>Generate AI-designed invitation cards that match your party theme. Pick your favorite and send it to guests.</div>
                <button className={styles.generateBtn} onClick={generate} disabled={isDemo}>
                    ✨ Design Invitations
                </button>
            </div>
        )
    }

    return (
        <div>
            {/* Design Grid */}
            <div className={styles.designGrid}>
                {getEffectiveDesigns().map((design) => {
                    const isSelected = state.selectedDesignId === design.id
                    const isEditing = editingField?.designId === design.id
                    return (
                        <div
                            key={design.id}
                            className={`${styles.designCardWrapper} ${isSelected ? styles.designCardSelected : ''}`}
                            onClick={() => !isEditing && selectDesign(design.id)}
                        >
                            {isSelected && <div className={styles.selectedBadge}>Selected</div>}
                            <InvitationCard design={design} compact />

                            {/* Editable text overlay — shown when card is selected */}
                            {isSelected && (
                                <div style={{ padding: '0.6rem 0.8rem', background: 'var(--light-bg)', borderTop: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '0.3rem' }}>
                                        Tap text to edit
                                    </div>
                                    {['headerText', 'bodyText', 'footerText'].map(field => {
                                        const value = design[field as keyof InvitationDesign] as string
                                        const isEditingThis = editingField?.designId === design.id && editingField.field === field
                                        return (
                                            <div key={field} style={{ marginBottom: '0.3rem' }}>
                                                {isEditingThis ? (
                                                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                        <input
                                                            value={editValue}
                                                            onChange={e => setEditValue(e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && saveEdit()}
                                                            onBlur={saveEdit}
                                                            autoFocus
                                                            onClick={e => e.stopPropagation()}
                                                            style={{ flex: 1, padding: '0.3rem 0.5rem', borderRadius: 6, border: '1.5px solid var(--teal)', fontSize: '0.75rem', fontWeight: 600, outline: 'none', color: 'var(--navy)' }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div
                                                        onClick={e => { e.stopPropagation(); startEdit(design.id, field, value) }}
                                                        style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--navy)', cursor: 'text', padding: '0.2rem 0.4rem', borderRadius: 4, transition: 'background 0.2s' }}
                                                        onMouseOver={e => (e.currentTarget.style.background = 'rgba(74,173,168,0.06)')}
                                                        onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                                                    >
                                                        {value}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            <div className={styles.designName}>{design.name}</div>
                        </div>
                    )
                })}
            </div>

            {/* Sync to Invite */}
            {state.selectedDesignId && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <button className={styles.syncBtn} onClick={syncToInvite} disabled={state.syncedToInvite}>
                        {state.syncedToInvite ? '✓ Synced to Invitation' : '💌 Use as Invitation'}
                    </button>
                    {state.syncedToInvite && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--teal)' }}>
                            Switch to the Guests tab to preview and send
                        </span>
                    )}
                </div>
            )}

            {/* Refine */}
            <div className={styles.refineRow}>
                <input
                    className={styles.refineInput}
                    value={refineInput}
                    onChange={e => setRefineInput(e.target.value)}
                    placeholder="Make it more rustic... Use warmer tones... More playful..."
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
