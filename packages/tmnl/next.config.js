/** @type {import('next').NextConfig} */
const nextConfig = {
  // Core configuration
  reactStrictMode: true,
  swcMinify: true,
  
  // Environment detection
  env: {
    TMNL_SSR: process.env.TMNL_SSR === 'true',
    AVA_BACKEND_URL: process.env.AVA_BACKEND_URL || 'ws://localhost:4222',
    NATS_URL: process.env.NATS_URL || 'ws://localhost:4222',
  },
  
  // Build outputs
  distDir: 'dist',
  output: 'standalone',
  
  // Rewrites for API proxying
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.AVA_BACKEND_URL || 'http://localhost:4222'}/api/:path*`,
      },
    ]
  },
  
  // Webpack configuration for Vite compatibility
  webpack: (config, { isServer, defaultLoaders }) => {
    // Allow importing AVA Rust WASM module
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    }
    
    // Custom webpack config for AVA module resolution
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...config.resolve.fallback,
        "@tmnl/ava": require.resolve("@tmnl/ava"),
      },
    }
    
    return config
  },
  
  // Image optimization
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
