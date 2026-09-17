import { PrismaClient } from '../src/generated/prisma'
import bcrypt from 'bcryptjs'
import userData from './seed-data/users.json'
import requestData from './seed-data/foia-requests.json'
import documentData from './seed-data/documents.json'
import noteData from './seed-data/notes.json'
import { getPrisma } from '../src/config/database'

const prisma = getPrisma()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create roles
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'Administrator' },
      update: {},
      create: {
        name: 'Administrator',
        description: 'Full access to all system functions'
      }
    }),
    prisma.role.upsert({
      where: { name: 'Supervisor/Manager' },
      update: {},
      create: {
        name: 'Supervisor/Manager',
        description: 'Can assign/reassign cases'
      }
    }),
    prisma.role.upsert({
      where: { name: 'Specialist' },
      update: {},
      create: {
        name: 'Specialist',
        description: 'Can process and review documents, update request status'
      }
    }),
    prisma.role.upsert({
      where: { name: 'User' },
      update: {},
      create: {
        name: 'User',
        description: 'Can update status of cases assigned to them'
      }
    }),
    prisma.role.upsert({
      where: { name: 'Requestor' },
      update: {},
      create: {
        name: 'Requestor',
        description: 'Portal access only; can see updates for their requests'
      }
    })
  ])

  console.log('✅ Roles created:', roles.map(r => r.name))

  // Create permissions based on frontend mock data
  const permissions = await Promise.all([
    prisma.permission.upsert({
      where: { name: 'review_documents' },
      update: {},
      create: {
        name: 'review_documents',
        description: 'Can Review Documents'
      }
    }),
    prisma.permission.upsert({
      where: { name: 'upload_documents' },
      update: {},
      create: {
        name: 'upload_documents',
        description: 'Can Upload Documents'
      }
    }),
    prisma.permission.upsert({
      where: { name: 'release_documents' },
      update: {},
      create: {
        name: 'release_documents',
        description: 'Can Release Documents'
      }
    }),
    prisma.permission.upsert({
      where: { name: 'redact_documents' },
      update: {},
      create: {
        name: 'redact_documents',
        description: 'Can Redact Documents'
      }
    }),
    prisma.permission.upsert({
      where: { name: 'assign_cases' },
      update: {},
      create: {
        name: 'assign_cases',
        description: 'Can assign cases to other Users'
      }
    }),
    prisma.permission.upsert({
      where: { name: 'reassign_cases' },
      update: {},
      create: {
        name: 'reassign_cases',
        description: 'Can re-assign cases to other users'
      }
    }),
    prisma.permission.upsert({
      where: { name: 'assign_cases_self' },
      update: {},
      create: {
        name: 'assign_cases_self',
        description: 'Can assign cases to themselves'
      }
    }),
    prisma.permission.upsert({
      where: { name: 'add_notes' },
      update: {},
      create: {
        name: 'add_notes',
        description: 'Can add notes'
      }
    }),
    prisma.permission.upsert({
      where: { name: 'respond_support' },
      update: {},
      create: {
        name: 'respond_support',
        description: 'Can respond to support requests'
      }
    }),
    prisma.permission.upsert({
      where: { name: 'access_configuration' },
      update: {},
      create: {
        name: 'access_configuration',
        description: 'Can access Configuration (settings page)'
      }
    }),
    prisma.permission.upsert({
      where: { name: 'update_status' },
      update: {},
      create: {
        name: 'update_status',
        description: 'Can update the status of requests and documents'
      }
    }),
    prisma.permission.upsert({
      where: { name: 'manage_invoices' },
      update: {},
      create: {
        name: 'manage_invoices',
        description: 'Can create, update, and delete invoices'
      }
    }),
    prisma.permission.upsert({
      where: { name: 'view_invoices' },
      update: {},
      create: {
        name: 'view_invoices',
        description: 'Can view invoices and invoice details'
      }
    })
  ])

  console.log('✅ Permissions created:', permissions.map(p => p.name))

  // Create groups based on frontend mock data
  const groups = await Promise.all([
    prisma.group.upsert({
      where: { name: 'Document Reviewer' },
      update: {},
      create: {
        name: 'Document Reviewer',
        description: 'Users who can review and process documents'
      }
    }),
    prisma.group.upsert({
      where: { name: 'Ticket Manager' },
      update: {},
      create: {
        name: 'Ticket Manager',
        description: 'Users who can manage support tickets and requests'
      }
    })
  ])

  console.log('✅ Groups created:', groups.map(g => g.name))

  // Assign permissions to groups
  const groupPermissions = [
    // Document Reviewer group permissions
    ...permissions
      .filter(p => ['review_documents', 'upload_documents', 'redact_documents'].includes(p.name))
      .map(permission => ({
        groupId: groups.find(g => g.name === 'Document Reviewer')!.id,
        permissionId: permission.id
      })),
    // Ticket Manager group permissions
    ...permissions
      .filter(p => ['respond_support', 'reassign_cases'].includes(p.name))
      .map(permission => ({
        groupId: groups.find(g => g.name === 'Ticket Manager')!.id,
        permissionId: permission.id
      }))
  ]

  await Promise.all(
    groupPermissions.map(gp =>
      prisma.groupPermission.upsert({
        where: {
          groupId_permissionId: {
            groupId: gp.groupId,
            permissionId: gp.permissionId
          }
        },
        update: {},
        create: gp
      })
    )
  )

  console.log('✅ Group permissions assigned')

  // Assign permissions to roles - only the 10 required permissions
  const rolePermissions = [
    // ADMINISTRATOR - all 10 permissions
    ...permissions
      .filter(p => [
        'review_documents', 'release_documents', 'upload_documents', 'redact_documents',
        'assign_cases', 'reassign_cases', 'assign_cases_self', 'add_notes', 
        'respond_support', 'access_configuration', 'update_status', 'manage_invoices', 'view_invoices'
      ].includes(p.name))
      .map(permission => ({
        roleId: roles.find(r => r.name === 'Administrator')!.id,
        permissionId: permission.id
      })),
    // SUPERVISOR/MANAGER - 7 permissions
    ...permissions
      .filter(p => [
        'review_documents', 'upload_documents', 'assign_cases', 
        'reassign_cases', 'add_notes', 'respond_support', 'access_configuration',
        'manage_invoices', 'view_invoices'
      ].includes(p.name))
      .map(permission => ({
        roleId: roles.find(r => r.name === 'Supervisor/Manager')!.id,
        permissionId: permission.id
      })),
    // USER - 2 permissions
    ...permissions
      .filter(p => ['review_documents', 'add_notes', 'view_invoices'].includes(p.name))
      .map(permission => ({
        roleId: roles.find(r => r.name === 'User')!.id,
        permissionId: permission.id
      })),
    // REQUESTOR - 1 permission
    ...permissions
      .filter(p => ['review_documents'].includes(p.name))
      .map(permission => ({
        roleId: roles.find(r => r.name === 'Requestor')!.id,
        permissionId: permission.id
      })),
    // SPECIALIST - 5 permissions
    ...permissions
      .filter(p => ['review_documents', 'upload_documents', 'assign_cases', 'add_notes', 'access_configuration', 'view_invoices'].includes(p.name))
      .map(permission => ({
        roleId: roles.find(r => r.name === 'Specialist')!.id,
        permissionId: permission.id
      }))
  ]

  await Promise.all(
    rolePermissions.map(rp =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: rp.roleId,
            permissionId: rp.permissionId
          }
        },
        update: {},
        create: rp
      })
    )
  )

  console.log('✅ Role permissions assigned')

  // Create users
  const adminPassword = await bcrypt.hash('admin123', 12)
  const specialistPassword = await bcrypt.hash('record123', 12)

  // Check if users already exist
  let admin = await prisma.user.findFirst({
    where: { 
      OR: [
        { idmeId: 'idme_admin_user' },
        { email: userData.admin.email }
      ]
    }
  })

  // Check for all specialist users
  const specialistUsers = await Promise.all([
    prisma.user.findFirst({
      where: { 
        OR: [
          { idmeId: 'idme_specialist_user' },
          { email: userData.specialist.email }
        ]
      }
    }),
    prisma.user.findFirst({
      where: { 
        OR: [
          { idmeId: 'idme_specialist2_user' },
          { email: userData.specialist2.email }
        ]
      }
    }),
    prisma.user.findFirst({
      where: { 
        OR: [
          { idmeId: 'idme_specialist3_user' },
          { email: userData.specialist3.email }
        ]
      }
    }),
    prisma.user.findFirst({
      where: { 
        OR: [
          { idmeId: 'idme_specialist4_user' },
          { email: userData.specialist4.email }
        ]
      }
    }),
    prisma.user.findFirst({
      where: { 
        OR: [
          { idmeId: 'idme_specialist5_user' },
          { email: userData.specialist5.email }
        ]
      }
    })
  ])

  // Create admin if doesn't exist
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        idmeId: 'idme_admin_user',
        username: userData.admin.username,
        email: userData.admin.email,
        passwordHash: adminPassword,
        firstName: userData.admin.firstName,
        lastName: userData.admin.lastName,
        name: `${userData.admin.firstName} ${userData.admin.lastName}`,
        role: userData.admin.role as 'ADMINISTRATOR',
        isInternal: true
      }
    })
    console.log('✅ Admin user created:', admin.name)
  } else {
    // Update existing admin to ensure isInternal is set
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: { isInternal: true }
    })
    console.log('✅ Admin user already exists:', admin.name)
  }

  // Create all specialist users
  const specialistData = [
    { key: 'specialist', idmeId: 'idme_specialist_user' },
    { key: 'specialist2', idmeId: 'idme_specialist2_user' },
    { key: 'specialist3', idmeId: 'idme_specialist3_user' },
    { key: 'specialist4', idmeId: 'idme_specialist4_user' },
    { key: 'specialist5', idmeId: 'idme_specialist5_user' }
  ]

  const specialists: any[] = []
  for (let i = 0; i < specialistData.length; i++) {
    const { key, idmeId } = specialistData[i]
    const existingUser = specialistUsers[i]
    
    if (!existingUser) {
      const userDataItem = (userData as any)[key]
      const user = await prisma.user.create({
        data: {
          idmeId: idmeId,
          username: userDataItem.username,
          email: userDataItem.email,
          passwordHash: specialistPassword,
          firstName: userDataItem.firstName,
          lastName: userDataItem.lastName,
          name: `${userDataItem.firstName} ${userDataItem.lastName}`,
          role: userDataItem.role as 'SPECIALIST',
          isInternal: true
        }
      })
      specialists.push(user)
      console.log(`✅ Specialist user created: ${user.name}`)
    } else {
      // Update existing specialist to ensure isInternal is set
      const user = await prisma.user.update({
        where: { id: existingUser.id },
        data: { isInternal: true }
      })
      specialists.push(user)
      console.log(`✅ Specialist user already exists: ${user.name}`)
    }
  }

  console.log('✅ Users created:', { 
    admin: admin.name, 
    specialists: specialists.map(s => s.name).join(', ')
  })

  // Assign roles to users
  const roleAssignments = [
    // Admin role
    prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: admin.id,
          roleId: roles.find(r => r.name === 'Administrator')!.id
        }
      },
      update: {},
      create: {
        userId: admin.id,
        roleId: roles.find(r => r.name === 'Administrator')!.id
      }
    }),
    // All specialist roles
    ...specialists.map(specialist =>
      prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: specialist.id,
            roleId: roles.find(r => r.name === 'Specialist')!.id
          }
        },
        update: {},
        create: {
          userId: specialist.id,
          roleId: roles.find(r => r.name === 'Specialist')!.id
        }
      })
    )
  ]

  await Promise.all(roleAssignments)

  console.log('✅ User roles assigned')

  // Create additional mock users from frontend screenshots
  const mockUsers = await Promise.all([
    // cjohnson@federal.gov - USER role
    prisma.user.upsert({
      where: { email: 'cjohnson@federal.gov' },
      update: {},
      create: {
        email: 'cjohnson@federal.gov',
        name: 'C Johnson',
        firstName: 'C',
        lastName: 'Johnson',
        username: 'cjohnson',
        role: 'USER',
        isInternal: true,
        passwordHash: await bcrypt.hash('<redacted>', 12)
      }
    }),
    // jsmith@federal.gov - ADMINISTRATOR role
    prisma.user.upsert({
      where: { email: 'jsmith@federal.gov' },
      update: {},
      create: {
        email: 'jsmith@federal.gov',
        name: 'J Smith',
        firstName: 'J',
        lastName: 'Smith',
        username: 'jsmith',
        role: 'ADMINISTRATOR',
        isInternal: true,
        passwordHash: await bcrypt.hash('<redacted>', 12)
      }
    }),
    // kclark@agency.gov - SUPERVISOR role
    prisma.user.upsert({
      where: { email: 'kclark@agency.gov' },
      update: {},
      create: {
        email: 'kclark@agency.gov',
        name: 'K Clark',
        firstName: 'K',
        lastName: 'Clark',
        username: 'kclark',
        role: 'SUPERVISOR',
        isInternal: true,
        passwordHash: await bcrypt.hash('<redacted>', 12)
      }
    }),
    // mgarcia@agency.gov - SPECIALIST role
    prisma.user.upsert({
      where: { email: 'mgarcia@agency.gov' },
      update: {},
      create: {
        email: 'mgarcia@agency.gov',
        name: 'M Garcia',
        firstName: 'M',
        lastName: 'Garcia',
        username: 'mgarcia',
        role: 'SPECIALIST',
        isInternal: true,
        passwordHash: await bcrypt.hash('<redacted>', 12)
      }
    }),
    // rpatel@federal.gov - REQUESTOR role
    prisma.user.upsert({
      where: { email: 'rpatel@federal.gov' },
      update: {},
      create: {
        email: 'rpatel@federal.gov',
        name: 'R Patel',
        firstName: 'R',
        lastName: 'Patel',
        username: 'rpatel',
        role: 'REQUESTOR',
        isInternal: false,
        passwordHash: await bcrypt.hash('<redacted>', 12)
      }
    })
  ])

  // Assign roles to mock users
  const mockUserRoles = await Promise.all([
    // cjohnson - USER role
    prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: mockUsers[0].id,
          roleId: roles.find(r => r.name === 'User')!.id
        }
      },
      update: {},
      create: {
        userId: mockUsers[0].id,
        roleId: roles.find(r => r.name === 'User')!.id
      }
    }),
    // jsmith - ADMINISTRATOR role
    prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: mockUsers[1].id,
          roleId: roles.find(r => r.name === 'Administrator')!.id
        }
      },
      update: {},
      create: {
        userId: mockUsers[1].id,
        roleId: roles.find(r => r.name === 'Administrator')!.id
      }
    }),
    // kclark - SUPERVISOR role
    prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: mockUsers[2].id,
          roleId: roles.find(r => r.name === 'Supervisor/Manager')!.id
        }
      },
      update: {},
      create: {
        userId: mockUsers[2].id,
        roleId: roles.find(r => r.name === 'Supervisor/Manager')!.id
      }
    }),
    // mgarcia - SPECIALIST role
    prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: mockUsers[3].id,
          roleId: roles.find(r => r.name === 'Specialist')!.id
        }
      },
      update: {},
      create: {
        userId: mockUsers[3].id,
        roleId: roles.find(r => r.name === 'Specialist')!.id
      }
    }),
    // rpatel - REQUESTOR role
    prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: mockUsers[4].id,
          roleId: roles.find(r => r.name === 'Requestor')!.id
        }
      },
      update: {},
      create: {
        userId: mockUsers[4].id,
        roleId: roles.find(r => r.name === 'Requestor')!.id
      }
    })
  ])

  // Assign groups to mock users
  const mockUserGroups = await Promise.all([
    // mgarcia - Document Reviewer and Ticket Manager groups
    prisma.userGroup.upsert({
      where: {
        userId_groupId: {
          userId: mockUsers[3].id,
          groupId: groups.find(g => g.name === 'Document Reviewer')!.id
        }
      },
      update: {},
      create: {
        userId: mockUsers[3].id,
        groupId: groups.find(g => g.name === 'Document Reviewer')!.id
      }
    }),
    prisma.userGroup.upsert({
      where: {
        userId_groupId: {
          userId: mockUsers[3].id,
          groupId: groups.find(g => g.name === 'Ticket Manager')!.id
        }
      },
      update: {},
      create: {
        userId: mockUsers[3].id,
        groupId: groups.find(g => g.name === 'Ticket Manager')!.id
      }
    }),
    // rpatel - Ticket Manager group
    prisma.userGroup.upsert({
      where: {
        userId_groupId: {
          userId: mockUsers[4].id,
          groupId: groups.find(g => g.name === 'Ticket Manager')!.id
        }
      },
      update: {},
      create: {
        userId: mockUsers[4].id,
        groupId: groups.find(g => g.name === 'Ticket Manager')!.id
      }
    })
  ])

  console.log('✅ Mock users created:', mockUsers.map(u => u.email))
  console.log('✅ Mock user roles assigned')
  console.log('✅ Mock user groups assigned')

  // Create sample FOIA requests from JSON data
  const requests = await Promise.all(
    requestData.requests.map(async (requestData, index) => {
      const assignedTo = index === 0 ? specialists[0].id : 
                        index === 1 ? admin.id : 
                        index === 2 ? specialists[1].id : 
                        index === 3 ? specialists[2].id : null

      return prisma.fOIARequest.upsert({
        where: { requestNumber: requestData.requestNumber },
        update: {},
        create: {
          // Requester Information
          requestNumber: requestData.requestNumber,
          requesterName: requestData.requesterName,
          requesterEmail: requestData.requesterEmail,
          requesterPhone: requestData.requesterPhone,
          requesterAddress: requestData.requesterAddress,
          requesterCity: requestData.requesterCity,
          requesterState: requestData.requesterState,
          requesterZipCode: requestData.requesterZipCode,
          requesterCountry: requestData.requesterCountry,
          requesterOrganization: requestData.requesterOrganization,
          requesterType: requestData.requesterType as any,
          
          // Request Details
          requestSubject: requestData.requestSubject,
          requestDescription: requestData.requestDescription,
          requestDate: new Date(requestData.requestDate),
          dueDate: new Date(requestData.dueDate),
          status: requestData.status as any,
          priority: requestData.priority as any,
          
          // Agency Information
          agencyComponentId: requestData.agencyComponentId,
          agencyComponentName: requestData.agencyComponentName,
          
          // Request Type and Processing
          requestType: requestData.requestType as any,
          feeCategory: requestData.feeCategory as any,
          feeWaiverRequested: requestData.feeWaiverRequested,
          feeWaiverReason: requestData.feeWaiverReason,
          expeditedProcessingRequested: requestData.expeditedProcessingRequested,
          expeditedProcessingReason: requestData.expeditedProcessingReason,
          
          // Request Scope
          dateRangeStart: requestData.dateRangeStart ? new Date(requestData.dateRangeStart) : null,
          dateRangeEnd: requestData.dateRangeEnd ? new Date(requestData.dateRangeEnd) : null,
          specificRecords: requestData.specificRecords,
          searchTerms: requestData.searchTerms,
          fileTypes: requestData.fileTypes,
          
          // Processing Timeline
          acknowledgmentSent: requestData.acknowledgmentSent ? new Date(requestData.acknowledgmentSent) : null,
          estimatedCompletionDate: requestData.estimatedCompletionDate ? new Date(requestData.estimatedCompletionDate) : null,
          actualCompletionDate: requestData.actualCompletionDate ? new Date(requestData.actualCompletionDate) : null,
          responseLetterSent: requestData.responseLetterSent ? new Date(requestData.responseLetterSent) : null,
          appealDeadline: requestData.appealDeadline ? new Date(requestData.appealDeadline) : null,
          
          // Fee Information
          estimatedFees: requestData.estimatedFees,
          actualFees: requestData.actualFees,
          feeWaiverGranted: requestData.feeWaiverGranted,
          paymentReceived: requestData.paymentReceived ? new Date(requestData.paymentReceived) : null,
          
          // Response Information
          responseType: requestData.responseType as any,
          exemptionsCited: requestData.exemptionsCited,
          recordsFound: requestData.recordsFound,
          recordsReleased: requestData.recordsReleased,
          recordsWithheld: requestData.recordsWithheld,
          
          // Additional Fields
          trackingNumber: requestData.trackingNumber,
          confirmationNumber: requestData.confirmationNumber,
          submissionMethod: requestData.submissionMethod as any,
          language: requestData.language,
          
          // Assignment and Notes
          assignedTo: assignedTo
        }
      })
    })
  )

  console.log('✅ FOIA requests created:', requests.length)

  // Create sample documents for the first request
  const documents = await Promise.all(
    documentData.documents.map(async (docData, index) => {
      return prisma.document.create({
        data: {
          foiaRequestId: requests[0].id,
          filename: docData.filename,
          originalFilename: docData.originalFilename,
          filePath: docData.filePath,
          fileSize: BigInt(docData.fileSize),
          mimeType: docData.mimeType,
          status: docData.status as any,
          reviewedBy: index === 1 ? specialists[0].id : null,
          reviewedAt: index === 1 ? new Date() : null
        }
      })
    })
  )

  console.log('✅ Documents created:', documents.length)

  // Create sample notes for the requests
  const notes = await Promise.all(
    noteData.notes.map(async (noteData) => {
      // Find the request by request number
      const request = requests.find(r => r.requestNumber === noteData.requestNumber)
      if (!request) {
        console.warn(`⚠️  Request not found for note: ${noteData.requestNumber}`)
        return null
      }

      return prisma.note.create({
        data: {
          foiaRequestId: request.id,
          content: noteData.content,
          noteType: noteData.noteType as any,
          createdBy: request.assignedTo || admin.id, // Use assigned user or admin as fallback
          isInternal: noteData.isInternal
        }
      })
    })
  )

  // Filter out null notes (from requests not found)
  const validNotes = notes.filter(note => note !== null)
  console.log('✅ Notes created:', validNotes.length)

  console.log('🎉 Database seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 