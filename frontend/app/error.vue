<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-50">
    <div class="text-center p-8">
      <h1 class="text-6xl font-bold text-violet-600 mb-4">{{ error?.statusCode || 500 }}</h1>
      <p class="text-xl text-gray-600 mb-6">{{ error?.message || 'Ha ocurrido un error' }}</p>
      <button
        class="px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
        @click="handleError"
      >
        Volver al inicio
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  error: {
    statusCode: number
    message: string
  }
}>()

const handleError = () => clearError({ redirect: '/' })
</script>
