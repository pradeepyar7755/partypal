/**
 * User-scoped localStorage helper.
 * Prefixes all keys with user uid so each user has isolated data.
 */

let _uid: string | null = null

export function setStorageUid(uid: string | null) {
    _uid = uid
}

function scopedKey(key: string): string {
    return _uid ? `${_uid}_${key}` : key
}

export function userGet(key: string): string | null {
    return localStorage.getItem(scopedKey(key))
}

export function userSet(key: string, value: string): void {
    localStorage.setItem(scopedKey(key), value)
}

export function userRemove(key: string): void {
    localStorage.removeItem(scopedKey(key))
}

/** Parse JSON from user-scoped storage, with fallback */
export function userGetJSON<T>(key: string, fallback: T): T {
    const raw = userGet(key)
    if (!raw) return fallback
    try { return JSON.parse(raw) } catch { return fallback }
}

export function userSetJSON(key: string, value: unknown): void {
    userSet(key, JSON.stringify(value))
}
