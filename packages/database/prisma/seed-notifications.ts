import { PrismaClient, NotificationType, NotificationChannel } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding notification templates...');

  const templates = [
    {
      name: 'welcome',
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title: 'Welcome to TrivioQ, {{userName}}!',
      body: 'Start your journey by answering your first drop.',
      emailSubject: 'Welcome to TrivioQ!',
      emailHtml: `<html><body><h1>Welcome to TrivioQ!</h1><p>Hi {{userName}},</p><p>Start your journey by answering your first drop.</p></body></html>`,
      channels: [NotificationChannel.PUSH_MOBILE, NotificationChannel.PUSH_WEB, NotificationChannel.EMAIL],
      variables: ['userName'],
      isActive: true,
    },
    {
      name: 'subscription-expiring-7d',
      type: NotificationType.SUBSCRIPTION_REMINDER,
      title: 'Subscription Expiring in 7 Days',
      body: 'Your {{tier}} subscription expires on {{expiryDate}}. Renew now!',
      emailSubject: 'Don\'t lose your Premium benefits!',
      emailHtml: `<html><body><h1>Subscription Expiring Soon</h1><p>Hi {{userName}},</p><p>Your {{tier}} subscription expires on {{expiryDate}}.</p><p>Renew now to continue enjoying Premium benefits!</p></body></html>`,
      channels: [NotificationChannel.PUSH_MOBILE, NotificationChannel.PUSH_WEB, NotificationChannel.EMAIL],
      variables: ['userName', 'tier', 'expiryDate'],
      isActive: true,
    },
    {
      name: 'subscription-expiring-1d',
      type: NotificationType.SUBSCRIPTION_REMINDER,
      title: 'Last Chance! Subscription Expires Tomorrow',
      body: 'Your {{tier}} subscription expires tomorrow ({{expiryDate}}). Don\'t miss out!',
      emailSubject: 'Last Chance - Subscription Expires Tomorrow!',
      emailHtml: `<html><body><h1>Last Chance!</h1><p>Hi {{userName}},</p><p>Your {{tier}} subscription expires tomorrow ({{expiryDate}}).</p><p>Don't miss out on Premium benefits!</p></body></html>`,
      channels: [NotificationChannel.PUSH_MOBILE, NotificationChannel.PUSH_WEB, NotificationChannel.EMAIL],
      variables: ['userName', 'tier', 'expiryDate'],
      isActive: true,
    },
    {
      name: 'credits-added',
      type: NotificationType.CREDIT_ALERT,
      title: '{{points}} Points Added!',
      body: 'You earned {{points}} points from {{source}}.',
      emailSubject: 'Points Added to Your Account',
      emailHtml: `<html><body><h1>Points Added!</h1><p>Hi {{userName}},</p><p>You earned {{points}} points from {{source}}.</p><p>Keep playing to earn more!</p></body></html>`,
      channels: [NotificationChannel.PUSH_MOBILE, NotificationChannel.PUSH_WEB, NotificationChannel.EMAIL],
      variables: ['userName', 'points', 'source'],
      isActive: true,
    },
    {
      name: 'offer-promotion',
      type: NotificationType.OFFER_PROMOTION,
      title: 'Special Offer: {{offerTitle}}',
      body: '{{description}} - Valid until {{validUntil}}',
      emailSubject: 'Exclusive TrivioQ Offer Just for You!',
      emailHtml: `<html><body><h1>Special Offer</h1><p>Hi {{userName}},</p><p><strong>{{offerTitle}}</strong></p><p>{{description}}</p><p>Valid until {{validUntil}}</p></body></html>`,
      channels: [NotificationChannel.PUSH_MOBILE, NotificationChannel.PUSH_WEB, NotificationChannel.EMAIL],
      variables: ['userName', 'offerTitle', 'description', 'validUntil'],
      isActive: true,
    },
    {
      name: 'leaderboard-winner',
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title: '🏆 Leaderboard Winner!',
      body: 'Congratulations! You finished #{{rank}} in the {{period}} leaderboard!',
      emailSubject: '🏆 You\'re a Leaderboard Winner!',
      emailHtml: `<html><body><h1>🏆 Congratulations!</h1><p>Hi {{userName}},</p><p>You finished #{{rank}} in the {{period}} leaderboard!</p><p>{{reward}}</p></body></html>`,
      channels: [NotificationChannel.PUSH_MOBILE, NotificationChannel.PUSH_WEB, NotificationChannel.EMAIL],
      variables: ['userName', 'rank', 'period', 'reward'],
      isActive: true,
    },
    {
      name: 'admin-message',
      type: NotificationType.ADMIN_MESSAGE,
      title: '{{subject}}',
      body: '{{message}}',
      emailSubject: '{{subject}}',
      emailHtml: `<html><body><h1>Message from TrivioQ Team</h1><p>Hi {{userName}},</p><p>{{message}}</p></body></html>`,
      channels: [NotificationChannel.PUSH_MOBILE, NotificationChannel.PUSH_WEB, NotificationChannel.EMAIL],
      variables: ['userName', 'subject', 'message'],
      isActive: true,
    },
    {
      name: 'new-feature-announcement',
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title: '🎉 New Feature: {{featureName}}',
      body: '{{description}} Check it out now!',
      emailSubject: 'New Feature Available: {{featureName}}',
      emailHtml: `<html><body><h1>🎉 New Feature Alert!</h1><p>Hi {{userName}},</p><p><strong>{{featureName}}</strong> is now available!</p><p>{{description}}</p><p>Check it out now!</p></body></html>`,
      channels: [NotificationChannel.PUSH_MOBILE, NotificationChannel.PUSH_WEB, NotificationChannel.EMAIL],
      variables: ['userName', 'featureName', 'description'],
      isActive: true,
    },
  ];

  for (const template of templates) {
    await prisma.notificationTemplate.upsert({
      where: { name: template.name },
      update: template,
      create: template,
    });
    console.log(`✓ Template: ${template.name}`);
  }

  console.log('\n✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });