import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | TrivioQ',
  description: 'TrivioQ Terms of Service — your rights and responsibilities when using our platform.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='space-y-3'>
      <h2 className='text-xl font-bold text-white'>{title}</h2>
      <div className='space-y-2 text-sm text-gray-400 leading-relaxed'>{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className='min-h-screen bg-gray-950 text-white'>
      <div className='max-w-3xl mx-auto px-6 py-16 space-y-10'>
        {/* Header */}
        <div>
          <Link href='/' className='text-sm text-indigo-400 hover:text-indigo-300 transition-colors'>
            ← Back to TrivioQ
          </Link>
          <h1 className='mt-6 text-4xl font-extrabold tracking-tight text-white'>Terms of Service</h1>
          <p className='mt-2 text-sm text-gray-500'>Last updated: April 27, 2026 · Effective upon account registration</p>
          <p className='mt-4 text-sm text-gray-400 leading-relaxed'>Please read these Terms of Service ("Terms") carefully before using TrivioQ. By creating an account or using our Service, you agree to be bound by these Terms. If you do not agree, do not access or use TrivioQ.</p>
        </div>

        <div className='border-t border-white/8' />

        <Section title='1. Who We Are'>
          <p>
            TrivioQ is operated by <strong className='text-gray-300'>Enatos Tech</strong> ("Company", "we", "us", or "our"). TrivioQ is a micro-learning trivia platform that delivers scheduled trivia questions ("Drops") to users to help build knowledge and compete on leaderboards.
          </p>
          <p>
            For questions about these Terms, contact us at{' '}
            <a href='mailto:legal@enatostech.com' className='text-indigo-400 hover:text-indigo-300'>
              legal@enatostech.com
            </a>
            .
          </p>
        </Section>

        <Section title='2. Eligibility'>
          <p>
            You must be at least <strong className='text-gray-300'>13 years of age</strong> to use TrivioQ. If you are under 18, you represent that you have your parent or guardian's permission. We do not knowingly collect personal data from children under 13. If we become aware that a user is under 13, we will immediately terminate that account and delete associated data.
          </p>
          <p>By using TrivioQ, you represent and warrant that you meet the eligibility requirements above.</p>
        </Section>

        <Section title='3. Account Registration'>
          <p>To access TrivioQ you must create an account by providing a valid email address, a unique username, and a password, or by signing in via Google. You agree to:</p>
          <ul className='list-disc pl-5 space-y-1'>
            <li>Provide accurate and complete registration information.</li>
            <li>Keep your password confidential and notify us immediately of any unauthorized access.</li>
            <li>Be solely responsible for all activity that occurs under your account.</li>
            <li>Not create accounts for others or operate multiple accounts to gain unfair advantages.</li>
          </ul>
          <p>We reserve the right to suspend or terminate accounts that contain false information, violate these Terms, or are created for abusive purposes.</p>
        </Section>

        <Section title='4. Description of Service'>
          <p>TrivioQ provides the following features:</p>
          <ul className='list-disc pl-5 space-y-1'>
            <li>
              <strong className='text-gray-300'>Trivia Drops</strong> — Scheduled multiple-choice trivia questions delivered to your account based on your preferences.
            </li>
            <li>
              <strong className='text-gray-300'>Scoring & Streaks</strong> — Points are awarded for correct answers. Consecutive correct answers build a streak. Hints and answer reveals are available with associated point deductions.
            </li>
            <li>
              <strong className='text-gray-300'>Leaderboards</strong> — Weekly and monthly rankings based on accumulated scores.
            </li>
            <li>
              <strong className='text-gray-300'>Push Notifications</strong> — Optional notifications to alert you when a new Drop is ready.
            </li>
            <li>
              <strong className='text-gray-300'>Premium Subscription</strong> — Enhanced limits and on-demand Drops (feature availability subject to change; see Section 7).
            </li>
          </ul>
          <p>The Service is provided "as is" and we may modify, suspend, or discontinue any feature at any time with reasonable notice where practicable.</p>
        </Section>

        <Section title='5. Acceptable Use'>
          <p>You agree not to:</p>
          <ul className='list-disc pl-5 space-y-1'>
            <li>Use automated tools, bots, scripts, or any means to manipulate scores, leaderboards, or Drops.</li>
            <li>Attempt to reverse engineer, decompile, or extract source code from the Service.</li>
            <li>Use the Service for any unlawful purpose or in violation of any applicable laws or regulations.</li>
            <li>Impersonate another person or entity or misrepresent your affiliation with any person or entity.</li>
            <li>Interfere with or disrupt the integrity or performance of the Service or its infrastructure.</li>
            <li>Attempt to gain unauthorized access to any portion of the Service, including other users' accounts.</li>
            <li>Harvest, scrape, or collect data from the Service without our prior written consent.</li>
          </ul>
          <p>Violation of this section may result in immediate account suspension or termination and, where applicable, legal action.</p>
        </Section>

        <Section title='6. Intellectual Property'>
          <p>All content on TrivioQ — including but not limited to trivia questions, explanations, hints, scoring logic, branding, graphics, and software — is owned by or licensed to Enatos Tech and is protected by applicable intellectual property laws.</p>
          <p>You are granted a limited, non-exclusive, non-transferable, revocable licence to access and use the Service for your personal, non-commercial purposes. You may not reproduce, distribute, modify, create derivative works of, publicly display, or exploit any content from TrivioQ without our express prior written consent.</p>
        </Section>

        <Section title='7. Subscriptions and Payments'>
          <p>
            TrivioQ offers a <strong className='text-gray-300'>Free</strong> tier and a <strong className='text-gray-300'>Premium</strong> tier. The Free tier includes a limited number of Drops per day. The Premium tier includes higher daily limits and additional features.
          </p>
          <p>Premium subscription billing is not yet active. When billing is introduced, we will provide clear pricing, billing frequency, and cancellation terms before any charge is made. All paid subscriptions will be subject to a separate billing agreement presented at the time of purchase.</p>
          <p>We reserve the right to change pricing at any time with at least 30 days' advance notice to active paying subscribers. Refunds are handled on a case-by-case basis at our discretion, except where required by applicable law.</p>
        </Section>

        <Section title='8. Points, Scores, and Leaderboard Rankings'>
          <p>Points, streaks, and leaderboard rankings are virtual values within TrivioQ and have no monetary value. They are not redeemable for cash or any goods or services. We reserve the right to adjust, reset, or remove scores and rankings at any time, including in cases of suspected abuse or technical error, without liability to you.</p>
        </Section>

        <Section title='9. Privacy'>
          <p>
            Your use of TrivioQ is also governed by our{' '}
            <Link href='/privacy' className='text-indigo-400 hover:text-indigo-300'>
              Privacy Policy
            </Link>
            , which is incorporated into these Terms by reference. By using TrivioQ, you consent to the collection and use of your information as described therein.
          </p>
        </Section>

        <Section title='10. Third-Party Services'>
          <p>TrivioQ uses third-party services including Google Firebase for authentication and push notifications. Your use of those services is also subject to their respective terms and privacy policies. We are not responsible for the practices of third-party service providers.</p>
        </Section>

        <Section title='11. Disclaimer of Warranties'>
          <p>TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.</p>
          <p>Trivia content is provided for entertainment and educational purposes only. We do not guarantee the accuracy, completeness, or currency of any question, answer, or explanation.</p>
        </Section>

        <Section title='12. Limitation of Liability'>
          <p>
            TO THE FULLEST EXTENT PERMITTED BY LAW, ENATOS TECH AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF DATA, LOSS OF PROFITS, OR LOSS OF GOODWILL, ARISING FROM OR RELATED TO YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH
            DAMAGES.
          </p>
          <p>OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING UNDER OR RELATED TO THESE TERMS SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO US IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) USD $50.</p>
        </Section>

        <Section title='13. Indemnification'>
          <p>You agree to defend, indemnify, and hold harmless Enatos Tech and its affiliates, officers, agents, and employees from any claim or demand, including reasonable legal fees, made by any third party arising out of or relating to your use of the Service, your violation of these Terms, or your violation of any rights of another.</p>
        </Section>

        <Section title='14. Termination'>
          <p>We may suspend or terminate your account and access to the Service at any time, with or without cause and with or without notice, if we believe you have violated these Terms or for any other reason at our sole discretion.</p>
          <p>
            You may terminate your account at any time by contacting us at{' '}
            <a href='mailto:support@enatostech.com' className='text-indigo-400 hover:text-indigo-300'>
              support@enatostech.com
            </a>
            . Upon termination, your right to use the Service ceases immediately. Provisions of these Terms that by their nature should survive termination shall do so, including Sections 6, 8, 11, 12, 13, and 16.
          </p>
        </Section>

        <Section title='15. Changes to These Terms'>
          <p>We may update these Terms from time to time. When we do, we will revise the "Last updated" date at the top and, for material changes, notify you via email or an in-app notice. Your continued use of the Service after changes take effect constitutes your acceptance of the revised Terms. If you do not agree to the revised Terms, you must stop using the Service.</p>
        </Section>

        <Section title='16. Governing Law and Dispute Resolution'>
          <p>These Terms are governed by and construed in accordance with the laws of the jurisdiction in which Enatos Tech is incorporated, without regard to its conflict of law provisions. You agree to submit to the personal jurisdiction of the courts located in that jurisdiction for the resolution of any disputes.</p>
          <p>
            Before initiating formal legal proceedings, we encourage you to contact us at{' '}
            <a href='mailto:legal@enatostech.com' className='text-indigo-400 hover:text-indigo-300'>
              legal@enatostech.com
            </a>{' '}
            to attempt to resolve any dispute informally.
          </p>
        </Section>

        <Section title='17. Entire Agreement'>
          <p>These Terms, together with our Privacy Policy, constitute the entire agreement between you and Enatos Tech regarding TrivioQ and supersede all prior agreements, understandings, or representations. If any provision of these Terms is found invalid or unenforceable, the remaining provisions shall continue in full force and effect.</p>
        </Section>

        <div className='border-t border-white/8 pt-8 flex flex-wrap gap-4 text-sm text-gray-500'>
          <Link href='/privacy' className='text-indigo-400 hover:text-indigo-300 transition-colors'>
            Privacy Policy
          </Link>
          <Link href='/' className='hover:text-gray-400 transition-colors'>
            Back to TrivioQ
          </Link>
        </div>
      </div>
    </div>
  );
}
