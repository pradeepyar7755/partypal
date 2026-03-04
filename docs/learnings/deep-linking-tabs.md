# Deep Linking for Tabs

## Overview

Deep linking allows users to bookmark, share, and navigate back to specific tabs/views within a single-page app. In a Next.js App Router app, this is done via URL search params (`?tab=plan&event=abc123`), read reactively with `useSearchParams()`.

## The Problem

A dashboard with multiple tabs (Plan, Vendors, Guests, Budget) initially read the active tab from component state only. This caused:
1. **Lost tab state on refresh** — Refreshing the page always landed on the default tab
2. **Broken back navigation** — Going to a sub-page and coming back reset the tab
3. **Non-shareable views** — Couldn't share a link to a specific tab/event combination
4. **Tab instability** — Reading URL params only on initial render caused the tab to flicker or not update when navigating programmatically

## The Solution

### URL-Based Tab State with `useSearchParams()`

```typescript
'use client'
import { useSearchParams, useRouter } from 'next/navigation'

export default function Dashboard() {
    const searchParams = useSearchParams()
    const router = useRouter()

    // Read tab and event from URL reactively (re-renders on param change)
    const activeTab = searchParams.get('tab') || 'plan'
    const activeEventId = searchParams.get('event') || ''

    const setTab = (tab: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('tab', tab)
        router.push(`/dashboard?${params.toString()}`, { scroll: false })
    }

    const setEvent = (eventId: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('event', eventId)
        params.set('tab', 'plan') // default to plan tab when switching events
        router.push(`/dashboard?${params.toString()}`, { scroll: false })
    }

    return (
        <div>
            <TabBar active={activeTab} onSelect={setTab} />
            {activeTab === 'plan' && <PlanTab eventId={activeEventId} />}
            {activeTab === 'vendors' && <VendorsTab eventId={activeEventId} />}
            {activeTab === 'guests' && <GuestsTab eventId={activeEventId} />}
            {activeTab === 'budget' && <BudgetTab eventId={activeEventId} />}
        </div>
    )
}
```

### Linking Back to a Specific Tab from Sub-Pages

When navigating away from the dashboard to a sub-page (like a standalone guest management page), encode the return destination in the URL:

```typescript
// On the guests page, link back to the dashboard with the correct tab
<Link href={`/dashboard?event=${eventId}&tab=guests`}>
    ← Back to My Events
</Link>
```

### Programmatic Deep Linking (e.g., After RSVP)

After an action completes on a different page, redirect to a specific dashboard tab:

```typescript
router.push(`/dashboard?event=${eventId}&tab=guests`)
```

### Key Pattern: `{ scroll: false }`

When updating URL params to change tabs, pass `{ scroll: false }` to `router.push()` to prevent the page from scrolling to the top on every tab switch.

## Key Gotchas

1. **`useSearchParams()` requires `'use client'`** — This hook only works in client components. If your page is a server component, extract the client tab logic into a separate `DashboardClient` component.

2. **Don't read params in `useEffect` with empty deps** — Reading `searchParams.get('tab')` inside `useEffect(() => { ... }, [])` only captures the initial value. Instead, derive tab state directly from `searchParams` in the render body so it's always reactive.

3. **`Suspense` boundary needed** — Next.js requires wrapping components that use `useSearchParams()` in a `<Suspense>` boundary in production builds to avoid hydration issues.

4. **Preserve existing params** — When updating one param, always start from `new URLSearchParams(searchParams.toString())` to preserve other params (like event ID when switching tabs).

5. **Default fallback** — Always provide a default: `searchParams.get('tab') || 'plan'`. Never assume the param exists.

6. **Skip dropdown for single events** — If the user only has one event, don't show an event selector — auto-select it and only show tabs.

## Reusable Checklist

- [ ] **Identify all navigable states** — List every tab, sub-view, and filter that should be preserved in the URL
- [ ] **Use `useSearchParams()`** — Read all navigable state from URL params, not component state
- [ ] **Update params with `router.push()`** — Build new params from existing ones to preserve unrelated params
- [ ] **Pass `{ scroll: false }`** — Prevent scroll-to-top on param-only navigation
- [ ] **Wrap in `<Suspense>`** — Required for production builds with `useSearchParams()`
- [ ] **Encode return destinations** — When linking to sub-pages, include the return tab/event in the back link
- [ ] **Provide defaults** — Every `searchParams.get()` call should have a fallback value
- [ ] **Test refresh and back/forward** — Verify that browser refresh and history navigation preserve the correct tab
