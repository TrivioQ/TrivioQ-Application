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

export default function TermsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Terms of Service</Text>
      <Text style={styles.meta}>Last updated: April 27, 2026</Text>
      <P>Please read these Terms carefully before using TrivioQ. By creating an account or using our Service, you agree to be bound by these Terms. If you do not agree, do not access or use TrivioQ.</P>

      <Section title='1. Who We Are'>
        <P>
          TrivioQ is operated by <Em>Enatos Tech</Em> ("Company", "we", "us", or "our"). TrivioQ is a micro-learning trivia platform that delivers scheduled trivia questions ("Drops") to help you build knowledge and compete on leaderboards.
        </P>
        <P>Questions? Contact us at:</P>
        <MailLink email='legal@enatostech.com' />
      </Section>

      <Section title='2. Eligibility'>
        <P>
          You must be at least <Em>13 years of age</Em> to use TrivioQ. If you are under 18, you confirm you have your parent or guardian's permission. We do not knowingly collect personal data from children under 13. If we discover a user is under 13, we will immediately terminate that account and delete associated data.
        </P>
      </Section>

      <Section title='3. Account Registration'>
        <P>To access TrivioQ you must create an account. You agree to:</P>
        <Bullet>Provide accurate and complete registration information.</Bullet>
        <Bullet>Keep your password confidential and notify us immediately of any unauthorized access.</Bullet>
        <Bullet>Be solely responsible for all activity under your account.</Bullet>
        <Bullet>Not create accounts for others or use multiple accounts to gain unfair advantages.</Bullet>
        <P>We may suspend or terminate accounts that contain false information or violate these Terms.</P>
      </Section>

      <Section title='4. Description of Service'>
        <P>TrivioQ provides:</P>
        <Bullet>
          <Em>Trivia Drops</Em> — scheduled multiple-choice questions based on your preferences.
        </Bullet>
        <Bullet>
          <Em>Scoring & Streaks</Em> — points awarded for correct answers; hints and reveals available with point deductions.
        </Bullet>
        <Bullet>
          <Em>Leaderboards</Em> — weekly and monthly rankings based on accumulated scores.
        </Bullet>
        <Bullet>
          <Em>Push Notifications</Em> — optional alerts when new Drops are ready.
        </Bullet>
        <Bullet>
          <Em>Premium Subscription</Em> — enhanced limits and on-demand Drops (subject to change; see Section 7).
        </Bullet>
        <P>We may modify, suspend, or discontinue any feature at any time with reasonable notice where practicable.</P>
      </Section>

      <Section title='5. Acceptable Use'>
        <P>You agree not to:</P>
        <Bullet>Use bots, scripts, or automated tools to manipulate scores, leaderboards, or Drops.</Bullet>
        <Bullet>Attempt to reverse engineer or extract source code from the Service.</Bullet>
        <Bullet>Use the Service for any unlawful purpose.</Bullet>
        <Bullet>Impersonate another person or entity.</Bullet>
        <Bullet>Interfere with or disrupt the integrity or performance of the Service.</Bullet>
        <Bullet>Attempt to gain unauthorized access to any part of the Service.</Bullet>
        <Bullet>Harvest or scrape data from the Service without our written consent.</Bullet>
        <P>Violations may result in immediate account suspension, termination, and/or legal action.</P>
      </Section>

      <Section title='6. Intellectual Property'>
        <P>All content on TrivioQ — including trivia questions, explanations, hints, branding, and software — is owned by or licensed to Enatos Tech. You are granted a limited, non-exclusive, revocable licence for personal, non-commercial use only. You may not reproduce, distribute, or exploit any content without our prior written consent.</P>
      </Section>

      <Section title='7. Subscriptions and Payments'>
        <P>
          TrivioQ offers a <Em>Free</Em> tier and a <Em>Premium</Em> tier. Premium billing is not yet active. When introduced, we will provide clear pricing and cancellation terms before any charge is made. We may change pricing with at least 30 days' notice to active paying subscribers.
        </P>
      </Section>

      <Section title='8. Points, Scores, and Leaderboard Rankings'>
        <P>Points, streaks, and rankings are virtual values with no monetary worth — they are not redeemable for cash or any goods or services. We may adjust or reset scores at any time in cases of abuse or technical error.</P>
      </Section>

      <Section title='9. Privacy'>
        <P>Your use of TrivioQ is governed by our Privacy Policy, accessible in the app under Profile → Legal. By using TrivioQ, you consent to the data practices described there.</P>
      </Section>

      <Section title='10. Disclaimer of Warranties'>
        <P>TO THE FULLEST EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE. TRIVIA CONTENT IS PROVIDED FOR ENTERTAINMENT AND EDUCATIONAL PURPOSES ONLY — WE DO NOT GUARANTEE ITS ACCURACY OR COMPLETENESS.</P>
      </Section>

      <Section title='11. Limitation of Liability'>
        <P>TO THE FULLEST EXTENT PERMITTED BY LAW, ENATOS TECH SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE GREATER OF THE AMOUNT YOU PAID TO US IN THE 12 MONTHS PRECEDING THE CLAIM OR USD $50.</P>
      </Section>

      <Section title='12. Termination'>
        <P>We may suspend or terminate your account at any time if we believe you have violated these Terms. You may terminate your account by contacting:</P>
        <MailLink email='support@enatostech.com' />
      </Section>

      <Section title='13. Changes to These Terms'>
        <P>We may update these Terms from time to time. For material changes, we will notify you via email or an in-app notice. Continued use of the Service after changes take effect constitutes your acceptance.</P>
      </Section>

      <Section title='14. Governing Law'>
        <P>These Terms are governed by the laws of the jurisdiction in which Enatos Tech is incorporated. For disputes, please first contact us at:</P>
        <MailLink email='legal@enatostech.com' />
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
