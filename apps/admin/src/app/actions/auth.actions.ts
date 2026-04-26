'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PrismaClient } from '@trivioq/database';

const prisma = new PrismaClient();

export async function loginAction(prevState: unknown, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.role !== 'ADMIN') {
      return { error: 'Invalid credentials or unauthorized access' };
    }

    // Set the cookie for the AdminGuard. In a real app, you'd verify credentials with Firebase Auth first.
    const cookieStore = await cookies();
    cookieStore.set('firebase-token', user.firebaseUid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
  } catch (error) {
    console.error('[loginAction] Login failed:', error);
    return { error: 'An unexpected error occurred' };
  }

  redirect('/');
}
export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('firebase-token');
  redirect('/login');
}
