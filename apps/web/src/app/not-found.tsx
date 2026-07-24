import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  let t;
  try {
    t = await getTranslations('notFound');
  } catch {
    t = (key: string) => {
      const fallback: Record<string, string> = {
        title: '404',
        message: 'The page you are looking for does not exist or has been moved.',
        goHome: 'Go to Homepage →',
      };
      return fallback[key] || key;
    };
  }

  return (
    <html>
      <body style={{ fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0, backgroundColor: '#030712', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '3rem', margin: '0 0 10px 0' }}>{t('title')}</h1>
          <p style={{ color: '#9ca3af' }}>{t('message')}</p>
          <a href="/" style={{ color: '#14B8A6', textDecoration: 'none', fontWeight: 'bold' }}>
            {t('goHome')}
          </a>
        </div>
      </body>
    </html>
  );
}
