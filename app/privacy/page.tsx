'use client'
import Link from 'next/link'
import styles from './privacy.module.css'

export default function PrivacyPolicy() {
    return (
        <main className={styles.privacyPage}>
            <div className={styles.inner}>
                {/* Header */}
                <div className={styles.badge}>🔒 Privacy Policy</div>
                <h1 className={styles.title}>
                    Your Privacy <em>Matters</em>
                </h1>
                <p className={styles.subtitle}>
                    We believe party planning should be fun — not worrying about your data.
                    Here&apos;s exactly how we handle your information.
                </p>
                <p className={styles.effective}>
                    Effective Date: February 28, 2026 · Last Updated: February 28, 2026
                </p>

                {/* Table of Contents */}
                <div className={styles.toc}>
                    <div className={styles.tocTitle}>📑 Quick Navigation</div>
                    <div className={styles.tocLinks}>
                        <a href="#data-we-collect">Data We Collect</a>
                        <a href="#how-we-use">How We Use Your Data</a>
                        <a href="#ai-privacy">AI & Your Privacy</a>
                        <a href="#data-storage">Data Storage & Security</a>
                        <a href="#analytics">Analytics & Cookies</a>
                        <a href="#your-rights">Your Rights</a>
                        <a href="#account-deletion">Account Deletion</a>
                        <a href="#third-party">Third-Party Services</a>
                        <a href="#children">Children&apos;s Privacy</a>
                        <a href="#changes">Policy Changes</a>
                        <a href="#contact">Contact Us</a>
                    </div>
                </div>

                {/* Sections */}
                <section id="data-we-collect" className={styles.section}>
                    <div className={styles.sectionIcon}>📋</div>
                    <h2 className={styles.sectionTitle}>Data We Collect</h2>
                    <p>We collect only the data necessary to provide you with a great party planning experience:</p>

                    <div className={styles.dataCard}>
                        <h3>🔐 Account Information</h3>
                        <ul>
                            <li><strong>Email address</strong> — used for login and optional notifications</li>
                            <li><strong>Display name</strong> — shown to collaborators you invite</li>
                            <li><strong>Authentication method</strong> — Google or email/password</li>
                        </ul>
                    </div>

                    <div className={styles.dataCard}>
                        <h3>🎉 Event Data</h3>
                        <ul>
                            <li><strong>Event details</strong> — event type, date, location, guest count, theme, budget</li>
                            <li><strong>Guest lists</strong> — names, email addresses, RSVP statuses, dietary restrictions</li>
                            <li><strong>AI-generated plans</strong> — timelines, vendor suggestions, budget breakdowns</li>
                            <li><strong>Moodboards & themes</strong> — color palettes, style preferences</li>
                        </ul>
                    </div>

                    <div className={styles.dataCard}>
                        <h3>📊 Usage Data</h3>
                        <ul>
                            <li><strong>Page views & navigation</strong> — which pages you visit (anonymized)</li>
                            <li><strong>Feature usage</strong> — which tools you engage with most</li>
                            <li><strong>Session data</strong> — duration and frequency of visits</li>
                            <li><strong>Error logs</strong> — technical errors to improve the platform</li>
                        </ul>
                    </div>
                </section>

                <section id="how-we-use" className={styles.section}>
                    <div className={styles.sectionIcon}>⚙️</div>
                    <h2 className={styles.sectionTitle}>How We Use Your Data</h2>
                    <div className={styles.usageGrid}>
                        <div className={styles.usageCard}>
                            <span className={styles.usageEmoji}>🎊</span>
                            <h4>Provide Services</h4>
                            <p>Store your events, generate AI plans, manage guests, and facilitate RSVPs.</p>
                        </div>
                        <div className={styles.usageCard}>
                            <span className={styles.usageEmoji}>🧠</span>
                            <h4>Personalize AI</h4>
                            <p>Your event data (stored in your account) helps AI generate tailored plans and recommendations. Additionally, behavioral preferences are learned locally in your browser.</p>
                        </div>
                        <div className={styles.usageCard}>
                            <span className={styles.usageEmoji}>🔧</span>
                            <h4>Improve Platform</h4>
                            <p>Aggregated, anonymized usage data helps us build better features.</p>
                        </div>
                        <div className={styles.usageCard}>
                            <span className={styles.usageEmoji}>🛡️</span>
                            <h4>Security</h4>
                            <p>Monitor for errors, abuse, and unauthorized access to protect your account.</p>
                        </div>
                    </div>
                </section>

                <section id="ai-privacy" className={styles.section}>
                    <div className={styles.sectionIcon}>🤖</div>
                    <h2 className={styles.sectionTitle}>AI & Your Privacy</h2>
                    <p>PartyPal uses AI to generate party plans, vendor suggestions, and personalized recommendations. Your AI experience is powered by two types of data:</p>

                    <div className={styles.highlight}>
                        <div className={styles.highlightIcon}>☁️</div>
                        <div>
                            <h4>Event Data Powers Recommendations</h4>
                            <p>
                                Your event details (event type, date, guest count, budget, theme, guest lists) are
                                stored <strong>securely in your PartyPal account</strong> on our servers. The AI uses
                                this context to generate personalized plans, vendor suggestions, and recommendations
                                tailored to your specific event. This data is accessible only to you (and any collaborators
                                you invite) and is deleted when you delete your account.
                            </p>
                        </div>
                    </div>

                    <div className={styles.highlight}>
                        <div className={styles.highlightIcon}>💻</div>
                        <div>
                            <h4>Behavioral Preferences Stay Local</h4>
                            <p>
                                As you interact with PartyPal, the app learns your style preferences
                                (planning style, budget tendency, tone preference, favorite categories).
                                These behavioral signals are stored <strong>exclusively in your browser&apos;s
                                    local storage</strong> and are never sent to our servers. Even admins cannot access this data.
                            </p>
                        </div>
                    </div>

                    <div className={styles.highlight}>
                        <div className={styles.highlightIcon}>🚫</div>
                        <div>
                            <h4>Your Data is Never Shared</h4>
                            <p>
                                Neither your event data nor your behavioral preferences are shared with other users,
                                sold to third parties, or used to build advertising profiles.
                                Admins can see <strong>aggregate analytics only</strong> (total events, page views) —
                                never individual event details or personal context.
                            </p>
                        </div>
                    </div>

                    <div className={styles.highlight}>
                        <div className={styles.highlightIcon}>📡</div>
                        <div>
                            <h4>AI Request Processing</h4>
                            <p>
                                When you generate a plan or use AI features, your event details are sent to <strong>Google
                                    Gemini AI</strong> to generate responses. This data is processed to fulfill your request
                                and is subject to <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Google&apos;s AI terms</a>.
                                We do not use your data to train custom AI models.
                            </p>
                        </div>
                    </div>
                </section>

                <section id="data-storage" className={styles.section}>
                    <div className={styles.sectionIcon}>🏗️</div>
                    <h2 className={styles.sectionTitle}>Data Storage & Security</h2>

                    <div className={styles.storageGrid}>
                        <div className={styles.storageCard}>
                            <h4>☁️ Cloud Storage</h4>
                            <p>
                                Account data, events, and guest lists are stored securely in <strong>Google Firebase / Firestore</strong>,
                                which provides enterprise-grade encryption at rest and in transit (TLS 1.2+).
                            </p>
                        </div>
                        <div className={styles.storageCard}>
                            <h4>💻 Browser Storage</h4>
                            <p>
                                Some data is also cached in your <strong>browser&apos;s local storage</strong> for
                                performance and offline access, including AI behavioral preferences, vendor shortlists,
                                and planning checklists. This cached data supplements — but does not replace — the
                                server-side copies.
                            </p>
                        </div>
                        <div className={styles.storageCard}>
                            <h4>🔑 Authentication</h4>
                            <p>
                                Passwords are <strong>never stored</strong> by PartyPal. Authentication is handled entirely
                                by Firebase Authentication using industry-standard hashing and secure token management.
                            </p>
                        </div>
                        <div className={styles.storageCard}>
                            <h4>🌐 Data Location</h4>
                            <p>
                                All data is stored and processed in <strong>United States</strong> data centers
                                operated by Google Cloud Platform.
                            </p>
                        </div>
                    </div>
                </section>

                <section id="analytics" className={styles.section}>
                    <div className={styles.sectionIcon}>📈</div>
                    <h2 className={styles.sectionTitle}>Analytics & Cookies</h2>

                    <p>We use a <strong>first-party analytics system</strong> — we do not use Google Analytics, Facebook Pixel, or any third-party tracking scripts.</p>

                    <div className={styles.dataCard}>
                        <h3>What we track</h3>
                        <ul>
                            <li>Page views and navigation patterns (anonymized after aggregation)</li>
                            <li>Feature usage counts (plan generation, vendor searches, etc.)</li>
                            <li>Error occurrences for debugging</li>
                            <li>Session-level engagement metrics</li>
                        </ul>
                    </div>

                    <div className={styles.dataCard}>
                        <h3>What we DON&apos;T track</h3>
                        <ul>
                            <li>❌ No third-party advertising cookies</li>
                            <li>❌ No cross-site tracking</li>
                            <li>❌ No fingerprinting</li>
                            <li>❌ No selling data to third parties</li>
                            <li>❌ No sharing data with advertisers</li>
                        </ul>
                    </div>

                    <p className={styles.note}>
                        We use essential cookies only for authentication session management via Firebase Auth.
                        No tracking cookies are deployed.
                    </p>
                </section>

                <section id="your-rights" className={styles.section}>
                    <div className={styles.sectionIcon}>⚖️</div>
                    <h2 className={styles.sectionTitle}>Your Rights</h2>
                    <p>You have full control over your data:</p>

                    <div className={styles.rightsGrid}>
                        <div className={styles.rightCard}>
                            <span>👁️</span>
                            <h4>Access</h4>
                            <p>View all data associated with your account at any time through your dashboard.</p>
                        </div>
                        <div className={styles.rightCard}>
                            <span>✏️</span>
                            <h4>Correction</h4>
                            <p>Edit or update your event details, guest information, and profile at any time.</p>
                        </div>
                        <div className={styles.rightCard}>
                            <span>📤</span>
                            <h4>Portability</h4>
                            <p>Request a copy of your data in a standard format by contacting us.</p>
                        </div>
                        <div className={styles.rightCard}>
                            <span>🗑️</span>
                            <h4>Deletion</h4>
                            <p>Delete your account and all associated personal data permanently.</p>
                        </div>
                        <div className={styles.rightCard}>
                            <span>🚫</span>
                            <h4>Objection</h4>
                            <p>Object to data processing by contacting us — we&apos;ll honor your request.</p>
                        </div>
                        <div className={styles.rightCard}>
                            <span>🔕</span>
                            <h4>Withdraw Consent</h4>
                            <p>Opt out of optional communications at any time via your account settings.</p>
                        </div>
                    </div>
                </section>

                <section id="account-deletion" className={styles.section}>
                    <div className={styles.sectionIcon}>🗑️</div>
                    <h2 className={styles.sectionTitle}>Account Deletion</h2>
                    <p>You can delete your account at any time from your profile dropdown menu. Here&apos;s exactly what happens:</p>

                    <div className={styles.deletionSteps}>
                        <div className={styles.deletionStep}>
                            <div className={styles.stepNumber}>1</div>
                            <div>
                                <h4>Personal Data Removed</h4>
                                <p>Your profile, email, display name, and authentication credentials are permanently deleted.</p>
                            </div>
                        </div>
                        <div className={styles.deletionStep}>
                            <div className={styles.stepNumber}>2</div>
                            <div>
                                <h4>Events Deleted</h4>
                                <p>All events you created, including guest lists, RSVPs, plans, and associated data are permanently removed.</p>
                            </div>
                        </div>
                        <div className={styles.deletionStep}>
                            <div className={styles.stepNumber}>3</div>
                            <div>
                                <h4>AI Context Erased</h4>
                                <p>Your PartyPal AI preferences — learned from your in-app interactions — are cleared from your browser. Since these were never sent to our servers, no server-side cleanup is needed.</p>
                            </div>
                        </div>
                        <div className={styles.deletionStep}>
                            <div className={styles.stepNumber}>4</div>
                            <div>
                                <h4>Analytics Preserved (Anonymized)</h4>
                                <p>
                                    Aggregated analytics data (daily page view counts, feature usage counts) is retained in anonymized form.
                                    Your user ID is removed from individual analytics entries. This anonymized data cannot be linked back to you
                                    and is used solely for platform improvement.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className={styles.note}>
                        ⚠️ Account deletion is <strong>immediate and irreversible</strong>. We cannot recover your data after deletion.
                        Please export any important information before proceeding.
                    </div>
                </section>

                <section id="third-party" className={styles.section}>
                    <div className={styles.sectionIcon}>🔗</div>
                    <h2 className={styles.sectionTitle}>Third-Party Services</h2>
                    <p>We use the following trusted third-party services:</p>

                    <div className={styles.thirdPartyGrid}>
                        <div className={styles.thirdPartyCard}>
                            <strong>Firebase (Google)</strong>
                            <p>Authentication, database, and hosting. <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy →</a></p>
                        </div>
                        <div className={styles.thirdPartyCard}>
                            <strong>Google Gemini AI</strong>
                            <p>AI-powered plan generation, guest invitations, and vendor summaries. <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Terms →</a></p>
                        </div>
                        <div className={styles.thirdPartyCard}>
                            <strong>Vercel</strong>
                            <p>Website hosting and deployment. <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy →</a></p>
                        </div>
                        <div className={styles.thirdPartyCard}>
                            <strong>Google Maps</strong>
                            <p>Location search for venues. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy →</a></p>
                        </div>
                    </div>
                </section>

                <section id="children" className={styles.section}>
                    <div className={styles.sectionIcon}>👶</div>
                    <h2 className={styles.sectionTitle}>Children&apos;s Privacy</h2>
                    <p>
                        PartyPal is not intended for children under the age of 13. We do not knowingly collect personal
                        information from children under 13. If we discover that a child under 13 has provided us with
                        personal information, we will promptly delete it. If you believe a child has provided us with
                        personal data, please contact us.
                    </p>
                </section>

                <section id="changes" className={styles.section}>
                    <div className={styles.sectionIcon}>📝</div>
                    <h2 className={styles.sectionTitle}>Policy Changes</h2>
                    <p>
                        We may update this Privacy Policy from time to time. When we make significant changes,
                        we will notify users through a banner on the website and update the &quot;Last Updated&quot; date
                        at the top of this page. We encourage you to review this policy periodically.
                    </p>
                </section>

                <section id="contact" className={styles.section}>
                    <div className={styles.sectionIcon}>📬</div>
                    <h2 className={styles.sectionTitle}>Contact Us</h2>
                    <p>If you have any questions about this Privacy Policy or your data, please contact us:</p>

                    <div className={styles.contactCard}>
                        <p>📧 <strong>Email:</strong> <a href="mailto:privacy@partypal.social">privacy@partypal.social</a></p>
                        <p>🌐 <strong>Website:</strong> <Link href="/contact">Contact Us Page</Link></p>
                    </div>
                </section>

                {/* Footer */}
                <div className={styles.footer}>
                    <Link href="/" className={styles.backLink}>← Back to PartyPal</Link>
                </div>
            </div>
        </main>
    )
}
