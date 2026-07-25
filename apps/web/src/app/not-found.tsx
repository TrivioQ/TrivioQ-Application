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

  // Not-found renders outside the normal layout, so we keep inline-style
  // strings but resolve them through the same CSS-var vocabulary as the
  // rest of the app. `globals.css` is loaded by the root layout, so these
  // `--brand-*` / `--text-*` variables will be defined.
  const styles: Record<string, React.CSSProperties> = {
    body: {
      fontFamily: 'sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      margin: 0,
      backgroundColor: 'rgb(var(--bg-primary))',
      color: 'rgb(var(--text-primary))',
    },
    heading: { fontSize: '3rem', margin: '0 0 10px 0' },
    subtext: { color: 'rgb(var(--text-secondary))' },
    link: { color: 'rgb(var(--brand-500))', textDecoration: 'none', fontWeight: 'bold' } as React.CSSProperties,
  };

  return (
    <html>
      <body style={styles.body}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={styles.heading}>{t('title')}</h1>
          <p style={styles.subtext}>{t('message')}</p>
          <a href="/" style={styles.link}>
            {t('goHome')}
          </a>
        </div>
      </body>
    </html>
  );
}
