import { cookies } from 'next/headers';
import { Poppins } from 'next/font/google';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Providers } from '@/components/providers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import '../globals.css';
import { Theme } from '@/context/ThemeContext';
import { PageBackground } from '@/components/page-background';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
});

export async function generateMetadata() {
  const t = await getTranslations('metadata');
  return {
    title: t('homeTitle'),
    description: t('homeDescription'),
    icons: {
      icon: '/favicon.png',
    },
  };
}

export default async function RootLayout({ children, params: { locale } }: { children: React.ReactNode; params: { locale: string } }) {
  const messages = await getMessages();
  const themeCookie = cookies().get('theme');
  const initialTheme = (themeCookie?.value as Theme) || 'system';

  return (
    <html lang={locale} className={initialTheme !== 'system' ? initialTheme : ''}>
      <body className={poppins.className}>
        <NextIntlClientProvider messages={messages}>
          <Providers initialTheme={initialTheme}>
            {/* Global gradient backdrop — makes glassmorphism visible on all pages */}
            <PageBackground />
            <Navbar />
            {children}
            <Footer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
