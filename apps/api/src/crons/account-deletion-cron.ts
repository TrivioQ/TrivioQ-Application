import * as admin from 'firebase-admin';
import { prisma } from '@trivioq/database';
import { emailService } from '../services/email-service';
import { getSetting } from '../utils/settings';

export async function runAccountDeletionCron() {
  console.log('[Account Deletion Cron] Starting execution...');
  const now = new Date();

  try {
    // 1. Send 7-day warnings
    // Find users where scheduledDeletionAt <= 7 days from now, and warning not sent
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const usersToWarn = await prisma.user.findMany({
      where: {
        accountStatus: 'PENDING_DELETION',
        deletionWarningSent: false,
        scheduledDeletionAt: {
          lte: sevenDaysFromNow,
          gt: now, // don't warn if they are already due for deletion today
        },
      },
    });

    console.log(`[Account Deletion Cron] Found ${usersToWarn.length} users to send 7-day warning.`);
    const supportEmail = await getSetting('support_email', 'support@trivioq.com');

    for (const user of usersToWarn) {
      try {
        await emailService.send({
          to: user.email,
          subject: 'Your TrivioQ Account will be permanently deleted in 7 days',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Account Deletion Reminder</h2>
              <p>Hi ${user.displayName || user.username},</p>
              <p>This is a reminder that your TrivioQ account is scheduled for permanent deletion in 7 days.</p>
              <p>Once deleted, all your data will be permanently removed and cannot be recovered.</p>
              <p>If you've changed your mind, you can reactivate your account by logging in to TrivioQ before the deadline.</p>
              <p>If you need assistance, please contact us at ${supportEmail}.</p>
              <br/>
              <p>Thanks,</p>
              <p>The TrivioQ Team</p>
            </div>
          `,
        });

        await prisma.user.update({
          where: { id: user.id },
          data: { deletionWarningSent: true },
        });
        console.log(`[Account Deletion Cron] Warning sent to ${user.email}`);
      } catch (err) {
        console.error(`[Account Deletion Cron] Failed to send warning to ${user.email}:`, err);
      }
    }

    // 2. Permanent Deletions
    const usersToDelete = await prisma.user.findMany({
      where: {
        accountStatus: 'PENDING_DELETION',
        scheduledDeletionAt: { lte: now },
      },
    });

    console.log(`[Account Deletion Cron] Found ${usersToDelete.length} users to permanently delete.`);

    for (const user of usersToDelete) {
      try {
        // Delete from Postgres first
        await prisma.user.delete({ where: { id: user.id } });

        // Delete from Firebase Auth
        await admin.auth().deleteUser(user.firebaseUid);

        console.log(`[Account Deletion Cron] Permanently deleted user ${user.email}`);
      } catch (err) {
        console.error(`[Account Deletion Cron] Failed to delete user ${user.email}:`, err);
      }
    }
  } catch (error) {
    console.error('[Account Deletion Cron] Error during execution:', error);
  }

  console.log('[Account Deletion Cron] Execution finished.');
}
