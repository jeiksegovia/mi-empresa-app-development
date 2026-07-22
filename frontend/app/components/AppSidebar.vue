<script setup lang="ts">
const appConfig = useAppConfig()
const authStore = useAuthStore()
const route = useRoute()

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { can } = useDomainAccess()

const sidebarWidth = computed(() => appConfig.sidebar.width)
const menuItems = computed(() => appConfig.sidebar.items)

// Filter menu items based on role + RBAC domain matrix (§1.5).
const filteredMenuItems = computed(() => {
  return menuItems.value.filter(item => {
    // Hide "Empresa" menu item for non-admin users (pre-existing rule).
    if (item.to === '/empresa' && !authStore.isAdmin) {
      return false
    }
    // Hide any section whose guarding domain is forbidden for this profile.
    const domain = domainForPath(item.to)
    if (domain && !can(domain)) {
      return false
    }
    return true
  })
})

const userInitials = computed(() => {
  return authStore.fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
})

const isActive = (path: string) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

const handleLogout = async () => {
  await authStore.logout()
}
</script>

<template>
  <aside
    :class="[
      'fixed left-0 top-0 h-screen bg-[var(--surface-section)] border-r border-[var(--surface-border)] transition-transform duration-300 z-40 flex flex-col',
      visible ? 'translate-x-0' : '-translate-x-full'
    ]"
    :style="{ width: `${sidebarWidth}px` }"
  >
    <!-- User Info Section -->
    <div class="p-4">
      <div class="flex items-center gap-3">
        <Avatar
          :label="userInitials"
          class="bg-violet-500 text-white"
          shape="circle"
          size="large"
        />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-[var(--text-color)] truncate">
            {{ authStore.fullName }}
          </p>
          <p class="text-xs text-[var(--text-color-secondary)] truncate">
            {{ authStore.role }}
          </p>
        </div>
      </div>
    </div>

    <!-- Navigation Menu -->
    <nav class="flex-1 overflow-y-auto p-2">
      <ul class="space-y-1">
        <li v-for="item in filteredMenuItems" :key="item.to">
          <NuxtLink
            :to="item.disabled ? '#' : item.to"
            :class="[
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
              isActive(item.to) && !item.disabled
                ? 'bg-violet-500 text-white'
                : item.disabled
                ? 'text-[var(--text-color-secondary)] opacity-50 cursor-not-allowed'
                : 'text-[var(--text-color)] hover:bg-[var(--surface-hover)]',
            ]"
            @click="item.disabled ? undefined : emit('close')"
          >
            <i :class="[item.icon, 'text-lg']" />
            <span class="font-medium">{{ item.label }}</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <!-- Logout Button -->
    <div class="p-4">
      <Button
        label="Cerrar Sesión"
        icon="pi pi-sign-out"
        @click="handleLogout"
        class="w-full"
        severity="secondary"
        outlined
      />
    </div>
  </aside>

  <!-- Overlay for mobile -->
  <div
    v-if="visible"
    class="fixed inset-0 bg-black/50 z-30"
    @click="emit('close')"
  />
</template>
