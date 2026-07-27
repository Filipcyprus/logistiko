/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse (μέσω pdfjs-dist) δεν είναι συμβατό με το webpack bundling του Next.js για
  // Server Components· πρέπει να τρέχει ως κανονικό Node require() κατά το request, όχι bundled.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist"],
  },
};

export default nextConfig;
