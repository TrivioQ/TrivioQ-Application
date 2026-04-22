import "./env.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@trivioq/shared-types"],
};

export default nextConfig;
