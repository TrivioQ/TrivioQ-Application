import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

// ─── Social icons ─────────────────────────────────────────────────────────────

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069Zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export async function Footer() {
  const t = await getTranslations('footer');
  const year = new Date().getFullYear();

  const FOOTER_COLUMNS = [
    {
      heading: t('productHeading'),
      links: [
        { label: t('links.home'), href: '/' },
        { label: t('links.leaderboard'), href: '/leaderboard' },
        { label: t('links.faq'), href: '/faq' },
      ],
    },
    {
      heading: t('companyHeading'),
      links: [
        { label: t('links.about'), href: '/about' },
        { label: t('links.privacy'), href: '/privacy' },
        { label: t('links.terms'), href: '/terms' },
      ],
    },
  ];

  return (
    <footer className="relative bg-gray-50 dark:bg-black border-t border-gray-100 dark:border-white/5 transition-colors duration-300">
      {/* Subtle top glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/40 dark:via-brand-500/40 to-transparent" />

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* ── Main grid ── */}
        <div className="pt-16 pb-10 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 group w-fit">
              <img src="/logo.png" alt={t('logoAlt')} className="w-8 h-8" />
              <span className="font-extrabold text-xl tracking-tight text-gray-900 dark:text-white group-hover:text-brand-500 dark:group-hover:text-brand-100 transition-colors">{t('brandName')}</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-gray-500 dark:text-gray-400 max-w-xs">{t('tagline')}</p>

            {/* Socials */}
            <div className="mt-6 flex gap-4">
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('followOnX')}
                className="group flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-200"
              >
                <XIcon className="h-4 w-4" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('followOnInstagram')}
                className="group flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-200"
              >
                <InstagramIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-5">{col.heading}</h3>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* App download CTA */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-5">{t('getAppHeading')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('getAppDesc')}</p>
            <Link href="#" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-brand-600 dark:text-white bg-brand-500/20 border border-brand-500/30 hover:bg-brand-100 dark:hover:bg-brand-500/30 hover:border-brand-300 dark:hover:border-brand-500/50 transition-all duration-200">
              <span>📱</span>
              {t('downloadFree')}
            </Link>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="border-t border-gray-200 dark:border-white/5 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-400 dark:text-gray-500">{t('copyright', { year })}</p>
          <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <span>·</span>
            <span>Built with ❤️ by the TrivioQ team</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
