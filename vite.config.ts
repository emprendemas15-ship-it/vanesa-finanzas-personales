import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const configuredBase = loadEnv(mode, '.', '').VITE_BASE_PATH || '/'
  const base = configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Vanesa · Finanzas personales',
          short_name: 'Vanesa',
          description: 'Control local y privado de tus finanzas personales.',
          lang: 'es-CO',
          display: 'standalone',
          start_url: base,
          scope: base,
          theme_color: '#123d32',
          background_color: '#f5f7f5',
          icons: [
            { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png' },
            { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: 'index.html'
        },
        devOptions: { enabled: true }
      })
    ]
  }
})
