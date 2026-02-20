<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: ['auth'],
})

const recentActivities = [
  {
    icon: 'pi pi-user-plus',
    iconBg: 'rgba(139, 92, 246, 0.1)',
    iconColor: '#8b5cf6',
    title: 'Nuevo empleado registrado',
    subtitle: 'Ana María Torres - Hace 2 horas',
  },
  {
    icon: 'pi pi-exclamation-triangle',
    iconBg: 'rgba(251, 146, 60, 0.1)',
    iconColor: '#fb923c',
    title: 'Certificado próximo a vencer',
    subtitle: 'Juan Pérez - Trabajo en Alturas - Vence en 5 días',
  },
  {
    icon: 'pi pi-check',
    iconBg: 'rgba(34, 197, 94, 0.1)',
    iconColor: '#22c55e',
    title: 'Contrato renovado exitosamente',
    subtitle: 'María López - Contrato a término fijo - Hace 1 día',
  },
  {
    icon: 'pi pi-user-edit',
    iconBg: 'rgba(59, 130, 246, 0.1)',
    iconColor: '#3b82f6',
    title: 'Nueva nota agregada a cliente',
    subtitle: 'Cliente: Roberto Gómez - Hace 3 horas',
  },
]
</script>

<template>
  <div>
    <!-- Page Title -->
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-[var(--text-color)] mb-2">
        Bienvenido a Mi Empresa App
      </h2>
      <p class="text-[var(--text-color-secondary)]">
        Gestiona tu empresa desde estos 4 módulos principales
      </p>
    </div>

    <!-- 4 Main Module Cards in 2x2 grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

      <!-- Module 1: Certificación Empresarial -->
      <Card
        class="cursor-pointer hover:shadow-lg transition-shadow"
        @click="navigateTo('/certificados')"
      >
        <template #content>
          <div class="flex items-start gap-4">
            <div
              class="flex items-center justify-center w-16 h-16 rounded-xl flex-shrink-0"
              style="background: rgba(139, 92, 246, 0.1);"
            >
              <i class="pi pi-file-check text-3xl text-violet-500" />
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold text-[var(--text-color)] mb-2">
                Certificación Empresarial
              </h3>
              <p class="text-sm text-[var(--text-color-secondary)] mb-4">
                Gestiona documentos regulatorios: RUT, Cámara de Comercio, permisos sanitarios. Recibe alertas 30 días antes del vencimiento.
              </p>
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-violet-500">Ir al módulo</span>
                <i class="pi pi-arrow-right text-xs text-violet-500" />
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Module 2: Gestión de Personal -->
      <Card
        class="cursor-pointer hover:shadow-lg transition-shadow"
        @click="navigateTo('/empleados')"
      >
        <template #content>
          <div class="flex items-start gap-4">
            <div
              class="flex items-center justify-center w-16 h-16 rounded-xl flex-shrink-0"
              style="background: rgba(34, 197, 94, 0.1);"
            >
              <i class="pi pi-users text-3xl" style="color: #22c55e;" />
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold text-[var(--text-color)] mb-2">
                Gestión de Personal
              </h3>
              <p class="text-sm text-[var(--text-color-secondary)] mb-4">
                Administra empleados, contratos y certificaciones. Incluye plantillas legales pre-cargadas como sugerencias.
              </p>
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium" style="color: #22c55e;">Ir al módulo</span>
                <i class="pi pi-arrow-right text-xs" style="color: #22c55e;" />
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Module 3: Gestión de Clientes -->
      <Card
        class="cursor-pointer hover:shadow-lg transition-shadow"
        @click="navigateTo('/pacientes')"
      >
        <template #content>
          <div class="flex items-start gap-4">
            <div
              class="flex items-center justify-center w-16 h-16 rounded-xl flex-shrink-0"
              style="background: rgba(59, 130, 246, 0.1);"
            >
              <i class="pi pi-user text-3xl" style="color: #3b82f6;" />
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold text-[var(--text-color)] mb-2">
                Gestión de Clientes
              </h3>
              <p class="text-sm text-[var(--text-color-secondary)] mb-4">
                Centraliza toda la información de tus clientes: historiales, notas, documentación y seguimiento organizado.
              </p>
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium" style="color: #3b82f6;">Ir al módulo</span>
                <i class="pi pi-arrow-right text-xs" style="color: #3b82f6;" />
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Module 4: Nómina y Finanzas -->
      <Card
        class="cursor-pointer hover:shadow-lg transition-shadow opacity-70"
        @click="navigateTo('/nomina')"
      >
        <template #content>
          <div class="flex items-start gap-4">
            <div
              class="flex items-center justify-center w-16 h-16 rounded-xl flex-shrink-0"
              style="background: rgba(251, 146, 60, 0.1);"
            >
              <i class="pi pi-calculator text-3xl" style="color: #fb923c;" />
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold text-[var(--text-color)] mb-2">
                Nómina y Finanzas
              </h3>
              <p class="text-sm text-[var(--text-color-secondary)] mb-4">
                Cálculo automático de salarios, deducciones y comprobantes de pago. Próximamente disponible.
              </p>
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium" style="color: #fb923c;">Ir al módulo</span>
                <i class="pi pi-arrow-right text-xs" style="color: #fb923c;" />
              </div>
            </div>
          </div>
        </template>
      </Card>

    </div>

    <!-- Recent Activity -->
    <Card>
      <template #content>
        <h3 class="text-lg font-semibold text-[var(--text-color)] mb-6">
          Actividad Reciente
        </h3>
        <div class="space-y-4">
          <div
            v-for="activity in recentActivities"
            :key="activity.title"
            class="flex items-start gap-4 p-3 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          >
            <div
              class="flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0"
              :style="{ background: activity.iconBg }"
            >
              <i :class="[activity.icon, 'text-base']" :style="{ color: activity.iconColor }" />
            </div>
            <div class="flex-1">
              <p class="font-medium text-[var(--text-color)] mb-1">{{ activity.title }}</p>
              <p class="text-sm text-[var(--text-color-secondary)]">{{ activity.subtitle }}</p>
            </div>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
