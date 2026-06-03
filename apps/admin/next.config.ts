import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: 'standalone',
  /* config options here */
  // Reload trigger to pick up new DATABASE_URL
};

export default withSentryConfig(withNextIntl(nextConfig), {
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
