import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }
// GitHub Actions fournit le commit déployé ; en local on affiche « dev »
const commit = process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev'

// L'application est publiée depuis le dépôt de distribution :
// https://magiccode666.github.io/MarniarauCrypto-dist/
export default defineConfig({
  base: '/MarniarauCrypto-dist/',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(commit),
  },
  // Port fixe : les liens des emails d'authentification n'aboutissent qu'à localhost:5173.
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['prototype/**', 'node_modules/**'],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'MarniarauCrypto',
        short_name: 'MarniarauCrypto',
        description: 'Suivi, analyse et simulation crypto pour apprendre. Outil éducatif.',
        lang: 'fr',
        theme_color: '#0f1419',
        background_color: '#0f1419',
        display: 'standalone',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
