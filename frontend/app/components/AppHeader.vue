<script setup lang="ts">
const appConfig = useAppConfig()
const authStore = useAuthStore()
const { isDark, toggleTheme } = useTheme()

const emit = defineEmits<{
  toggleSidebar: []
}>()

const userInitials = computed(() => {
  return authStore.fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
})

const userMenuItems = ref([
  {
    label: 'Perfil',
    icon: 'pi pi-user',
    command: () => {
      navigateTo('/perfil')
    },
  },
  {
    separator: true,
  },
  {
    label: 'Cerrar Sesión',
    icon: 'pi pi-sign-out',
    command: () => {
      authStore.logout()
    },
  },
])

const userMenuRef = ref()

const toggleUserMenu = (event: Event) => {
  userMenuRef.value.toggle(event)
}
</script>

<template>
  <header class="sticky top-0 z-30 bg-[var(--surface-section)] border-b border-[var(--surface-border)]">
    <div class="flex items-center justify-between px-4 h-16">
      <!-- Left Section: Menu Toggle + Logo -->
      <div class="flex items-center gap-4">
        <Button
          icon="pi pi-bars"
          text
          rounded
          @click="emit('toggleSidebar')"
          class="md:hidden"
          aria-label="Toggle menu"
        />
        
        <div class="flex items-center gap-3">
          <i class="pi pi-briefcase text-2xl text-violet-500" />
          <span class="text-xl font-semibold text-[var(--text-color)] hidden sm:inline">
            {{ appConfig.app.name }}
          </span>
        </div>
      </div>

      <!-- Right Section: Theme Toggle + User Menu -->
      <div class="flex items-center gap-2">
        <!-- Theme Toggle -->
        <Button
          :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'"
          text
          rounded
          @click="toggleTheme"
          aria-label="Toggle theme"
        />

        <!-- User Menu -->
        <div class="flex items-center gap-3 pl-2">
          <div class="hidden md:block text-right">
            <p class="text-sm font-medium text-[var(--text-color)]">
              {{ authStore.fullName }}
            </p>
            <p class="text-xs text-[var(--text-color-secondary)]">
              {{ authStore.role }}
            </p>
          </div>
          
          <Button
            @click="toggleUserMenu"
            text
            rounded
            aria-label="User menu"
          >
            <Avatar
              :label="userInitials"
              class="bg-violet-500 text-white"
              shape="circle"
            />
          </Button>
          
          <Menu
            ref="userMenuRef"
            :model="userMenuItems"
            popup
          />
        </div>
      </div>
    </div>
  </header>
</template>
