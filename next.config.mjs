/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    // Remove serverExternalPackages as it's not recognized in Next.js 15
    // Instead, use webpack config to handle external packages
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
}

export default config;