/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // These packages rely on dynamic require() calls that Next.js's build-time file
  // tracing can't always follow, which silently drops files from the standalone
  // output. Marking them external makes Next.js copy their node_modules trees
  // as-is instead of trying to bundle/trace them.
  serverExternalPackages: ['@vercel/otel', '@trace0/otel-logger'],
};

module.exports = nextConfig;
