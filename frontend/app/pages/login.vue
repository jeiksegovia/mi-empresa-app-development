<template>
  <div class="w-full max-w-md mx-auto">
    <div class="bg-white rounded-2xl shadow-2xl p-8">
      <div class="text-center mb-8">
        <div class="w-16 h-16 bg-violet-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <i class="pi pi-building text-3xl text-white"></i>
        </div>
        <h1 class="text-2xl font-bold text-gray-900">Mi Empresa</h1>
        <p class="text-gray-500 mt-1">Inicia sesión en tu cuenta</p>
      </div>

      <!-- Error Message -->
      <Message v-if="errorMessage" severity="error" :closable="false" class="mb-4">
        {{ errorMessage }}
      </Message>

      <form @submit.prevent="handleLogin" class="space-y-5">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
          <InputText
            id="email"
            v-model="email"
            type="email"
            placeholder="tu@email.com"
            class="w-full"
            :disabled="authStore.isLoading"
            required
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
          <Password
            id="password"
            v-model="password"
            placeholder="Ingresa tu contraseña"
            :feedback="false"
            toggleMask
            class="w-full"
            inputClass="w-full"
            :disabled="authStore.isLoading"
            required
          />
        </div>

        <Button
          type="submit"
          label="Iniciar Sesión"
          icon="pi pi-sign-in"
          class="w-full"
          :loading="authStore.isLoading"
          :disabled="authStore.isLoading"
        />
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

const authStore = useAuthStore()
const isDev = import.meta.dev
const email = ref(isDev ? 'admin@miempresa.com' : '')
const password = ref(isDev ? 'password123' : '')
const errorMessage = ref('')

const handleLogin = async () => {
  errorMessage.value = ''

  // Basic validation
  if (!email.value || !password.value) {
    errorMessage.value = 'Por favor, completa todos los campos.'
    return
  }

  const result = await authStore.login(email.value, password.value)

  if (result.success) {
    // Redirect to dashboard on success (replace to prevent back button issues)
    await navigateTo('/', { replace: true })
  } else {
    // Display error message
    errorMessage.value = result.error || 'Error al iniciar sesión. Por favor, intenta nuevamente.'
  }
}

// Clear error when user starts typing
watch([email, password], () => {
  if (errorMessage.value) {
    errorMessage.value = ''
  }
})
</script>
