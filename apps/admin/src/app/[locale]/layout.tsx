import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { ThemeProvider, type Theme } from '@/context/theme-context';
import { Toaster } from 'sonner';
import '../globals.css';

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: 'TrivioQ Admin Panel',
  description: 'TrivioQ Admin Panel',
  icons: {
    icon: '/favicon.png',
  },
};

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const messages = await getMessages();
  // Read the shared theme cookie (same key used by apps/web)
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('theme');
  const initialTheme = (themeCookie?.value as Theme) ?? 'system';

  return (
    <html lang={locale} className={`${poppins.variable} h-full antialiased font-sans ${initialTheme !== 'system' ? initialTheme : ''}`}>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider initialTheme={initialTheme}>
            {children}
            <Toaster richColors position="top-center" />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
