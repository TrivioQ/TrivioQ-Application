import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PrismaClient } from '@trivioq/database';

export async function AdminGuard({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('firebase-token')?.value;

  if (!token) {
    redirect('/login');
  }

  // In a real application, verify the Firebase token using firebase-admin to get the decoded UID.
  // For this demonstration, we'll assume the token directly contains the UID or we lookup by token.
  // Example: const decodedToken = await admin.auth().verifyIdToken(token);
  // const uid = decodedToken.uid;
  const uid = token; 

  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({
    where: { firebaseUid: uid },
  });

  if (!user || user.role !== 'ADMIN') {
    redirect('/403');
  }

  return <>{children}</>;
}
