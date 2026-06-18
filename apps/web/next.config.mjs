import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';
import "./env.mjs";

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ["@trivioq/shared-types"],
  experimental: {
    serverActions: {
      allowedOrigins: ['trivioq.com'],
    },
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
