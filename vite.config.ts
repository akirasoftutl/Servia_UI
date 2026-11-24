/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const COLOR_SERVIA = '#E27441'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon.png'],
      workbox: {
        globIgnores: ['**/firebase-messaging-sw.js'],
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,avif,json,woff,woff2}'
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
      },

      manifest: {
        name: 'Servia · Panel del negocio',
        short_name: 'Servia Negocio',
        description: 'Administra el perfil, los servicios, el horario y las reservas de tu negocio.',
        lang: 'es-MX',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: COLOR_SERVIA,
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Para probar la instalación en `npm run dev`, cambiar a true.
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/pruebas/setup.ts'],
    // jsdom tarda en crear el entorno; damos margen para que las pruebas de
    // rutas no fallen por carga del equipo o del CI.
    testTimeout: 15_000,
  },
})
