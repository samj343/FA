/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdf-parse reads test fixtures at require-time if bundled; keep it external.
    serverComponentsExternalPackages: ['pdf-parse'],
  },
};

export default nextConfig;
