import { getPrisma } from '../config/database.js'

export interface EmpresaDetail {
  id: number
  nombre: string
  nit: string
  direccion: string | null
  telefono: string | null
  email: string | null
  activa: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UpdateEmpresaInput {
  nombre?: string
  nit?: string
  direccion?: string
  telefono?: string
  email?: string
}

export async function getEmpresa(): Promise<EmpresaDetail | null> {
  const prisma = getPrisma()
  const empresa = await prisma.empresa.findFirst({
    where: { activa: true },
    orderBy: { id: 'asc' },
  })
  return empresa
}

export async function updateEmpresa(id: number, input: UpdateEmpresaInput): Promise<EmpresaDetail> {
  const prisma = getPrisma()
  const existing = await prisma.empresa.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('Empresa not found')
  }
  const empresa = await prisma.empresa.update({
    where: { id },
    data: input,
  })
  return empresa
}
