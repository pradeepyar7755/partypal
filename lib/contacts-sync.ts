/**
 * Cloud sync utilities for contacts and circles.
 * Provides debounced push (local → Firestore) and pull (Firestore → local)
 * with per-contact last-write-wins merge strategy.
 */

import { userGetJSON, userSetJSON } from './userStorage'

export interface Contact {
    id: string
    name: string
    email: string
    phone: string
    circles: string[]
    avatar: string
    color: string
    updatedAt?: string
    deletedAt?: string
}

const DEBOUNCE_MS = 2000
let pushTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Push contacts and/or circles to cloud (debounced).
 * Call after every local save. Fire-and-forget.
 */
export function pushContactsToCloud(uid: string, contacts?: Contact[], circles?: string[]) {
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(async () => {
        try {
            const body: Record<string, unknown> = { uid }
            if (contacts) {
                body.contacts = contacts.map(c => ({
                    ...c,
                    updatedAt: c.updatedAt || new Date().toISOString(),
                }))
            }
            if (circles) {
                body.circles = circles
            }
            await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
        } catch {
            // Fail silently — matches existing fire-and-forget pattern
        }
    }, DEBOUNCE_MS)
}

/**
 * Pull contacts and circles from cloud and merge with local.
 * Returns merged data and whether anything changed.
 */
export async function pullContactsFromCloud(uid: string): Promise<{
    contacts: Contact[]
    circles: string[]
    changed: boolean
}> {
    const res = await fetch(`/api/contacts?uid=${uid}`)
    if (!res.ok) throw new Error('Failed to fetch contacts')
    const data = await res.json()
    const cloudContacts: Contact[] = data.contacts || []
    const cloudCircles: string[] = data.circles || []
    const cloudCirclesUpdatedAt: string = data.circlesUpdatedAt || ''

    const localContacts = userGetJSON<Contact[]>('partypal_contacts', [])
    const localCircles = userGetJSON<string[]>('partypal_circles',
        ['Family', 'Friends', 'Work', 'School', 'Neighbors'])
    const localCirclesUpdatedAt = userGetJSON<string>('partypal_circles_updated_at', '')

    // Merge contacts: per-contact last-write-wins
    const merged = mergeContacts(localContacts, cloudContacts)

    // Merge circles: last-write-wins on the entire array
    const mergedCircles = mergeCircles(
        localCircles, cloudCircles,
        localCirclesUpdatedAt, cloudCirclesUpdatedAt
    )

    const contactsChanged = JSON.stringify(merged) !== JSON.stringify(localContacts)
    const circlesChanged = JSON.stringify(mergedCircles) !== JSON.stringify(localCircles)

    if (contactsChanged) userSetJSON('partypal_contacts', merged)
    if (circlesChanged) {
        userSetJSON('partypal_circles', mergedCircles)
        if (cloudCirclesUpdatedAt && cloudCirclesUpdatedAt > localCirclesUpdatedAt) {
            userSetJSON('partypal_circles_updated_at', cloudCirclesUpdatedAt)
        }
    }

    return {
        contacts: merged,
        circles: mergedCircles,
        changed: contactsChanged || circlesChanged,
    }
}

/**
 * Merge local and cloud contacts using per-contact last-write-wins.
 * Respects soft deletes via deletedAt.
 */
function mergeContacts(local: Contact[], cloud: Contact[]): Contact[] {
    const byId = new Map<string, Contact>()

    // Seed with local contacts
    for (const c of local) {
        byId.set(c.id, { ...c, updatedAt: c.updatedAt || '2000-01-01T00:00:00Z' })
    }

    // Merge cloud contacts
    for (const c of cloud) {
        const existing = byId.get(c.id)
        const cloudTime = new Date(c.updatedAt || 0).getTime()

        if (!existing) {
            // New from cloud — add unless soft-deleted
            if (!c.deletedAt) byId.set(c.id, c)
        } else {
            const localTime = new Date(existing.updatedAt || 0).getTime()

            if (c.deletedAt) {
                // Cloud says deleted — delete if deletion is newer than local edit
                const deleteTime = new Date(c.deletedAt).getTime()
                if (deleteTime >= localTime) {
                    byId.delete(c.id)
                }
            } else if (cloudTime >= localTime) {
                // Cloud version is newer
                byId.set(c.id, c)
            }
            // Otherwise keep local (already in map)
        }
    }

    return Array.from(byId.values()).filter(c => !c.deletedAt)
}

/**
 * Merge circles using last-write-wins on the entire array.
 */
function mergeCircles(
    local: string[], cloud: string[],
    localUpdatedAt: string, cloudUpdatedAt: string
): string[] {
    if (!cloud.length && !cloudUpdatedAt) return local  // Cloud empty / never set
    if (!local.length && !localUpdatedAt) return cloud  // Local empty / fresh install

    const localTime = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0
    const cloudTime = cloudUpdatedAt ? new Date(cloudUpdatedAt).getTime() : 0

    return cloudTime >= localTime ? cloud : local
}
