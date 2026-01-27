/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use Babel instead of SWC if SWC fails
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Ensure FFmpeg.wasm works in browser
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        util: false,
      };
    }
    return config;
  },
  // Optimize for video handling
  experimental: {
    optimizePackageImports: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  // Headers for FFmpeg.wasm files
  async headers() {
    return [
      {
        source: '/ffmpeg/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
  // Explicitly use webpack instead of Turbopack for FFmpeg.wasm compatibility
  // Turbopack doesn't support webpack fallbacks yet
};

export default nextConfig;
