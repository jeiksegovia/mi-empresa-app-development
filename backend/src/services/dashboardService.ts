import { getPrisma } from '../config/database.js'

export interface DashboardStats {
  empleados: number
  pacientes: number
  instrumentos: number
  certificados: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const prisma = getPrisma()

  const [empleados, pacientes, instrumentos, certAlturas, certElectrico] = await Promise.all([
    prisma.empleado.count({ where: { estado: 'ACTIVO' } }),
    prisma.cliente.count({ where: { estado: 'ACTIVO' } }),
    prisma.instrumento.count({ where: { estado: 'ACTIVO' } }),
    prisma.certificadoAlturas.count(),
    prisma.certificadoRiesgoElectrico.count(),
  ])

  const certificados = certAlturas + certElectrico

  return { empleados, pacientes, instrumentos, certificados }
}
