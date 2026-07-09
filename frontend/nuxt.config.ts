import Material from '@primevue/themes/material'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  // Pure SPA: auth-gated dashboard served as static files from Amplify
  // (manual deploys don't support SSR; prerendering authed pages is pointless)
  ssr: false,

  devtools: { enabled: true },
  devServer: {
    port: 3100,
    host: '0.0.0.0',
  },

  modules: [
    '@pinia/nuxt',
    '@primevue/nuxt-module'
  ],

  css: [
    'primeicons/primeicons.css',
    '~/assets/css/main.css',
  ],

  primevue: {
    options: {
      theme: {
        preset: Material,
        options: {
          prefix: 'p',
          darkModeSelector: '.dark',
          cssLayer: false,
        },
      },
    },
    autoImport: true,
  },

  vite: {
    plugins: [
      tailwindcss() as any, // Type compatibility fix for Tailwind CSS v4 Vite plugin
    ],
    server: {
      allowedHosts: ['localhost', '127.0.0.1', '10.57.126.228', '100.85.193.33'],
    },
  },

  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3101/api/v1',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false, // Disable during build for faster compilation
  },

  app: {
    head: {
      title: 'Mi Empresa',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Mi Empresa - Sistema de gestión empresarial' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },

})
