<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})
</script>

<template>
  <div>
    <AppPageHeader
      title="Certificados"
      subtitle="Gestión de certificados médicos"
    >
      <template #actions>
        <Button
          label="Nuevo Certificado"
          icon="pi pi-plus"
          severity="primary"
        />
      </template>
    </AppPageHeader>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <AppStatsCard
        title="Total Certificados"
        :value="0"
        icon="pi pi-file"
        severity="primary"
      />
      <AppStatsCard
        title="Emitidos Hoy"
        :value="0"
        icon="pi pi-check"
        severity="success"
      />
      <AppStatsCard
        title="Pendientes"
        :value="0"
        icon="pi pi-clock"
        severity="warn"
      />
      <AppStatsCard
        title="Por Vencer"
        :value="0"
        icon="pi pi-exclamation-triangle"
        severity="danger"
      />
    </div>

    <Card>
      <template #content>
        <p class="text-center text-[var(--text-color-secondary)] py-8">
          Módulo de certificados en construcción
        </p>
      </template>
    </Card>
  </div>
</template>
