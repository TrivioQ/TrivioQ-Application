import createNextIntlPlugin from 'next-intl/plugin';
import "./env.mjs";

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@trivioq/shared-types"],
};

export default withNextIntl(nextConfig);
