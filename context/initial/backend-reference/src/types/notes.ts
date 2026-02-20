import { NoteType, NotePriority, NoteCategory } from '../generated/prisma'
import { FOIAUserSummary, ISODateString } from './common'

// Public-facing note shape: safe fields for requesters/externals
export interface NotePublic {
  id: string
  content: string
  noteType: NoteType
  priority: NotePriority
  category: NoteCategory
  isInternal: boolean
  deletedAt: ISODateString | null
  createdAt: ISODateString | null
  updatedAt: ISODateString | null
}

// Internal note shape: full note data for authenticated staff
export interface NoteInternal {
  id: string
  foiaRequestId: string
  content: string
  noteType: NoteType
  priority: NotePriority
  category: NoteCategory
  createdBy: string
  isInternal: boolean
  deletedAt: ISODateString | null
  createdAt: ISODateString | null
  updatedAt: ISODateString | null
  creator: FOIAUserSummary | null
}
