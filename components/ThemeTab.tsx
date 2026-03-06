'use client'
import { useState } from 'react'
import styles from './ThemeTab.module.css'
import { showToast } from '@/components/Toast'
import { userGetJSON, userSetJSON } from '@/lib/userStorage'
import Moodboard from './Moodboard'
import InvitationDesigner from './InvitationDesigner'
import CakeSelector from './CakeSelector'
import VendorBrief from './VendorBrief'
import type { InteractionSignal } from '@/lib/ai-memory'
import type { UserPreferences } from '@/lib/ai-context'

interface EventGuest { name: string; email?: string; status?: string; dietary?: string; age?: string }
interface ChecklistItem { item: string; category: string; done: boolean }
interface TimelineItem { weeks: string; task: string; category: string; priority: string }
interface BudgetItem { category: string; amount: number; percentage: number; color: string }

interface PlanData {
    eventId?: string; eventType: string; guests: string; location: string; theme: string; date: string; budget: string; time?: string; hostName?: string
    plan: {
        summary: string
        timeline: TimelineItem[]
        checklist: ChecklistItem[]
        budget: { total: string; breakdown: BudgetItem[] }
        tips: string[]
        moodboard?: { palette?: string[]; keywords?: string[]; vibe?: string; decorIdeas?: string[] }
    }
}

type SubTab = 'moodboard' | 'invitations' | 'cake'

interface ThemeTabProps {
    eventId: string
    planData: PlanData
    eventGuests: EventGuest[]
    isDemo: boolean
    getContextPayload: () => Record<string, unknown>
    learn: (signal: InteractionSignal) => UserPreferences
}

const SUB_TABS: { key: SubTab; label: string; emoji: string }[] = [
    { key: 'moodboard', label: 'Moodboard', emoji: '🎨' },
    { key: 'invitations', label: 'Invitations', emoji: '💌' },
    { key: 'cake', label: 'Cake', emoji: '🎂' },
]

export default function ThemeTab({ eventId, planData, eventGuests, isDemo, getContextPayload, learn }: ThemeTabProps) {
    const subTabKey = `partypal_theme_subtab_${eventId}`
    const [activeSubTab, setActiveSubTab] = useState<SubTab>(() => {
        const saved = userGetJSON<SubTab | null>(subTabKey, null)
        return saved || 'moodboard'
    })
    const [showBrief, setShowBrief] = useState(false)

    const switchTab = (tab: SubTab) => {
        setActiveSubTab(tab)
        if (!isDemo) userSetJSON(subTabKey, tab)
    }

    const handleSyncToInvite = (invite: { subject: string; message: string; smsVersion: string; designId: string }) => {
        const inviteKey = eventId ? `partypal_invite_${eventId}` : 'partypal_invite'
        const existing = userGetJSON<Record<string, unknown>>(inviteKey, {})
        userSetJSON(inviteKey, { ...existing, ...invite })
        showToast('Design synced to your invitation! Switch to the Guests tab to preview.', 'success')
    }

    // Gather dietary summary for vendor brief
    const guestDietarySummary = (() => {
        const ctx = getContextPayload()
        return (ctx.guestContext as { dietarySummary?: string } | undefined)?.dietarySummary || ''
    })()

    // Load moodboard and cake state for vendor brief
    const getMoodboardState = () => userGetJSON(`partypal_moodboard_${eventId}`, null)
    const getCakeState = () => userGetJSON(`partypal_cake_${eventId}`, null)

    return (
        <div>
            {/* Sub-tab navigation */}
            <div className={styles.subTabs}>
                {SUB_TABS.map(({ key, label, emoji }) => (
                    <button
                        key={key}
                        className={`${styles.subTab} ${activeSubTab === key ? styles.subTabActive : ''}`}
                        onClick={() => switchTab(key)}
                    >
                        {emoji} {label}
                    </button>
                ))}
            </div>

            {/* Theme label */}
            {planData.theme && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9aabbb', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>THEME</span>
                        <span style={{ fontFamily: "'Fredoka One', cursive", color: 'var(--navy)', fontSize: '1.1rem' }}>{planData.theme}</span>
                    </div>
                    <button
                        onClick={() => setShowBrief(true)}
                        style={{
                            background: 'rgba(74,173,168,0.08)',
                            border: '1.5px solid rgba(74,173,168,0.3)',
                            borderRadius: 10,
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            color: 'var(--teal)',
                            cursor: 'pointer',
                            fontFamily: "'Nunito', sans-serif",
                        }}
                    >
                        📋 Vendor Brief
                    </button>
                </div>
            )}

            {/* Content */}
            {activeSubTab === 'moodboard' && (
                <Moodboard
                    eventId={eventId}
                    theme={planData.theme}
                    eventType={planData.eventType}
                    budget={planData.budget}
                    getContextPayload={getContextPayload}
                    learn={learn}
                    isDemo={isDemo}
                />
            )}

            {activeSubTab === 'invitations' && (
                <InvitationDesigner
                    eventId={eventId}
                    theme={planData.theme}
                    eventType={planData.eventType}
                    eventName={planData.eventType}
                    date={planData.date}
                    location={planData.location}
                    hostName={planData.hostName}
                    getContextPayload={getContextPayload}
                    learn={learn}
                    onSyncToInvite={handleSyncToInvite}
                    isDemo={isDemo}
                />
            )}

            {activeSubTab === 'cake' && (
                <CakeSelector
                    eventId={eventId}
                    theme={planData.theme}
                    eventType={planData.eventType}
                    guests={planData.guests}
                    budget={planData.budget}
                    getContextPayload={getContextPayload}
                    learn={learn}
                    isDemo={isDemo}
                />
            )}

            {/* Vendor Brief Modal */}
            {showBrief && (
                <VendorBrief
                    moodboard={getMoodboardState()}
                    cake={getCakeState()}
                    planData={planData}
                    guestDietarySummary={guestDietarySummary}
                    onClose={() => setShowBrief(false)}
                />
            )}
        </div>
    )
}
