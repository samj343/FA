/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdf-parse reads test fixtures at require-time if bundled, and pdfkit
    // loads its built-in AFM font files from disk — keep both external.
    serverComponentsExternalPackages: ['pdf-parse', 'pdfkit'],
  },
};

export default nextConfig;
