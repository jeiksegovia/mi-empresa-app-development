import { getPrisma } from '../config/database'
import { noteCreateSchema, noteUpdateSchema } from '../utils/validation'
import { z } from 'zod'

const prisma = getPrisma()

export async function listNotes(foiaRequestId: string) {
  return prisma.note.findMany({ 
    where: { 
      foiaRequestId,
      deletedAt: null // Only return non-deleted notes
    }, 
    include: { creator: true },
    orderBy: { createdAt: 'desc' }
  })
}

export async function getNote(id: string) {
  return prisma.note.findUnique({ 
    where: { 
      id,
      deletedAt: null // Only return non-deleted notes
    }, 
    include: { creator: true } 
  })
}

export async function createNote(data: z.infer<typeof noteCreateSchema>, createdBy: string) {
  const parsed = noteCreateSchema.parse(data)
  return prisma.note.create({ 
    data: {
      ...parsed,
      createdBy
    },
    include: { creator: true }
  })
}

export async function updateNote(id: string, data: z.infer<typeof noteUpdateSchema>) {
  const parsed = noteUpdateSchema.parse(data)
  try {
    return await prisma.note.update({ 
      where: { 
        id,
        deletedAt: null // Only allow updates on non-deleted notes
      }, 
      data: parsed,
      include: { creator: true }
    })
  } catch (e: any) {
    if (e.code === 'P2025') return null
    throw e
  }
}

export async function deleteNote(id: string) {
  try {
    // Soft delete: set deletedAt timestamp instead of actually deleting
    const result = await prisma.note.update({
      where: { 
        id,
        deletedAt: null // Only allow soft delete on non-deleted notes
      },
      data: { 
        deletedAt: new Date() 
      }
    })
    return !!result
  } catch (e: any) {
    if (e.code === 'P2025') return false
    throw e
  }
}

export async function getPublicNotes(foiaRequestId: string) {
  return prisma.note.findMany({ 
    where: { 
      foiaRequestId,
      isInternal: false, // Only return public notes
      deletedAt: null // Only return non-deleted notes
    }, 
    include: { creator: true },
    orderBy: { createdAt: 'desc' }
  })
}

export async function getInternalNotes(foiaRequestId: string) {
  return prisma.note.findMany({ 
    where: { 
      foiaRequestId,
      deletedAt: null // Only return non-deleted notes
    }, 
    include: { creator: true },
    orderBy: { createdAt: 'desc' }
  })
}
