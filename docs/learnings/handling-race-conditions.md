# Handling Race Conditions

## Overview

Race conditions occur when multiple async operations compete to read/write the same data, causing unexpected state. In a Next.js app with localStorage + Firestore cloud sync, race conditions are especially common because state lives in two places with different latency characteristics.

## Patterns & Solutions

### 1. Event Deletion While Save Is In-Flight

**Problem:** User deletes an event while a background save is still in-flight. The save completes after the delete, resurrecting the event.

**Solution:** Await backend completion before allowing destructive actions. Use `event.stopPropagation()` to prevent parent click handlers from triggering re-saves.

```typescript
// BAD — delete fires while parent save is still in-flight
const handleDelete = () => {
    localStorage.removeItem(eventId)
    fetch(`/api/events?eventId=${eventId}`, { method: 'DELETE' })
}

// GOOD — await save, prevent event bubbling, then delete
const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation() // prevent parent card's onClick from saving
    await fetch(`/api/events?eventId=${eventId}`, { method: 'DELETE' })
    localStorage.removeItem(eventId)
    setEvents(prev => prev.filter(ev => ev.eventId !== eventId))
}
```

**Key Gotcha:** In React, click handlers on child elements (like a delete button inside an event card) will bubble up to parent handlers. If the parent has an `onClick` that saves the event, the delete button click will trigger a save immediately after the delete.

### 2. localStorage ↔ Firestore Sync Conflicts

**Problem:** With 30-second polling cloud sync, local and cloud state can diverge. Merging naively causes data loss or duplication.

**Solution:** Use a deterministic merge strategy with a clear "who wins" rule.

```typescript
// Cloud wins if it has more interactions (more data = more authoritative)
const cloudPrefs = { ...defaultPreferences(), ...data.aiMemory }
const localPrefs = loadPreferences()

if (cloudPrefs.interactionCount >= localPrefs.interactionCount) {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(cloudPrefs))
    return cloudPrefs
}
return loadPreferences() // local wins if it has more interactions
```

**Pattern: Fire-and-forget cloud sync with local-first reads**
```typescript
// Write locally FIRST (instant UI), then sync to cloud (async, no await)
export function savePreferences(prefs: UserPreferences, uid?: string): void {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(prefs))
    if (uid) {
        fetch('/api/user-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, aiMemory: prefs }),
        }).catch(() => {}) // fire-and-forget
    }
}
```

### 3. Aggressive Sync Pruning Deleting Valid Events

**Problem:** Cloud sync pruned events from localStorage that weren't found in the Firestore response. But events were missing from Firestore because the `uid` field was accidentally omitted during saves, so the query `where('uid', '==', uid)` didn't find them.

**Solution:** Always include the `uid` in every Firestore write. Validate that the field your sync query filters on is always present.

```typescript
// BAD — uid might be undefined, making the event invisible to sync queries
const updateData = { eventId, eventType, updatedAt: new Date().toISOString() }

// GOOD — always include uid
const updateData = { eventId, eventType, uid, updatedAt: new Date().toISOString() }
if (!uid) return // don't save without uid
```

### 4. UI State Updates Skipping Backend Saves

**Problem:** Component state updates (via `setState`) fired without awaiting the corresponding API call. If the API call failed, the UI showed stale/incorrect state.

**Solution:** Always `await` the API call before updating local state. If the API fails, don't update the UI.

```typescript
// BAD — optimistic update without confirming backend success
setGuests([...guests, newGuest])
fetch('/api/guests', { method: 'POST', body: JSON.stringify(newGuest) })

// GOOD — confirm backend, then update UI
try {
    const res = await fetch('/api/guests', { method: 'POST', body: JSON.stringify(newGuest) })
    if (res.ok) {
        setGuests([...guests, newGuest])
    }
} catch {
    // show error toast
}
```

### 5. Array Merging Losing Fields

**Problem:** When merging guest arrays from RSVP updates and the GuestManager, fields like `kidCount` and `isChild` were dropped because the merge only copied a subset of properties.

**Solution:** Use spread operators to preserve all existing fields when merging.

```typescript
// BAD — only copies known fields, drops unknown ones
const merged = existingGuests.map(g => ({
    name: g.name,
    email: g.email,
    status: updatedGuest?.status || g.status,
}))

// GOOD — preserve all fields with spread
const merged = existingGuests.map(g => {
    const update = updates.find(u => u.email === g.email)
    return update ? { ...g, ...update } : g
})
```

### 6. Orphaned localStorage Entries

**Problem:** Events deleted from Firestore persisted in localStorage, causing ghost events to appear in the UI.

**Solution:** On sync, prune localStorage entries that no longer exist in Firestore.

```typescript
const cloudEventIds = new Set(cloudEvents.map(e => e.eventId))
const localEvents = userGetJSON<Event[]>('events', [])

// Remove local events not found in cloud
const pruned = localEvents.filter(e => cloudEventIds.has(e.eventId))
userSetJSON('events', pruned)
```

## Reusable Checklist

- [ ] **Identify shared state** — List every place where the same data is read/written (localStorage, Firestore, component state, URL params)
- [ ] **Choose a merge strategy** — Decide "who wins" for each data type (last-write-wins, cloud-wins, local-wins, merge with conflict resolution)
- [ ] **Await destructive operations** — Never fire-and-forget deletes or state transitions. Always await the backend before updating the UI
- [ ] **Stop event propagation** — On buttons inside clickable containers, use `e.stopPropagation()` to prevent parent handlers from interfering
- [ ] **Preserve all fields during merges** — Use spread operators, not explicit field copies
- [ ] **Include identity fields in every write** — If your sync query filters on `uid`, ensure `uid` is present in every document
- [ ] **Prune orphans on sync** — When syncing cloud → local, remove local entries that no longer exist in the cloud
- [ ] **Use local-first, cloud-async** — Write to localStorage immediately for instant UI, sync to cloud in the background
