import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: ['admin.trivioq.com'],
    },
  },
};

const isDev = process.env.NODE_ENV === 'development';

export default isDev 
  ? withNextIntl(nextConfig)
  : withSentryConfig(withNextIntl(nextConfig), {
      sourcemaps: {
        deleteSourcemapsAfterUpload: true,
      },
    });
