import bcrypt from 'bcrypt'
import { getPrisma } from '../config/database.js'
import { signJwt } from '../utils/jwt.js'
import { UserTokenPayload } from '../types/common.js'

const SESSION_EXPIRATION_DAYS = 7

export interface LoginResult {
  user: {
    id: number
    email: string
    rol: string
    nombre: string
    apellido: string
  }
  sessionToken: string
}

export interface CurrentUserResult {
  id: number
  email: string
  rol: string
  nombre: string
  apellido: string
  activo: boolean
}

/**
 * Authenticate user with email and password, create session
 */
export async function loginUser(
  email: string,
  password: string,
  ip?: string,
  userAgent?: string
): Promise<LoginResult> {
  const prisma = getPrisma()

  // Find user by email
  const usuario = await prisma.usuario.findUnique({
    where: { email },
  })

  if (!usuario) {
    throw new Error('Credenciales inválidas')
  }

  // Check if user is active
  if (!usuario.activo) {
    throw new Error('Usuario inactivo')
  }

  // Verify password
  const passwordMatch = await bcrypt.compare(password, usuario.password)
  if (!passwordMatch) {
    throw new Error('Credenciales inválidas')
  }

  // Get user permissions based on role
  const permisos = getRolePermissions(usuario.rol)

  // Create session in database
  const expiraEn = new Date()
  expiraEn.setDate(expiraEn.getDate() + SESSION_EXPIRATION_DAYS)

  const sesion = await prisma.sesion.create({
    data: {
      usuarioId: usuario.id,
      token: '', // Will be updated after JWT generation
      ip: ip || null,
      userAgent: userAgent || null,
      expiraEn,
      activa: true,
    },
  })

  // Create JWT token payload
  const tokenPayload: UserTokenPayload = {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    rol: usuario.rol,
    permisos,
    sessionId: sesion.id.toString(),
  }

  // Generate JWT token
  const sessionToken = signJwt(tokenPayload)

  // Update session with token
  await prisma.sesion.update({
    where: { id: sesion.id },
    data: { token: sessionToken },
  })

  return {
    user: {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
    },
    sessionToken,
  }
}

/**
 * Invalidate user session
 */
export async function logoutUser(sessionToken: string): Promise<void> {
  const prisma = getPrisma()

  await prisma.sesion.updateMany({
    where: {
      token: sessionToken,
      activa: true,
    },
    data: {
      activa: false,
    },
  })
}

/**
 * Get current user from valid session
 */
export async function getCurrentUser(userId: number): Promise<CurrentUserResult> {
  const prisma = getPrisma()

  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      rol: true,
      nombre: true,
      apellido: true,
      activo: true,
    },
  })

  if (!usuario) {
    throw new Error('Usuario no encontrado')
  }

  return usuario
}

/**
 * Refresh session by extending expiration
 */
export async function refreshSession(sessionId: number): Promise<string> {
  const prisma = getPrisma()

  // Get current session
  const sesion = await prisma.sesion.findFirst({
    where: {
      id: sessionId,
      activa: true,
    },
    include: {
      usuario: true,
    },
  })

  if (!sesion) {
    throw new Error('Sesión inválida o expirada')
  }

  // Check if user is still active
  if (!sesion.usuario.activo) {
    throw new Error('Usuario inactivo')
  }

  // Extend session expiration
  const nuevaExpiracion = new Date()
  nuevaExpiracion.setDate(nuevaExpiracion.getDate() + SESSION_EXPIRATION_DAYS)

  // Get user permissions
  const permisos = getRolePermissions(sesion.usuario.rol)

  // Create new JWT token
  const tokenPayload: UserTokenPayload = {
    id: sesion.usuario.id,
    email: sesion.usuario.email,
    nombre: sesion.usuario.nombre,
    apellido: sesion.usuario.apellido,
    rol: sesion.usuario.rol,
    permisos,
    sessionId: sesion.id.toString(),
  }

  const newToken = signJwt(tokenPayload)

  // Update session
  await prisma.sesion.update({
    where: { id: sesion.id },
    data: {
      token: newToken,
      expiraEn: nuevaExpiracion,
    },
  })

  return newToken
}

/**
 * Get role-based permissions
 */
function getRolePermissions(rol: string): string[] {
  const permissionMap: Record<string, string[]> = {
    ADMIN: ['*'], // All permissions
    EMPLEADO: ['read:empleados', 'write:empleados', 'read:clientes', 'write:clientes'],
    AUDITOR: ['read:empleados', 'read:clientes', 'read:nominas', 'read:reportes'],
    OPERADOR: ['read:clientes', 'write:clientes', 'read:instrumentos'],
  }

  return permissionMap[rol] || []
}
