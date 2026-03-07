import { vi } from 'vitest'

// Mock Firebase Admin SDK
vi.mock('@/lib/firebase', () => ({
  getDb: vi.fn(),
}))

// Mock environment variables
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
process.env.NEXT_PUBLIC_DOMAIN = 'partypal.social'
process.env.FIREBASE_PROJECT_ID = 'test-project'
process.env.GEMINI_API_KEY = 'test-gemini-key'
process.env.RESEND_API_KEY = 'test-resend-key'
process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key'
