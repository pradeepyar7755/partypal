'use client'
import Link from 'next/link'
import styles from '../privacy/privacy.module.css'
import { SITE_EMAILS } from '@/lib/constants'

export default function About() {
    return (
        <main className={styles.privacyPage}>
            <div className={styles.inner}>
                {/* Header */}
                <div className={styles.badge}>About Us</div>
                <h1 className={styles.title}>
                    About <em>PartyPal</em>
                </h1>
                <p className={styles.subtitle}>
                    The AI-powered party planning platform that helps you create unforgettable celebrations — from the first idea to the last dance.
                </p>

                <section className={styles.section}>
                    <div className={styles.sectionIcon}>🎯</div>
                    <h2 className={styles.sectionTitle}>Our Mission</h2>
                    <p>
                        Planning a party should be exciting, not stressful. PartyPal was built to take the
                        guesswork out of event planning by combining artificial intelligence with practical
                        tools that anyone can use. Whether you&apos;re throwing a backyard barbecue or organizing
                        a wedding, PartyPal gives you a custom plan, connects you with local vendors, and
                        keeps everything organized in one place.
                    </p>
                </section>

                <section className={styles.section}>
                    <div className={styles.sectionIcon}>🛠️</div>
                    <h2 className={styles.sectionTitle}>What We Do</h2>
                    <div className={styles.usageGrid}>
                        <div className={styles.usageCard}>
                            <span className={styles.usageEmoji}>🤖</span>
                            <h4>AI Party Plans</h4>
                            <p>Tell us your event type, date, guest count, budget, and theme. Our AI generates a personalized plan with a timeline, checklist, budget breakdown, and vendor suggestions in seconds.</p>
                        </div>
                        <div className={styles.usageCard}>
                            <span className={styles.usageEmoji}>🛍️</span>
                            <h4>Vendor Marketplace</h4>
                            <p>Browse venues, caterers, photographers, florists, DJs, and more near your event location. Filter by category and get real reviews, pricing, and contact info.</p>
                        </div>
                        <div className={styles.usageCard}>
                            <span className={styles.usageEmoji}>💌</span>
                            <h4>Guest Management</h4>
                            <p>Add guests, send digital invitations, track RSVPs in real time, and collect dietary preferences and plus-one details — all from your dashboard.</p>
                        </div>
                        <div className={styles.usageCard}>
                            <span className={styles.usageEmoji}>💰</span>
                            <h4>Budget Tracking</h4>
                            <p>Set a total budget and track spending across categories. Our AI allocates your budget intelligently and updates as you add vendors and expenses.</p>
                        </div>
                        <div className={styles.usageCard}>
                            <span className={styles.usageEmoji}>🎨</span>
                            <h4>Mood Boards</h4>
                            <p>Get AI-generated color palettes, decor ideas, tablescape concepts, lighting suggestions, and a custom hashtag based on your event theme.</p>
                        </div>
                        <div className={styles.usageCard}>
                            <span className={styles.usageEmoji}>🤝</span>
                            <h4>Collaboration</h4>
                            <p>Invite co-hosts to help plan. Share events, delegate tasks, and work together on budgets and guest lists in real time.</p>
                        </div>
                    </div>
                </section>

                <section className={styles.section}>
                    <div className={styles.sectionIcon}>💡</div>
                    <h2 className={styles.sectionTitle}>How It Works</h2>
                    <div className={styles.deletionSteps}>
                        <div className={styles.deletionStep}>
                            <div className={styles.stepNumber}>1</div>
                            <div>
                                <h4>Describe Your Event</h4>
                                <p>Tell us what you&apos;re planning — birthday, wedding, baby shower, game night, corporate event, or anything else. Add your date, location, guest count, theme, and budget.</p>
                            </div>
                        </div>
                        <div className={styles.deletionStep}>
                            <div className={styles.stepNumber}>2</div>
                            <div>
                                <h4>Get Your AI Plan</h4>
                                <p>Our AI generates a complete party plan with a week-by-week timeline, actionable checklist, budget allocation, vendor recommendations, and pro tips.</p>
                            </div>
                        </div>
                        <div className={styles.deletionStep}>
                            <div className={styles.stepNumber}>3</div>
                            <div>
                                <h4>Manage Everything</h4>
                                <p>Use your dashboard to track tasks, manage guests and RSVPs, browse and shortlist vendors, monitor your budget, and collaborate with co-hosts.</p>
                            </div>
                        </div>
                        <div className={styles.deletionStep}>
                            <div className={styles.stepNumber}>4</div>
                            <div>
                                <h4>Enjoy the Party</h4>
                                <p>With everything planned and organized, you can focus on what matters — celebrating with the people you love.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className={styles.section}>
                    <div className={styles.sectionIcon}>🌟</div>
                    <h2 className={styles.sectionTitle}>Why PartyPal?</h2>
                    <div className={styles.dataCard}>
                        <ul>
                            <li><strong>Free to use</strong> — all core features are available at no cost</li>
                            <li><strong>No downloads required</strong> — works in your browser on any device, with optional native apps for iOS and Android</li>
                            <li><strong>AI-powered</strong> — get a complete, personalized party plan in under 30 seconds</li>
                            <li><strong>All-in-one platform</strong> — planning, guests, vendors, budget, and collaboration in a single dashboard</li>
                            <li><strong>Privacy-first</strong> — your data is never sold and your behavioral preferences stay in your browser</li>
                            <li><strong>Works for any event</strong> — from intimate dinners to large weddings, any celebration you can imagine</li>
                        </ul>
                    </div>
                </section>

                <section className={styles.section}>
                    <div className={styles.sectionIcon}>📬</div>
                    <h2 className={styles.sectionTitle}>Get in Touch</h2>
                    <p>
                        Have questions, feedback, or partnership inquiries? We&apos;d love to hear from you.
                    </p>
                    <div className={styles.contactCard}>
                        <p><strong>Support:</strong> <a href={`mailto:${SITE_EMAILS.support}`}>{SITE_EMAILS.support}</a></p>
                        <p><strong>General:</strong> <a href={`mailto:${SITE_EMAILS.info}`}>{SITE_EMAILS.info}</a></p>
                        <p><strong>Website:</strong> <Link href="/contact">Contact Us Page</Link></p>
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
