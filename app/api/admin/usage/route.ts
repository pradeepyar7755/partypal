import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { getUsageStats } from '@/lib/rate-limiter'

export async function GET(req: NextRequest) {
    const admin = await verifyAdmin(req.headers.get('authorization'))
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const stats = await getUsageStats()
        return NextResponse.json(stats)
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
