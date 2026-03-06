'use client'
import Link from 'next/link'
import styles from '../privacy/privacy.module.css'
import { SITE_EMAILS } from '@/lib/constants'

export default function TermsOfService() {
    return (
        <main className={styles.privacyPage}>
            <div className={styles.inner}>
                {/* Header */}
                <div className={styles.badge}>Terms of Service</div>
                <h1 className={styles.title}>
                    Terms of <em>Service</em>
                </h1>
                <p className={styles.subtitle}>
                    By using PartyPal, you agree to these terms. Please read them carefully before creating an account or using our services.
                </p>
                <p className={styles.effective}>
                    Effective Date: March 6, 2026 · Last Updated: March 6, 2026
                </p>

                {/* Table of Contents */}
                <div className={styles.toc}>
                    <div className={styles.tocTitle}>Quick Navigation</div>
                    <div className={styles.tocLinks}>
                        <a href="#acceptance">Acceptance</a>
                        <a href="#eligibility">Eligibility</a>
                        <a href="#accounts">Accounts</a>
                        <a href="#acceptable-use">Acceptable Use</a>
                        <a href="#intellectual-property">Intellectual Property</a>
                        <a href="#ai-services">AI Services</a>
                        <a href="#user-content">User Content</a>
                        <a href="#third-party">Third-Party Services</a>
                        <a href="#disclaimers">Disclaimers</a>
                        <a href="#limitation">Limitation of Liability</a>
                        <a href="#termination">Termination</a>
                        <a href="#changes">Changes to Terms</a>
                        <a href="#contact">Contact</a>
                    </div>
                </div>

                {/* Sections */}
                <section id="acceptance" className={styles.section}>
                    <h2 className={styles.sectionTitle}>1. Acceptance of Terms</h2>
                    <p>
                        By accessing or using PartyPal (&quot;the Service&quot;), operated at partypal.social,
                        you agree to be bound by these Terms of Service. If you do not agree to these terms,
                        you may not use the Service.
                    </p>
                    <p>
                        These terms apply to all visitors, users, and others who access or use the Service,
                        whether through our website or our mobile applications.
                    </p>
                </section>

                <section id="eligibility" className={styles.section}>
                    <h2 className={styles.sectionTitle}>2. Eligibility</h2>
                    <p>
                        You must be at least 13 years of age to use the Service. By using PartyPal, you
                        represent and warrant that you are at least 13 years old. If you are under 18,
                        you represent that you have your parent or guardian&apos;s permission to use the Service.
                    </p>
                </section>

                <section id="accounts" className={styles.section}>
                    <h2 className={styles.sectionTitle}>3. Accounts</h2>
                    <p>
                        When you create an account with us, you must provide accurate and complete information.
                        You are responsible for safeguarding your account credentials and for all activities
                        that occur under your account.
                    </p>
                    <div className={styles.dataCard}>
                        <h3>Your Responsibilities</h3>
                        <ul>
                            <li>Maintain accurate account information</li>
                            <li>Keep your login credentials secure</li>
                            <li>Notify us immediately of any unauthorized access</li>
                            <li>You are responsible for all activity under your account</li>
                        </ul>
                    </div>
                    <p>
                        PartyPal allows guest access without an account. Guest data is stored locally in
                        your browser and may be lost if you clear browser data. Creating an account enables
                        cloud sync and cross-device access.
                    </p>
                </section>

                <section id="acceptable-use" className={styles.section}>
                    <h2 className={styles.sectionTitle}>4. Acceptable Use</h2>
                    <p>You agree not to use the Service to:</p>
                    <div className={styles.dataCard}>
                        <h3>Prohibited Activities</h3>
                        <ul>
                            <li>Violate any applicable laws or regulations</li>
                            <li>Infringe on the rights of others</li>
                            <li>Upload or transmit harmful, abusive, or objectionable content</li>
                            <li>Attempt to gain unauthorized access to the Service or its systems</li>
                            <li>Interfere with or disrupt the Service or its infrastructure</li>
                            <li>Use the Service to send spam or unsolicited communications</li>
                            <li>Scrape, crawl, or use automated means to access the Service without permission</li>
                            <li>Impersonate another person or entity</li>
                        </ul>
                    </div>
                </section>

                <section id="intellectual-property" className={styles.section}>
                    <h2 className={styles.sectionTitle}>5. Intellectual Property</h2>
                    <p>
                        The Service, including its design, features, code, and content (excluding user-generated
                        content), is owned by PartyPal and protected by copyright, trademark, and other
                        intellectual property laws. You may not copy, modify, distribute, or create derivative
                        works based on the Service without our express written permission.
                    </p>
                </section>

                <section id="ai-services" className={styles.section}>
                    <h2 className={styles.sectionTitle}>6. AI-Generated Content</h2>
                    <p>
                        PartyPal uses artificial intelligence (Google Gemini) to generate party plans, vendor
                        suggestions, timelines, budgets, and other recommendations. You acknowledge that:
                    </p>
                    <div className={styles.dataCard}>
                        <h3>AI Disclaimers</h3>
                        <ul>
                            <li>AI-generated content is provided as <strong>suggestions only</strong> and should not be taken as professional advice</li>
                            <li>AI outputs may contain inaccuracies, outdated information, or unsuitable recommendations</li>
                            <li>You are responsible for verifying all AI-generated plans, vendor details, and budget estimates before acting on them</li>
                            <li>PartyPal does not guarantee the accuracy, completeness, or suitability of any AI-generated content</li>
                            <li>Vendor information (names, prices, availability) is sourced from third-party data and may not be current</li>
                        </ul>
                    </div>
                </section>

                <section id="user-content" className={styles.section}>
                    <h2 className={styles.sectionTitle}>7. User Content</h2>
                    <p>
                        You retain ownership of any content you create through the Service, including event
                        details, guest lists, and custom plans. By using the Service, you grant PartyPal a
                        limited license to store, process, and display your content solely for the purpose
                        of providing the Service to you.
                    </p>
                    <p>
                        When you share events with collaborators or send invitations to guests, you authorize
                        PartyPal to make the relevant event information accessible to those individuals.
                    </p>
                </section>

                <section id="third-party" className={styles.section}>
                    <h2 className={styles.sectionTitle}>8. Third-Party Services</h2>
                    <p>
                        The Service integrates with third-party providers including Google (Maps, Gemini AI,
                        AdSense), Firebase, Vercel, and Resend. Your use of these integrations is subject to
                        their respective terms and privacy policies. PartyPal is not responsible for the
                        practices or content of third-party services.
                    </p>
                    <p>
                        Vendor listings and recommendations are sourced from third-party data (Google Places).
                        PartyPal does not endorse, guarantee, or assume liability for any vendor, venue, or
                        service provider listed on the platform.
                    </p>
                </section>

                <section id="disclaimers" className={styles.section}>
                    <h2 className={styles.sectionTitle}>9. Disclaimers</h2>
                    <div className={styles.note}>
                        The Service is provided <strong>&quot;as is&quot;</strong> and <strong>&quot;as available&quot;</strong> without
                        warranties of any kind, whether express or implied, including but not limited to
                        implied warranties of merchantability, fitness for a particular purpose, and
                        non-infringement.
                    </div>
                    <p>
                        PartyPal does not warrant that the Service will be uninterrupted, error-free, or
                        secure. We do not guarantee any specific results from use of the Service.
                    </p>
                </section>

                <section id="limitation" className={styles.section}>
                    <h2 className={styles.sectionTitle}>10. Limitation of Liability</h2>
                    <p>
                        To the maximum extent permitted by law, PartyPal and its creators shall not be
                        liable for any indirect, incidental, special, consequential, or punitive damages,
                        or any loss of profits or revenues, whether incurred directly or indirectly, or
                        any loss of data, use, goodwill, or other intangible losses resulting from:
                    </p>
                    <div className={styles.dataCard}>
                        <ul>
                            <li>Your use or inability to use the Service</li>
                            <li>Any unauthorized access to or alteration of your data</li>
                            <li>Statements or conduct of any third party on the Service</li>
                            <li>AI-generated content or recommendations</li>
                            <li>Any vendor, venue, or service provider interactions facilitated through the Service</li>
                        </ul>
                    </div>
                </section>

                <section id="termination" className={styles.section}>
                    <h2 className={styles.sectionTitle}>11. Termination</h2>
                    <p>
                        We may terminate or suspend your access to the Service at any time, without prior
                        notice, for conduct that we believe violates these Terms or is harmful to other
                        users, us, or third parties, or for any other reason at our discretion.
                    </p>
                    <p>
                        You may delete your account at any time from your profile settings. Upon deletion,
                        your personal data and events will be permanently removed as described in
                        our <Link href="/privacy#account-deletion">Privacy Policy</Link>.
                    </p>
                </section>

                <section id="changes" className={styles.section}>
                    <h2 className={styles.sectionTitle}>12. Changes to Terms</h2>
                    <p>
                        We reserve the right to modify these terms at any time. When we make changes,
                        we will update the &quot;Last Updated&quot; date at the top of this page. Continued use
                        of the Service after changes constitutes acceptance of the revised terms.
                    </p>
                </section>

                <section id="contact" className={styles.section}>
                    <h2 className={styles.sectionTitle}>13. Contact Us</h2>
                    <p>If you have any questions about these Terms, please contact us:</p>
                    <div className={styles.contactCard}>
                        <p><strong>Email:</strong> <a href={`mailto:${SITE_EMAILS.support}`}>{SITE_EMAILS.support}</a></p>
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
