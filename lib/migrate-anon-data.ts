/**
 * Migrates data stored under unprefixed localStorage keys (created while
 * the user was anonymous) to UID-scoped keys. Runs once per UID.
 */

function safeParseArray(raw: string): unknown[] {
    try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
}

function safeParseObject(raw: string): Record<string, unknown> {
    try {
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch { return {} }
}

/** Migrate an array key. Merges by dedupField if provided, otherwise deduplicates by JSON.stringify. */
function migrateJSONArray(uid: string, key: string, dedupField?: string): void {
    const anonRaw = localStorage.getItem(key)
    if (!anonRaw) return

    const scopedKey = `${uid}_${key}`
    const anonData = safeParseArray(anonRaw)
    if (anonData.length === 0) return

    const existingRaw = localStorage.getItem(scopedKey)
    const existingData = existingRaw ? safeParseArray(existingRaw) : []

    let merged: unknown[]
    if (dedupField) {
        const seen = new Set(existingData.map((item: any) => item[dedupField]))
        merged = [...existingData]
        for (const item of anonData) {
            const val = (item as any)[dedupField]
            if (val && !seen.has(val)) {
                merged.push(item)
                seen.add(val)
            } else if (!val) {
                merged.push(item)
            }
        }
    } else {
        const asSet = new Set([
            ...existingData.map(v => JSON.stringify(v)),
            ...anonData.map(v => JSON.stringify(v)),
        ])
        merged = Array.from(asSet).map(v => JSON.parse(v))
    }

    localStorage.setItem(scopedKey, JSON.stringify(merged))
}

/** Migrate a single JSON value. Only copies if the scoped key is empty. */
function migrateJSONSingle(uid: string, key: string): void {
    const anonRaw = localStorage.getItem(key)
    if (!anonRaw) return

    const scopedKey = `${uid}_${key}`
    if (localStorage.getItem(scopedKey)) return

    localStorage.setItem(scopedKey, anonRaw)
}

/** Migrate an object key (Record<string, T>). Shallow merge — existing keys win. */
function migrateJSONObject(uid: string, key: string): void {
    const anonRaw = localStorage.getItem(key)
    if (!anonRaw) return

    const scopedKey = `${uid}_${key}`
    const anonData = safeParseObject(anonRaw)
    const existingRaw = localStorage.getItem(scopedKey)
    const existingData = existingRaw ? safeParseObject(existingRaw) : {}

    const merged = { ...anonData, ...existingData }
    localStorage.setItem(scopedKey, JSON.stringify(merged))
}

export function migrateAnonymousData(uid: string): void {
    if (typeof window === 'undefined') return

    const migrationFlag = `${uid}_partypal_migrated`
    if (localStorage.getItem(migrationFlag)) return

    try {
        // Global keys
        migrateJSONArray(uid, 'partypal_events', 'eventId')
        migrateJSONSingle(uid, 'partyplan')
        migrateJSONArray(uid, 'partypal_shortlist')
        migrateJSONObject(uid, 'partypal_shortlist_data')
        migrateJSONObject(uid, 'partypal_shortlist_full')
        migrateJSONArray(uid, 'partypal_contacts', 'email')
        migrateJSONArray(uid, 'partypal_circles')
        migrateJSONSingle(uid, 'partypal_ai_memory')

        // Per-event keys — collect all event IDs from both sources
        const anonEventsRaw = localStorage.getItem('partypal_events')
        const anonEvents = anonEventsRaw ? safeParseArray(anonEventsRaw) : []
        const scopedEventsRaw = localStorage.getItem(`${uid}_partypal_events`)
        const scopedEvents = scopedEventsRaw ? safeParseArray(scopedEventsRaw) : []
        const allEventIds = new Set<string>()
        for (const ev of [...anonEvents, ...scopedEvents]) {
            const id = (ev as any)?.eventId
            if (id && id !== 'demo') allEventIds.add(id)
        }

        for (const eventId of Array.from(allEventIds)) {
            migrateJSONArray(uid, `partypal_guests_${eventId}`, 'email')
            migrateJSONArray(uid, `partypal_vendors_${eventId}`, 'name')
            migrateJSONArray(uid, `partypal_collabs_${eventId}`, 'email')
            migrateJSONSingle(uid, `partypal_checklist_${eventId}`)
            migrateJSONArray(uid, `partypal_eventguests_${eventId}`, 'id')
            migrateJSONSingle(uid, `partypal_invite_${eventId}`)
            migrateJSONSingle(uid, `partypal_published_${eventId}`)
            migrateJSONArray(uid, `partypal_bookmarks_${eventId}`, 'name')
            migrateJSONArray(uid, `partypal_registry_${eventId}`, 'url')
        }

        localStorage.setItem(migrationFlag, new Date().toISOString())

        // Push migrated contacts & circles to cloud so they persist across devices
        const migratedContacts = safeParseArray(localStorage.getItem(`${uid}_partypal_contacts`) || '[]')
        const migratedCircles = safeParseArray(localStorage.getItem(`${uid}_partypal_circles`) || '[]')
        if (migratedContacts.length > 0 || migratedCircles.length > 0) {
            fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uid,
                    contacts: migratedContacts.length > 0 ? migratedContacts : undefined,
                    circles: migratedCircles.length > 0 ? migratedCircles : undefined,
                }),
            }).catch(() => {})
        }
    } catch (error) {
        console.error('Anonymous data migration failed:', error)
    }
}
