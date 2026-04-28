import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'Privacy Policy | TrivioQ',
  description: 'TrivioQ Privacy Policy — how we collect, use, and protect your personal data.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='space-y-3'>
      <h2 className='text-xl font-bold text-white'>{title}</h2>
      <div className='space-y-2 text-sm text-gray-400 leading-relaxed'>{children}</div>
    </section>
  );
}

export default async function PrivacyPage() {
  const t = await getTranslations('legal');
  return (
    <div className='min-h-screen bg-gray-950 text-white'>
      <div className='max-w-3xl mx-auto px-6 py-16 space-y-10'>
        {/* Header */}
        <div>
          <Link href='/' className='text-sm text-indigo-400 hover:text-indigo-300 transition-colors'>
            {t('backToTrivioQ')}
          </Link>
          <h1 className='mt-6 text-4xl font-extrabold tracking-tight text-white'>Privacy Policy</h1>
          <p className='mt-2 text-sm text-gray-500'>Last updated: April 27, 2026 · Effective upon account registration</p>
          <p className='mt-4 text-sm text-gray-400 leading-relaxed'>Enatos Tech ("we", "us", or "our") operates TrivioQ. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service (the TrivioQ website and mobile application). Please read it carefully. By using TrivioQ, you consent to the practices described here.</p>
        </div>

        <div className='border-t border-white/8' />

        <Section title='1. Information We Collect'>
          <p>
            <strong className='text-gray-300'>a) Information you provide directly</strong>
          </p>
          <ul className='list-disc pl-5 space-y-1'>
            <li>
              <strong className='text-gray-300'>Account data:</strong> email address, username, display name, and password (stored as a secure hash via Firebase Authentication).
            </li>
            <li>
              <strong className='text-gray-300'>Preferences:</strong> category interests, difficulty preferences, active notification windows, and target drop frequency you configure in the app.
            </li>
          </ul>

          <p className='pt-1'>
            <strong className='text-gray-300'>b) Information collected automatically</strong>
          </p>
          <ul className='list-disc pl-5 space-y-1'>
            <li>
              <strong className='text-gray-300'>Usage data:</strong> trivia answers submitted, questions received, points earned, streaks, hint and reveal-answer usage, and leaderboard activity.
            </li>
            <li>
              <strong className='text-gray-300'>Device data:</strong> device push notification token, operating system platform (iOS / Android / Web), and general device type — collected to deliver push notifications.
            </li>
            <li>
              <strong className='text-gray-300'>Log data:</strong> IP address, browser type, pages visited, and timestamps — collected automatically by our servers and third-party infrastructure for security and operational purposes.
            </li>
          </ul>

          <p className='pt-1'>
            <strong className='text-gray-300'>c) Information from third-party sign-in</strong>
          </p>
          <p>If you sign in using Google, we receive your Google account email address and a unique identifier from Google. We do not receive your Google password. Your use of Google Sign-In is also subject to Google's Privacy Policy.</p>
        </Section>

        <Section title='2. How We Use Your Information'>
          <p>We use the information we collect to:</p>
          <ul className='list-disc pl-5 space-y-1'>
            <li>Create and manage your account and authenticate your identity.</li>
            <li>Deliver trivia questions ("Drops") on your chosen schedule and within your category and difficulty preferences.</li>
            <li>Calculate and display scores, streaks, and leaderboard rankings.</li>
            <li>Send push notifications when new Drops are available (only if you have granted notification permission).</li>
            <li>Respond to support requests and communicate important service updates.</li>
            <li>Monitor and analyse usage patterns to improve the Service, diagnose technical issues, and prevent abuse.</li>
            <li>Enforce our Terms of Service and comply with legal obligations.</li>
          </ul>
          <p>We do not use your data for advertising profiling or sell your personal data to third-party advertisers.</p>
        </Section>

        <Section title='3. Legal Bases for Processing (GDPR)'>
          <p>If you are located in the European Economic Area (EEA) or United Kingdom, our legal bases for processing your personal data are:</p>
          <ul className='list-disc pl-5 space-y-1'>
            <li>
              <strong className='text-gray-300'>Contract performance</strong> — processing necessary to provide the Service you have signed up for.
            </li>
            <li>
              <strong className='text-gray-300'>Legitimate interests</strong> — security monitoring, fraud prevention, product improvement, and service communications, where those interests are not overridden by your rights.
            </li>
            <li>
              <strong className='text-gray-300'>Consent</strong> — for optional features such as push notifications; you may withdraw consent at any time.
            </li>
            <li>
              <strong className='text-gray-300'>Legal obligation</strong> — where we are required by law to process your data.
            </li>
          </ul>
        </Section>

        <Section title='4. How We Share Your Information'>
          <p>We do not sell your personal data. We may share information in the following limited circumstances:</p>
          <ul className='list-disc pl-5 space-y-1'>
            <li>
              <strong className='text-gray-300'>Service providers:</strong> We use Firebase (Google LLC) for authentication, push notification delivery, and database infrastructure. These providers process data only on our behalf and are bound by data processing agreements.
            </li>
            <li>
              <strong className='text-gray-300'>Leaderboard data:</strong> Your username, display name, and score are visible to other TrivioQ users on the public leaderboard.
            </li>
            <li>
              <strong className='text-gray-300'>Legal requirements:</strong> We may disclose your information if required to do so by law or in response to valid requests by public authorities (e.g. a court or government agency).
            </li>
            <li>
              <strong className='text-gray-300'>Business transfers:</strong> In the event of a merger, acquisition, or asset sale, your information may be transferred. We will provide notice before your data is transferred and becomes subject to a different privacy policy.
            </li>
          </ul>
        </Section>

        <Section title='5. Data Retention'>
          <p>
            We retain your account data for as long as your account is active or as needed to provide you with the Service. If you request account deletion, we will delete or anonymise your personal data within <strong className='text-gray-300'>30 days</strong>, except where we are required by law to retain certain records or where data has been incorporated into aggregated, anonymised statistics
            that do not identify you.
          </p>
          <p>Score and leaderboard history data may be retained in anonymised form for analytical purposes after account deletion.</p>
        </Section>

        <Section title='6. Data Security'>
          <p>We implement industry-standard technical and organisational measures to protect your personal data against unauthorised access, loss, destruction, or alteration. These measures include encrypted data transmission (TLS/HTTPS), hashed password storage via Firebase Authentication, and access controls limiting who within our organisation can access personal data.</p>
          <p>No method of transmission over the internet or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your data, we cannot guarantee absolute security. In the event of a data breach that is likely to result in a risk to your rights and freedoms, we will notify you and applicable authorities as required by law.</p>
        </Section>

        <Section title='7. Push Notifications'>
          <p>TrivioQ may send you push notifications to alert you when a new trivia Drop is available. Push notifications require your explicit permission on both iOS and Android. You can withdraw permission at any time through your device's notification settings. Withdrawing notification permission does not affect your ability to use TrivioQ, but you will no longer receive Drop alerts.</p>
          <p>When you grant notification permission, we store your device push token to route notifications to your device. This token is not shared with third parties beyond the notification delivery infrastructure (Firebase Cloud Messaging).</p>
        </Section>

        <Section title="8. Children's Privacy">
          <p>
            TrivioQ is not directed to children under the age of <strong className='text-gray-300'>13</strong>. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and you believe your child has provided us with personal data without your consent, please contact us at{' '}
            <a href='mailto:privacy@enatostech.com' className='text-indigo-400 hover:text-indigo-300'>
              privacy@enatostech.com
            </a>{' '}
            and we will promptly delete that information.
          </p>
        </Section>

        <Section title='9. Your Rights'>
          <p>Depending on your location, you may have certain rights regarding your personal data, including the right to:</p>
          <ul className='list-disc pl-5 space-y-1'>
            <li>
              <strong className='text-gray-300'>Access</strong> — request a copy of the personal data we hold about you.
            </li>
            <li>
              <strong className='text-gray-300'>Rectification</strong> — request correction of inaccurate or incomplete data.
            </li>
            <li>
              <strong className='text-gray-300'>Erasure ("right to be forgotten")</strong> — request deletion of your personal data, subject to legal retention requirements.
            </li>
            <li>
              <strong className='text-gray-300'>Restriction of processing</strong> — request that we limit how we process your data in certain circumstances.
            </li>
            <li>
              <strong className='text-gray-300'>Data portability</strong> — receive your data in a structured, machine-readable format.
            </li>
            <li>
              <strong className='text-gray-300'>Objection</strong> — object to processing based on legitimate interests.
            </li>
            <li>
              <strong className='text-gray-300'>Withdraw consent</strong> — where processing is based on consent (e.g. push notifications), you may withdraw at any time.
            </li>
          </ul>
          <p>California residents also have rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information is collected and the right to opt out of the sale of personal information. We do not sell personal information.</p>
          <p>
            To exercise any of these rights, please contact us at{' '}
            <a href='mailto:privacy@enatostech.com' className='text-indigo-400 hover:text-indigo-300'>
              privacy@enatostech.com
            </a>
            . We will respond within 30 days (or sooner where required by law).
          </p>
        </Section>

        <Section title='10. International Data Transfers'>
          <p>
            Your information may be transferred to and processed in countries other than the country in which you reside. These countries may have data protection laws that differ from those of your country. When we transfer personal data across borders, we implement appropriate safeguards such as Standard Contractual Clauses approved by the European Commission, or rely on adequacy decisions where
            applicable.
          </p>
        </Section>

        <Section title='11. Third-Party Links and Services'>
          <p>TrivioQ may contain links to third-party websites or services. We are not responsible for the privacy practices of those third parties. We encourage you to review the privacy policies of any third-party services you access through TrivioQ.</p>
          <p>Key third-party services we use include:</p>
          <ul className='list-disc pl-5 space-y-1'>
            <li>
              <strong className='text-gray-300'>Firebase (Google LLC)</strong> — authentication, Firestore, Cloud Messaging. Subject to Google's Privacy Policy.
            </li>
          </ul>
        </Section>

        <Section title='12. Changes to This Privacy Policy'>
          <p>
            We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or for other operational reasons. When we make material changes, we will notify you via email or a prominent notice within the Service and update the "Last updated" date at the top of this page. We encourage you to review this policy periodically. Your continued use
            of TrivioQ after the effective date of changes constitutes your acceptance of the revised policy.
          </p>
        </Section>

        <Section title='13. Contact Us'>
          <p>If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:</p>
          <div className='rounded-xl bg-white/5 border border-white/8 p-4 space-y-1'>
            <p>
              <strong className='text-gray-300'>Enatos Tech</strong>
            </p>
            <p>
              Privacy enquiries:{' '}
              <a href='mailto:privacy@enatostech.com' className='text-indigo-400 hover:text-indigo-300'>
                privacy@enatostech.com
              </a>
            </p>
            <p>
              General support:{' '}
              <a href='mailto:support@enatostech.com' className='text-indigo-400 hover:text-indigo-300'>
                support@enatostech.com
              </a>
            </p>
          </div>
        </Section>

        <div className='border-t border-white/8 pt-8 flex flex-wrap gap-4 text-sm text-gray-500'>
          <Link href='/terms' className='text-indigo-400 hover:text-indigo-300 transition-colors'>
            Terms of Service
          </Link>
          <Link href='/' className='hover:text-gray-400 transition-colors'>
            Back to TrivioQ
          </Link>
        </div>
      </div>
    </div>
  );
}
