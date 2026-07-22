/**
 * useCargoRoles — options source for the instrument "roles permitidos"
 * MultiSelect.
 *
 * QA jul-11 I2: roles must mirror the per-empresa CargoEmpresa catalog
 * (e.g. AUXILIAR DE ENFERMERÍA, GERONTÓLOGA) plus ADMIN — which is always
 * available and default-selected — instead of the legacy hardcoded
 * RolUsuario values (EMPLEADO/AUDITOR/OPERADOR).
 *
 * Any values already selected on the instrument are merged into the options
 * so legacy instruments keep rendering their chips and stay editable.
 */
import type { Ref } from 'vue'

interface CargoEmpresa {
  id: number
  nombre: string
  activo: boolean
}

export function useCargoRoles(current?: Ref<string[]>) {
  const { apiFetch } = useApi()
  const cargoNames = ref<string[]>([])

  async function fetchCargoRoles(): Promise<void> {
    try {
      const res = await apiFetch<{ success: boolean; data: CargoEmpresa[] }>('/empresa/cargos')
      cargoNames.value = (res.data ?? [])
        .filter((c) => c.activo !== false)
        .map((c) => c.nombre)
    } catch {
      // No empresa yet (or request failed) — ADMIN-only options still work.
      cargoNames.value = []
    }
  }

  const roleOptions = computed(() => {
    const set = new Set<string>(['ADMIN', ...cargoNames.value, ...(current?.value ?? [])])
    return Array.from(set)
  })

  return { fetchCargoRoles, roleOptions }
}
