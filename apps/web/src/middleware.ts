import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  // A list of all locales that are supported
  locales: ['en'],

  // Used when no locale matches
  defaultLocale: 'en',
});

export const config = {
  // Match all pathnames except for
  // - API routes
  // - Static files (_next, images, favicon, etc.)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
