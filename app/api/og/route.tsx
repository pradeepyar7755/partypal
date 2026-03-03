import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const title = searchParams.get('title') || 'You\'re Invited!'
    const date = searchParams.get('date') || ''
    const time = searchParams.get('time') || ''
    const location = searchParams.get('location') || ''
    const host = searchParams.get('host') || ''
    const image = searchParams.get('image') || ''

    // Format date nicely
    let formattedDate = date
    if (date) {
        try {
            formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
            })
        } catch {
            formattedDate = date
        }
    }

    // Build detail line
    const details: string[] = []
    if (formattedDate) details.push(`📅 ${formattedDate}`)
    if (time) details.push(`⏰ ${time}`)
    if (location) details.push(`📍 ${location}`)
    if (host) details.push(`🎉 Hosted by ${host}`)

    if (image) {
        // Photo-forward layout: cover photo with overlay
        return new ImageResponse(
            (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        position: 'relative',
                    }}
                >
                    {/* Background image */}
                    <img
                        src={image}
                        alt=""
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                    {/* Dark gradient overlay */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '55%',
                            display: 'flex',
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.85))',
                        }}
                    />
                    {/* Content at bottom */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            padding: '40px 50px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                        }}
                    >
                        <div
                            style={{
                                fontSize: 48,
                                fontWeight: 800,
                                color: '#ffffff',
                                textShadow: '0 2px 12px rgba(0,0,0,0.5)',
                                lineHeight: 1.1,
                            }}
                        >
                            {title}
                        </div>
                        <div
                            style={{
                                fontSize: 24,
                                fontWeight: 600,
                                color: 'rgba(255,255,255,0.9)',
                                display: 'flex',
                                gap: '20px',
                                flexWrap: 'wrap',
                            }}
                        >
                            {details.map((d, i) => (
                                <span key={i}>{d}</span>
                            ))}
                        </div>
                    </div>
                    {/* Subtle branding */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 20,
                            right: 25,
                            fontSize: 18,
                            fontWeight: 700,
                            color: 'rgba(255,255,255,0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        <img src="https://partypal.social/logo.png" alt="" width="24" height="24" style={{ borderRadius: 4 }} /> PartyPal
                    </div>
                </div>
            ),
            { width: 1200, height: 630 }
        )
    }

    // Fallback: branded gradient card (no cover photo)
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: '#ffffff',
                    padding: '60px',
                    position: 'relative',
                }}
            >
                {/* Decorative accents */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '350px',
                        height: '350px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(74,173,168,0.15) 0%, transparent 70%)',
                        display: 'flex',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: '300px',
                        height: '300px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(247,201,72,0.12) 0%, transparent 70%)',
                        display: 'flex',
                    }}
                />

                {/* Emoji */}
                <div style={{ fontSize: 72, marginBottom: '16px', display: 'flex' }}>🎉</div>

                {/* Title */}
                <div
                    style={{
                        fontSize: 52,
                        fontWeight: 800,
                        color: '#1a2535',
                        textAlign: 'center',
                        lineHeight: 1.15,
                        marginBottom: '20px',
                        maxWidth: '900px',
                    }}
                >
                    {title}
                </div>

                {/* Details */}
                <div
                    style={{
                        display: 'flex',
                        gap: '24px',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        fontSize: 22,
                        fontWeight: 600,
                        color: '#6b7f94',
                    }}
                >
                    {details.map((d, i) => (
                        <span key={i}>{d}</span>
                    ))}
                </div>

                {/* Tap to RSVP pill */}
                <div
                    style={{
                        marginTop: '30px',
                        padding: '12px 36px',
                        borderRadius: '50px',
                        background: 'linear-gradient(135deg, #4AADA8, #3D8C6E)',
                        color: '#fff',
                        fontSize: 22,
                        fontWeight: 800,
                        display: 'flex',
                    }}
                >
                    Tap to RSVP →
                </div>

                {/* Branding */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 20,
                        right: 30,
                        fontSize: 16,
                        fontWeight: 700,
                        color: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}
                >
                    <img src="https://partypal.social/logo.png" alt="" width="20" height="20" style={{ borderRadius: 3 }} /> PartyPal
                </div>
            </div>
        ),
        { width: 1200, height: 630 }
    )
}
