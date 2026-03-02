import { NextResponse } from 'next/server'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

export async function GET() {
    try {
        const docsDir = join(process.cwd(), 'docs')
        const files = readdirSync(docsDir)
            .filter(f => f.endsWith('.md'))
            .sort()

        const docs = files.map(file => {
            const content = readFileSync(join(docsDir, file), 'utf-8')
            // Extract title from first # heading
            const titleMatch = content.match(/^#\s+(.+)/m)
            const title = titleMatch ? titleMatch[1].replace(/^PartyPal\s*—\s*/, '') : file.replace('.md', '')
            // Strip the "PartyPal —" prefix from the title for tab display
            const shortTitle = title
                .replace(/Product Specification/, 'Product Specs')
                .replace(/Implementation Plan/, 'Implementation Plan')
                .replace(/Functional Design/, 'Functional Design')
                .replace(/Technical Design/, 'Technical Design')
                .replace(/Agentic Workflow/, 'Agentic Workflow')
                .replace(/Claude Skill.*/, 'Claude Skill')
                .replace(/Resource Usage/, 'Resource Usage')
            return {
                id: file.replace('.md', ''),
                title: shortTitle,
                filename: file,
                content,
            }
        })

        return NextResponse.json({ docs })
    } catch (error) {
        console.error('Docs API error:', error)
        return NextResponse.json({ error: 'Failed to load docs' }, { status: 500 })
    }
}
