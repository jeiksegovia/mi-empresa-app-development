import Material from '@primevue/themes/material'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  future: {
    compatibilityVersion: 4,
  },

  devtools: { enabled: true },

  modules: [
    '@pinia/nuxt',
    '@primevue/nuxt-module'
  ],

  css: [
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
  },

  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3001/api/v1',
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
