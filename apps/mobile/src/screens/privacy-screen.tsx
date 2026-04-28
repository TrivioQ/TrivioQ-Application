import React from 'react';
import { ScrollView, View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={[styles.body, styles.bulletText]}>{children}</Text>
    </View>
  );
}

function Em({ children }: { children: string }) {
  return <Text style={styles.strong}>{children}</Text>;
}

function MailLink({ email }: { email: string }) {
  return (
    <TouchableOpacity onPress={() => Linking.openURL(`mailto:${email}`)}>
      <Text style={styles.link}>{email}</Text>
    </TouchableOpacity>
  );
}

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Privacy Policy</Text>
      <Text style={styles.meta}>Last updated: April 27, 2026</Text>
      <P>Enatos Tech ("we", "us", or "our") operates TrivioQ. This Privacy Policy explains how we collect, use, disclose, and safeguard your information. By using TrivioQ, you consent to the practices described here.</P>

      <Section title='1. Information We Collect'>
        <P>
          <Em>Information you provide directly:</Em>
        </P>
        <Bullet>
          <Em>Account data:</Em> email address, username, display name, and password (stored as a secure hash via Firebase Authentication).
        </Bullet>
        <Bullet>
          <Em>Preferences:</Em> category interests, difficulty settings, active notification windows, and target drop frequency.
        </Bullet>

        <P>
          <Em>Information collected automatically:</Em>
        </P>
        <Bullet>
          <Em>Usage data:</Em> answers submitted, questions received, points earned, streaks, hints and reveals used, and leaderboard activity.
        </Bullet>
        <Bullet>
          <Em>Device data:</Em> device push notification token and operating system platform — collected to deliver push notifications.
        </Bullet>
        <Bullet>
          <Em>Log data:</Em> IP address, browser/app type, pages visited, and timestamps — for security and operational purposes.
        </Bullet>

        <P>
          <Em>Information from third-party sign-in:</Em>
        </P>
        <P>If you sign in using Google, we receive your email address and a unique Google identifier. We do not receive your Google password.</P>
      </Section>

      <Section title='2. How We Use Your Information'>
        <P>We use the information we collect to:</P>
        <Bullet>Create and manage your account and authenticate your identity.</Bullet>
        <Bullet>Deliver trivia Drops based on your schedule and preferences.</Bullet>
        <Bullet>Calculate and display scores, streaks, and leaderboard rankings.</Bullet>
        <Bullet>Send push notifications when new Drops are available (only with your permission).</Bullet>
        <Bullet>Respond to support requests and communicate service updates.</Bullet>
        <Bullet>Monitor usage patterns, diagnose technical issues, and prevent abuse.</Bullet>
        <Bullet>Enforce our Terms of Service and comply with legal obligations.</Bullet>
        <P>We do not use your data for advertising profiling and we do not sell your personal data.</P>
      </Section>

      <Section title='3. Legal Bases for Processing (GDPR)'>
        <P>If you are in the EEA or UK, our legal bases are:</P>
        <Bullet>
          <Em>Contract performance</Em> — processing necessary to provide the Service.
        </Bullet>
        <Bullet>
          <Em>Legitimate interests</Em> — security monitoring, fraud prevention, and product improvement.
        </Bullet>
        <Bullet>
          <Em>Consent</Em> — for optional features such as push notifications; withdraw at any time.
        </Bullet>
        <Bullet>
          <Em>Legal obligation</Em> — where required by law.
        </Bullet>
      </Section>

      <Section title='4. How We Share Your Information'>
        <P>We do not sell your personal data. We may share information in limited circumstances:</P>
        <Bullet>
          <Em>Service providers:</Em> Firebase (Google LLC) for authentication and push notifications — bound by data processing agreements.
        </Bullet>
        <Bullet>
          <Em>Leaderboard data:</Em> Your username, display name, and score are visible to other users on the public leaderboard.
        </Bullet>
        <Bullet>
          <Em>Legal requirements:</Em> Disclosure required by law or valid public authority request.
        </Bullet>
        <Bullet>
          <Em>Business transfers:</Em> If we are acquired or merge, we will notify you before your data is subject to a different policy.
        </Bullet>
      </Section>

      <Section title='5. Data Retention'>
        <P>
          We retain your data for as long as your account is active. Upon account deletion request, we delete or anonymise your personal data within <Em>30 days</Em>, except where required by law or where data has been incorporated into anonymised statistics.
        </P>
      </Section>

      <Section title='6. Data Security'>
        <P>We use TLS/HTTPS for data transmission, hashed password storage via Firebase Authentication, and access controls limiting internal data access. No system is 100% secure — in the event of a breach affecting your rights, we will notify you and relevant authorities as required by law.</P>
      </Section>

      <Section title='7. Push Notifications'>
        <P>Push notifications require your explicit permission. You can withdraw permission at any time in your device settings. Your push token is used solely to route notifications to your device via Firebase Cloud Messaging and is not shared with other third parties.</P>
      </Section>

      <Section title="8. Children's Privacy">
        <P>
          TrivioQ is not directed to children under <Em>13</Em>. We do not knowingly collect personal data from children under 13. If you believe your child has provided data without your consent, contact:
        </P>
        <MailLink email='privacy@enatostech.com' />
        <P>We will promptly delete that information.</P>
      </Section>

      <Section title='9. Your Rights'>
        <P>Depending on your location, you may have the right to:</P>
        <Bullet>
          <Em>Access</Em> — request a copy of your personal data.
        </Bullet>
        <Bullet>
          <Em>Rectification</Em> — request correction of inaccurate data.
        </Bullet>
        <Bullet>
          <Em>Erasure</Em> — request deletion of your personal data (subject to legal requirements).
        </Bullet>
        <Bullet>
          <Em>Restriction of processing</Em> — limit how we process your data.
        </Bullet>
        <Bullet>
          <Em>Data portability</Em> — receive your data in a structured, machine-readable format.
        </Bullet>
        <Bullet>
          <Em>Objection</Em> — object to processing based on legitimate interests.
        </Bullet>
        <Bullet>
          <Em>Withdraw consent</Em> — at any time for consent-based processing.
        </Bullet>
        <P>California residents (CCPA): you have the right to know what personal information is collected and the right to opt out of its sale. We do not sell personal information.</P>
        <P>To exercise any of these rights, contact:</P>
        <MailLink email='privacy@enatostech.com' />
        <P>We will respond within 30 days.</P>
      </Section>

      <Section title='10. International Data Transfers'>
        <P>Your data may be transferred to and processed in countries other than your own. We implement appropriate safeguards such as Standard Contractual Clauses where required by applicable law.</P>
      </Section>

      <Section title='11. Third-Party Services'>
        <P>Key third-party services we use:</P>
        <Bullet>
          <Em>Firebase (Google LLC)</Em> — authentication, database, Cloud Messaging. Subject to Google's Privacy Policy.
        </Bullet>
      </Section>

      <Section title='12. Changes to This Privacy Policy'>
        <P>We may update this policy from time to time. For material changes we will notify you via email or an in-app notice. Continued use of TrivioQ after changes take effect constitutes your acceptance.</P>
      </Section>

      <Section title='13. Contact Us'>
        <P>
          <Em>Enatos Tech</Em>
        </P>
        <P>Privacy enquiries:</P>
        <MailLink email='privacy@enatostech.com' />
        <P>General support:</P>
        <MailLink email='support@enatostech.com' />
      </Section>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2026 Enatos Tech. All rights reserved.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  meta: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 16,
  },
  section: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 20,
  },
  strong: {
    color: '#cbd5e1',
    fontWeight: '600',
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 13,
    color: '#6366f1',
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
  },
  link: {
    fontSize: 13,
    color: '#818cf8',
    textDecorationLine: 'underline',
    marginTop: 2,
  },
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#334155',
  },
});
