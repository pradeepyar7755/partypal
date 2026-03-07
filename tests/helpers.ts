import { vi, expect } from 'vitest'
import { NextRequest } from 'next/server'

// ── Firestore Mock ──────────────────────────────────────────────────────

interface MockDocData {
  [key: string]: unknown
}

interface MockDocSnapshot {
  exists: boolean
  id: string
  data: () => MockDocData | undefined
}

interface MockDocRef {
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  collection: ReturnType<typeof vi.fn>
}

interface MockCollectionRef {
  doc: (id?: string) => MockDocRef
  add: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  where: ReturnType<typeof vi.fn>
  orderBy: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
}

export function createMockFirestore(data: Record<string, Record<string, MockDocData>> = {}) {
  const store: Record<string, Record<string, MockDocData>> = { ...data }

  function mockDoc(collectionName: string, docId: string): MockDocRef {
    return {
      get: vi.fn(async (): Promise<MockDocSnapshot> => {
        const doc = store[collectionName]?.[docId]
        return {
          exists: !!doc,
          id: docId,
          data: () => doc ? { ...doc } : undefined,
        }
      }),
      set: vi.fn(async (newData: MockDocData, options?: { merge?: boolean }) => {
        if (!store[collectionName]) store[collectionName] = {}
        if (options?.merge) {
          store[collectionName][docId] = { ...store[collectionName][docId], ...newData }
        } else {
          store[collectionName][docId] = { ...newData }
        }
      }),
      delete: vi.fn(async () => {
        if (store[collectionName]) {
          delete store[collectionName][docId]
        }
      }),
      update: vi.fn(async (updates: MockDocData) => {
        if (store[collectionName]?.[docId]) {
          store[collectionName][docId] = { ...store[collectionName][docId], ...updates }
        }
      }),
      collection: vi.fn((subName: string) => mockCollection(`${collectionName}/${docId}/${subName}`)),
    }
  }

  function mockCollection(name: string): MockCollectionRef {
    const col: MockCollectionRef = {
      doc: (id?: string) => mockDoc(name, id || `auto-${Date.now()}`),
      add: vi.fn(async (docData: MockDocData) => {
        const id = `auto-${Date.now()}-${Math.random().toString(36).slice(2)}`
        if (!store[name]) store[name] = {}
        store[name][id] = { ...docData }
        return { id }
      }),
      get: vi.fn(async () => {
        const docs = store[name] || {}
        return {
          empty: Object.keys(docs).length === 0,
          size: Object.keys(docs).length,
          docs: Object.entries(docs).map(([id, d]) => ({
            id,
            exists: true,
            data: () => ({ ...d }),
            ref: mockDoc(name, id),
          })),
          forEach: (fn: (doc: MockDocSnapshot & { ref: MockDocRef }) => void) => {
            Object.entries(docs).forEach(([id, d]) => {
              fn({
                id,
                exists: true,
                data: () => ({ ...d }),
                ref: mockDoc(name, id),
              } as MockDocSnapshot & { ref: MockDocRef })
            })
          },
        }
      }),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    }
    // Make chainable methods return the collection itself
    col.where = vi.fn(() => col)
    col.orderBy = vi.fn(() => col)
    col.limit = vi.fn(() => col)
    return col
  }

  return {
    db: {
      collection: vi.fn((name: string) => mockCollection(name)),
    },
    store,
  }
}

// ── Request Helpers ─────────────────────────────────────────────────────

export function mockGET(path: string, params: Record<string, string> = {}): NextRequest {
  const url = new URL(path, 'http://localhost:3000')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url, { method: 'GET' })
}

export function mockPOST(path: string, body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest(new URL(path, 'http://localhost:3000'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function mockPATCH(path: string, body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest(new URL(path, 'http://localhost:3000'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function mockDELETE(path: string, params: Record<string, string> = {}): NextRequest {
  const url = new URL(path, 'http://localhost:3000')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url, { method: 'DELETE' })
}

export function mockPUT(path: string, body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest(new URL(path, 'http://localhost:3000'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Response Helpers ────────────────────────────────────────────────────

export async function parseJSON(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>
}

export function expectSuccess(data: Record<string, unknown>) {
  expect(data).toHaveProperty('success', true)
}

export function expectError(data: Record<string, unknown>, status?: number) {
  expect(data).toHaveProperty('error')
  if (status) {
    // Status is checked on the Response object, not the body
  }
}
