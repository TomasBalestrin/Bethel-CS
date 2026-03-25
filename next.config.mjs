import withPWAInit from 'next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    // Static assets — CacheFirst 7 days
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    // Google Fonts — CacheFirst 30 days
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: { maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    // Images — CacheFirst 7 days
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    // Dashboard & main pages — StaleWhileRevalidate
    {
      urlPattern: /^\/(dashboard|etapas-iniciais|etapas-mentoria|mentorados)(\/.*)?$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'pages',
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
      },
    },
    // API routes — NetworkFirst, no cache
    {
      urlPattern: /\/api\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api',
        expiration: { maxEntries: 50, maxAgeSeconds: 0 },
        networkTimeoutSeconds: 10,
      },
    },
    // Chat pages — NetworkFirst, no cache
    {
      urlPattern: /\/chat\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'chat',
        expiration: { maxEntries: 20, maxAgeSeconds: 0 },
        networkTimeoutSeconds: 10,
      },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {}

export default withPWA(nextConfig)
