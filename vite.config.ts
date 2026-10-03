import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  // One name for the header, the tab title and the installed app (VITE_APP_NAME in .env.local).
  const appName = loadEnv(mode, root, 'VITE_').VITE_APP_NAME || 'Family Research'

  return {
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    // The Firestore SDK alone is ~700 kB minified; it is precached by the service worker after first load.
    build: { chunkSizeWarningLimit: 800 },
    plugins: [
      { name: 'app-name', transformIndexHtml: (html: string) => html.replace('%VITE_APP_NAME%', appName) },
      vue(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: appName,
          short_name: appName.length <= 12 ? appName : appName.split(' ')[0],
          // Manifests can't vary by user language; Spanish, the business's main language.
          description: 'Reserva sesiones y sigue tu investigación familiar: tareas, hallazgos y pagos.',
          lang: 'es',
          theme_color: '#7a3b69',
          background_color: '#fbf8f5',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          navigateFallback: '/index.html',
          // Firestore and Auth traffic must never be served from the SW cache.
          navigateFallbackDenylist: [/^\/__\//],
          // Fonts are not precached (each ships several subsets); cache the ones actually used.
          runtimeCaching: [
            {
              urlPattern: /\/assets\/.*\.woff2$/,
              handler: 'CacheFirst',
              options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
            },
          ],
        },
      }),
    ],
  }
})
