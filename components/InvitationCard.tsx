'use client'

interface InvitationDesign {
    id: string
    name: string
    layout: 'centered' | 'left-aligned' | 'split' | 'minimal'
    backgroundColor: string
    backgroundGradient?: string
    accentColor: string
    textColor: string
    headingColor: string
    fontFamily: 'serif' | 'sans-serif' | 'script' | 'display'
    decorativeMotif: string
    motifEmoji: string
    headerText: string
    bodyText: string
    footerText: string
    borderStyle: 'none' | 'thin' | 'double' | 'decorative'
    borderRadius: number
}

interface InvitationCardProps {
    design: InvitationDesign
    compact?: boolean
}

const FONT_MAP: Record<string, string> = {
    'serif': "'Georgia', 'Times New Roman', serif",
    'sans-serif': "'Nunito', 'Segoe UI', sans-serif",
    'script': "'Georgia', cursive",
    'display': "'Fredoka One', cursive",
}

function getMotifDecoration(motif: string, accent: string, position: 'top' | 'bottom'): React.CSSProperties {
    const base: React.CSSProperties = {
        position: 'absolute',
        left: 0,
        right: 0,
        height: position === 'top' ? 40 : 30,
        pointerEvents: 'none',
        ...(position === 'top' ? { top: 0 } : { bottom: 0 }),
    }

    switch (motif) {
        case 'floral-corners':
            return { ...base, borderTop: position === 'top' ? `3px solid ${accent}` : undefined, borderBottom: position === 'bottom' ? `3px solid ${accent}` : undefined }
        case 'geometric-border':
            return { ...base, background: `repeating-linear-gradient(90deg, ${accent}22 0px, ${accent}22 8px, transparent 8px, transparent 16px)`, height: 6 }
        case 'watercolor-wash':
            return { ...base, background: `linear-gradient(${position === 'top' ? '180deg' : '0deg'}, ${accent}20, transparent)`, height: 50 }
        case 'confetti':
            return { ...base, background: `radial-gradient(circle 3px at 15% 50%, ${accent}40 100%, transparent 100%), radial-gradient(circle 2px at 45% 30%, ${accent}30 100%, transparent 100%), radial-gradient(circle 3px at 75% 60%, ${accent}40 100%, transparent 100%), radial-gradient(circle 2px at 90% 40%, ${accent}30 100%, transparent 100%)`, height: 30 }
        case 'stars':
            return { ...base, background: `radial-gradient(circle 2px at 20% 50%, ${accent}50 100%, transparent 100%), radial-gradient(circle 2px at 50% 30%, ${accent}40 100%, transparent 100%), radial-gradient(circle 2px at 80% 50%, ${accent}50 100%, transparent 100%)`, height: 20 }
        case 'minimal-line':
            return { ...base, height: 2, background: accent, opacity: 0.3 }
        default:
            return { ...base, height: 0 }
    }
}

function getBorderCSS(style: string, accent: string, radius: number): React.CSSProperties {
    switch (style) {
        case 'thin':
            return { border: `1.5px solid ${accent}40`, borderRadius: radius }
        case 'double':
            return { border: `3px double ${accent}60`, borderRadius: radius }
        case 'decorative':
            return { border: `2px solid ${accent}`, borderRadius: radius, boxShadow: `inset 0 0 0 4px ${accent}15` }
        default:
            return { borderRadius: radius }
    }
}

export default function InvitationCard({ design, compact = false }: InvitationCardProps) {
    const {
        layout, backgroundColor, backgroundGradient, accentColor, textColor, headingColor,
        fontFamily, decorativeMotif, motifEmoji, headerText, bodyText, footerText,
        borderStyle, borderRadius,
    } = design

    const font = FONT_MAP[fontFamily] || FONT_MAP['sans-serif']
    const borderCSS = getBorderCSS(borderStyle, accentColor, borderRadius)
    const padding = compact ? '1.5rem 1rem' : '2rem 1.5rem'
    const minHeight = compact ? 180 : 220

    const alignItems = layout === 'left-aligned' ? 'flex-start' : layout === 'split' ? 'flex-start' : 'center'
    const textAlign = layout === 'left-aligned' ? 'left' as const : layout === 'split' ? 'left' as const : 'center' as const

    return (
        <div style={{
            background: backgroundGradient || backgroundColor,
            position: 'relative',
            overflow: 'hidden',
            ...borderCSS,
        }}>
            {/* Top motif decoration */}
            <div style={getMotifDecoration(decorativeMotif, accentColor, 'top')} />

            <div style={{
                padding,
                minHeight,
                display: layout === 'split' ? 'flex' : 'flex',
                flexDirection: layout === 'split' ? 'row' : 'column',
                justifyContent: 'center',
                alignItems,
                textAlign,
                gap: layout === 'split' ? '1.5rem' : compact ? '0.4rem' : '0.6rem',
                fontFamily: font,
                position: 'relative',
                zIndex: 1,
            }}>
                {layout === 'split' && (
                    <div style={{ fontSize: compact ? '2rem' : '2.8rem', flexShrink: 0 }}>
                        {motifEmoji}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '0.3rem' : '0.5rem', alignItems: layout === 'split' ? 'flex-start' : alignItems }}>
                    {layout !== 'split' && (
                        <div style={{ fontSize: compact ? '1.5rem' : '2rem', marginBottom: compact ? '0.1rem' : '0.2rem' }}>
                            {motifEmoji}
                        </div>
                    )}

                    <div style={{
                        fontSize: compact ? '1rem' : '1.3rem',
                        fontWeight: 800,
                        color: headingColor,
                        lineHeight: 1.3,
                        fontFamily: fontFamily === 'display' ? "'Fredoka One', cursive" : font,
                    }}>
                        {headerText}
                    </div>

                    <div style={{
                        fontSize: compact ? '0.72rem' : '0.82rem',
                        color: textColor,
                        lineHeight: 1.6,
                        maxWidth: compact ? 220 : 280,
                    }}>
                        {bodyText}
                    </div>

                    <div style={{
                        fontSize: compact ? '0.65rem' : '0.75rem',
                        fontWeight: 700,
                        color: textColor,
                        opacity: 0.6,
                        marginTop: compact ? '0.2rem' : '0.3rem',
                    }}>
                        {footerText}
                    </div>
                </div>
            </div>

            {/* Bottom motif decoration */}
            <div style={getMotifDecoration(decorativeMotif, accentColor, 'bottom')} />
        </div>
    )
}

export type { InvitationDesign }
