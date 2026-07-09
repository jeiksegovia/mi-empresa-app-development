<script setup lang="ts">
const appConfig = useAppConfig()
const sidebarVisible = ref(false)

const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value
}

const closeSidebar = () => {
  sidebarVisible.value = false
}

// Close sidebar on route change (mobile)
const route = useRoute()
watch(() => route.path, () => {
  closeSidebar()
})
</script>

<template>
  <div class="min-h-screen bg-[var(--surface-ground)]">
    <!-- Sidebar -->
    <AppSidebar
      :visible="sidebarVisible"
      @close="closeSidebar"
    />

    <!-- Main Content Wrapper -->
    <div class="flex flex-col min-h-screen transition-all duration-300">
      <!-- Header -->
      <AppHeader @toggle-sidebar="toggleSidebar" />

      <!-- Main Content -->
      <main class="flex-1 p-4 md:p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
