import { prisma } from '../src/index';

async function makeAdmin() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: npx ts-node scripts/make-admin.ts <email>');
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`User with email "${email}" not found.`);
      process.exit(1);
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
    });

    console.log(`Successfully updated ${updatedUser.email} to ADMIN role.`);
  } catch (error) {
    console.error('Error updating user role:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

makeAdmin();
