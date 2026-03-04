# Managing Google AdSense

## Overview

Integrating Google AdSense into a Next.js app with a development mock placeholder, conditional script loading, and a reusable ad component.

## Architecture

```
layout.tsx          → Conditionally loads AdSense script via env var
components/AdUnit   → Renders real ad OR styled mock placeholder
Pages               → Place <AdUnit slot="..." /> where ads should appear
```

## Step 1: Conditional Script Loading

Load the AdSense script only when the client ID is configured. This keeps the dev environment clean and avoids AdSense errors during local development.

```typescript
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                {/* Only load AdSense in production when client ID is set */}
                {process.env.NEXT_PUBLIC_ADSENSE_CLIENT && (
                    <script
                        async
                        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`}
                        crossOrigin="anonymous"
                    />
                )}
            </head>
            <body>{children}</body>
        </html>
    )
}
```

**Env var:** `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXX`

## Step 2: AdUnit Component with Dev Mock

```typescript
// components/AdUnit.tsx
'use client'
import { useEffect, useRef } from 'react'

interface AdUnitProps {
    slot: string                    // AdSense ad unit slot ID
    format?: 'auto' | 'fluid' | 'rectangle' | 'vertical' | 'horizontal'
    style?: React.CSSProperties
    className?: string
    label?: string                  // Custom label for mock placeholder
}

export default function AdUnit({ slot, format = 'auto', style, className, label }: AdUnitProps) {
    const adRef = useRef<HTMLDivElement>(null)
    const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT

    useEffect(() => {
        if (client && typeof window !== 'undefined') {
            try {
                ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
            } catch { /* ad already pushed */ }
        }
    }, [client])

    // Dev mode: render styled mock placeholder
    if (!client) {
        return (
            <div className={className} style={style}>
                <div style={{
                    background: 'linear-gradient(135deg, rgba(74,173,168,0.06), rgba(123,94,167,0.06))',
                    border: '1.5px dashed rgba(74,173,168,0.3)',
                    borderRadius: 12,
                    padding: '1.2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: format === 'vertical' ? 400 : format === 'rectangle' ? 250 : 100,
                }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' }}>
                        Sponsored
                    </span>
                    <div>{label || 'Ad Space'}</div>
                    <div style={{ fontSize: '0.72rem', color: '#9aabbb' }}>
                        Google AdSense will display relevant ads here
                    </div>
                </div>
            </div>
        )
    }

    // Production: render real AdSense tag
    return (
        <div ref={adRef} className={className} style={style}>
            <ins
                className="adsbygoogle"
                style={{ display: 'block', ...style }}
                data-ad-client={client}
                data-ad-slot={slot}
                data-ad-format={format}
                data-full-width-responsive="true"
            />
        </div>
    )
}
```

## Step 3: Placing Ads

```typescript
// In any page or component
import AdUnit from '@/components/AdUnit'

<AdUnit slot="1234567890" format="rectangle" label="Featured Partners" />
<AdUnit slot="0987654321" format="horizontal" />
<AdUnit slot="1122334455" format="vertical" style={{ maxWidth: 300 }} />
```

## Ad Format Guide

| Format | Use Case | Min Height |
|--------|---------|------------|
| `auto` | Adapts to container (default) | ~100px |
| `fluid` | In-feed native ads | Varies |
| `rectangle` | Sidebar, between sections | ~250px |
| `vertical` | Sidebar tower ads (160x600) | ~400px |
| `horizontal` | Banner at top/bottom of page | ~100px |

## Key Gotchas

1. **`adsbygoogle.push({})` must run once per ad slot** — The `useEffect` call initializes each ad unit. If you push multiple times for the same slot, AdSense throws errors. The `try/catch` swallows "already pushed" errors.

2. **Don't push on SSR** — Guard with `typeof window !== 'undefined'`. The `adsbygoogle` global only exists in the browser.

3. **AdSense won't render in dev mode** — Even with a valid client ID, AdSense requires the page to be served from an approved domain. Use the mock placeholder for development.

4. **`data-full-width-responsive="true"`** — This is critical for mobile. Without it, ads may overflow their container on small screens.

5. **AdSense approval** — Your site must be approved by Google before ads display. Apply at [Google AdSense](https://www.google.com/adsense/), verify domain ownership, and wait for approval. During this period, the `<ins>` tags will render as empty space.

6. **Content policy** — AdSense has strict content policies. Don't place ads on pages with minimal content, login pages, or error pages. Place them on content-rich pages (dashboard, results, marketplace).

7. **Ad density** — Google recommends no more than 3 ad units per page. More than that can trigger policy violations.

## Reusable Checklist

- [ ] **Set `NEXT_PUBLIC_ADSENSE_CLIENT` env var** only in production
- [ ] **Load AdSense script conditionally** in `layout.tsx` (skip in dev)
- [ ] **Create `AdUnit` component** with dev mock placeholder
- [ ] **Use `useEffect` + `adsbygoogle.push({})`** to initialize each ad slot
- [ ] **Guard against SSR** with `typeof window !== 'undefined'`
- [ ] **Add `data-full-width-responsive="true"`** for mobile compatibility
- [ ] **Limit to 3 ads per page** to stay within policy
- [ ] **Apply for AdSense approval** and verify domain ownership
- [ ] **Test with mock placeholders** in development — don't rely on real ads
