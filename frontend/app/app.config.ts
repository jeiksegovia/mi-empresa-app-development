export default defineAppConfig({
  app: {
    name: 'Mi Empresa',
    description: 'Sistema de gestión empresarial',
    version: '1.0.0',
  },
  sidebar: {
    width: 280,
    items: [
      { label: 'Inicio', icon: 'pi pi-home', to: '/' },
      { label: 'Empleados', icon: 'pi pi-users', to: '/empleados' },
      { label: 'Asistencia', icon: 'pi pi-calendar', to: '/asistencia' },
      // qa-session-aug-17 §1.4: insert IMMEDIATELY AFTER Asistencia.
      { label: 'Registro de actividades', icon: 'pi pi-list', to: '/actividades' },
      { label: 'Pacientes', icon: 'pi pi-user', to: '/pacientes' },
      { label: 'Instrumentos', icon: 'pi pi-clipboard', to: '/instrumentos' },
      { label: 'Certificados', icon: 'pi pi-file', to: '/certificados' },
      { label: 'Nomina', icon: 'pi pi-wallet', to: '/nomina' },
      // feature-centro-costos-ago-5: nav entry. Filtered by RBAC via AppSidebar.
      { label: 'Centro de Costos', icon: 'pi pi-chart-pie', to: '/centro-costos' },
      { label: 'Reportes', icon: 'pi pi-chart-bar', to: '/reportes', disabled: true },
      { label: 'Empresa', icon: 'pi pi-building', to: '/empresa' },
      { label: 'Configuracion', icon: 'pi pi-cog', to: '/configuracion', disabled: true },
    ],
  },
})
