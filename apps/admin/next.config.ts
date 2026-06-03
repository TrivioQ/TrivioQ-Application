import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: 'standalone',
  /* config options here */
};

export default withSentryConfig(withNextIntl(nextConfig), {
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
