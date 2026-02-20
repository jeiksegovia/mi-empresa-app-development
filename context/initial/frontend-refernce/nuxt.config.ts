// https://nuxt.com/docs/api/configuration/nuxt-config
import Material from '@primeuix/themes/material';
import PrimeUI from 'tailwindcss-primeui';
export default defineNuxtConfig({
  devtools: { enabled: true },
  typescript: {
    strict: true,
    typeCheck: true
  },
  modules: ['@primevue/nuxt-module', '@pinia/nuxt', '@nuxtjs/tailwindcss'],
  css: ['~/assets/css/tailwind.css'],
  primevue: {
    options: {
      theme: {
        preset: Material,
        options: {
          darkModeSelector: '.p-dark',
          prefix: 'p',
          cssLayer: {
            name: 'primevue',
            order: 'tailwind-base, primevue, tailwind-utilities'
          }
        }
      },
      ripple: true
    },
    autoImport: true
  },
  tailwindcss: {
    config: {
      darkMode: ['class', '.p-dark'],
      plugins: [PrimeUI]
    }
  },
  pinia: {
    // storesDirs: ['./stores/**', './custom-folder/stores/**'],
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001/api'
    }
  },
  app: {
    head: {
      title: 'Mi Empresa App',
      meta: [
        {
          name: 'description',
          content:
            'Aplicación de gestión empresarial para administración de personal, nómina, ausencias, vacaciones y presupuesto financiero.'
        }
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }]
    }
  },
  future: {
    compatibilityVersion: 4
  },
  imports: {
    autoImport: true
  }
});
