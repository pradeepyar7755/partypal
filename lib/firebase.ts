import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'

let app: App
let db: Firestore

function getDb(): Firestore {
    if (!db) {
        if (getApps().length === 0) {
            const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
            if (serviceAccount) {
                app = initializeApp({
                    credential: cert(JSON.parse(serviceAccount)),
                })
            } else {
                app = initializeApp({
                    projectId: process.env.FIREBASE_PROJECT_ID || 'party-pal-488618',
                })
            }
        } else {
            app = getApps()[0]
        }
        db = getFirestore(app, 'partypal')
    }
    return db
}

export { getDb }
