import { getPrisma } from '../config/database.js'

export interface DashboardStats {
  empleados: number
  pacientes: number
  instrumentos: number
  certificados: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const prisma = getPrisma()

  const [empleados, pacientes, instrumentos, certificados] = await Promise.all([
    prisma.empleado.count({ where: { estado: 'ACTIVO' } }),
    prisma.cliente.count({ where: { estado: 'ACTIVO' } }),
    prisma.instrumento.count({ where: { estado: 'ACTIVO' } }),
    prisma.certificadoEmpleado.count(),
  ])

  return { empleados, pacientes, instrumentos, certificados }
}

export interface ActivityItem {
  type: 'ficha_completada' | 'patient_created' | 'employee_created'
  date: Date
  description: string
  actorName: string | null
}

export async function getDashboardActivity(userId: number, userRole: string): Promise<ActivityItem[]> {
  const prisma = getPrisma()
  const activities: ActivityItem[] = []

  if (userRole === 'ADMIN') {
    // Admin sees all activity
    const [recentFichas, recentPatients, recentEmployees] = await Promise.all([
      prisma.registroFichaCompletada.findMany({
        take: 10,
        orderBy: { fechaCreacionRegistro: 'desc' },
        include: {
          instrumento: { select: { nombreInstrumento: true } },
          cliente: { select: { nombre: true } },
          usuarioResponsable: { select: { nombre: true, apellido: true } },
        },
      }),
      prisma.cliente.findMany({
        take: 5,
        orderBy: { fechaIngreso: 'desc' },
      }),
      prisma.empleado.findMany({
        take: 5,
        orderBy: { fechaRegistro: 'desc' },
      }),
    ])

    recentFichas.forEach((f) => {
      activities.push({
        type: 'ficha_completada',
        date: f.fechaCreacionRegistro,
        description: `Ficha "${f.instrumento.nombreInstrumento}" para ${f.cliente.nombre} — Estado: ${f.estado}`,
        actorName: f.usuarioResponsable ? `${f.usuarioResponsable.nombre} ${f.usuarioResponsable.apellido}` : null,
      })
    })

    recentPatients.forEach((p) => {
      activities.push({
        type: 'patient_created',
        date: p.fechaIngreso,
        description: `Nuevo paciente registrado: ${p.nombre}`,
        actorName: null,
      })
    })

    recentEmployees.forEach((e) => {
      activities.push({
        type: 'employee_created',
        date: e.fechaRegistro,
        description: `Nuevo empleado registrado: ${e.nombre} ${e.apellido}`,
        actorName: null,
      })
    })
  } else {
    // Employee sees own fichas only
    const recentFichas = await prisma.registroFichaCompletada.findMany({
      where: { responsable: userId },
      take: 20,
      orderBy: { fechaCreacionRegistro: 'desc' },
      include: {
        instrumento: { select: { nombreInstrumento: true } },
        cliente: { select: { nombre: true } },
      },
    })

    recentFichas.forEach((f) => {
      activities.push({
        type: 'ficha_completada',
        date: f.fechaCreacionRegistro,
        description: `Ficha "${f.instrumento.nombreInstrumento}" para ${f.cliente.nombre} — Estado: ${f.estado}`,
        actorName: null,
      })
    })
  }

  // Sort by date descending, take top 20
  return activities
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 20)
}

