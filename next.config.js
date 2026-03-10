const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = withSentryConfig(nextConfig, {
  // Suppresses source map upload logs during build
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps in CI/production builds with auth token present
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Hides source maps from generated client bundles
  hideSourceMaps: true,
  // Transpiles SDK to be compatible with IE11 (increases bundle size)
  disableLogger: true,
});
