/**
 * Mi Empresa App - Database Seed Script
 * Populates database with sample data for development
 */

import { PrismaClient } from '../src/generated/prisma/index.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('🧹 Cleaning existing data...');
    await prisma.sesion.deleteMany();
    await prisma.notaCliente.deleteMany();
    await prisma.registroFichaCompletada.deleteMany();
    await prisma.instrumento.deleteMany();
    await prisma.contactoEmergenciaCliente.deleteMany();
    await prisma.prefactura.deleteMany();
    await prisma.cliente.deleteMany();
    await prisma.egreso.deleteMany();
    await prisma.productoServicio.deleteMany();
    await prisma.centroCostos.deleteMany();
    await prisma.ausentismo.deleteMany();
    await prisma.gestionTiempoVacaciones.deleteMany();
    await prisma.comprobantePago.deleteMany();
    await prisma.beneficio.deleteMany();
    await prisma.deduccionSalario.deleteMany();
    await prisma.nomina.deleteMany();
    await prisma.datosMigracion.deleteMany();
    await prisma.certificadoRiesgoElectrico.deleteMany();
    await prisma.certificadoAlturas.deleteMany();
    await prisma.vehiculo.deleteMany();
    await prisma.educacionIdiomas.deleteMany();
    await prisma.experienciaLaboralExterna.deleteMany();
    await prisma.cargo.deleteMany();
    await prisma.contactoEmergenciaEmpleado.deleteMany();
    await prisma.nucleoFamiliar.deleteMany();
    await prisma.empleado.deleteMany();
    await prisma.usuario.deleteMany();
  }

  // 1. Create Users
  console.log('👤 Creating users...');
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.usuario.create({
    data: {
      email: 'admin@miempresa.com',
      password: passwordHash,
      rol: 'ADMIN',
      nombre: 'Admin',
      apellido: 'Sistema',
      activo: true,
    },
  });

  const empleado1User = await prisma.usuario.create({
    data: {
      email: 'empleado@miempresa.com',
      password: passwordHash,
      rol: 'EMPLEADO',
      nombre: 'Carlos',
      apellido: 'Rodríguez',
      activo: true,
    },
  });

  const auditor = await prisma.usuario.create({
    data: {
      email: 'auditor@miempresa.com',
      password: passwordHash,
      rol: 'AUDITOR',
      nombre: 'María',
      apellido: 'González',
      activo: true,
    },
  });

  const operador = await prisma.usuario.create({
    data: {
      email: 'operador@miempresa.com',
      password: passwordHash,
      rol: 'OPERADOR',
      nombre: 'Ana',
      apellido: 'Martínez',
      activo: true,
    },
  });

  console.log(`✅ Created ${4} users`);

  // 2. Create Employees
  console.log('👷 Creating employees...');

  const empleado1 = await prisma.empleado.create({
    data: {
      nombre: 'Carlos',
      apellido: 'Rodríguez',
      tipoDocumento: 'CC',
      numeroDocumento: '1234567890',
      permisoTrabajo: true,
      genero: 'Masculino',
      fechaNacimiento: new Date('1990-05-15'),
      tipoVivienda: 'APARTAMENTO',
      direccion: 'Calle 123 #45-67',
      estratoSocioeconomico: 3,
      estadoCivil: 'Casado',
      telefono: '3001234567',
      email: 'carlos.rodriguez@example.com',
      estado: 'ACTIVO',
      nucleoFamiliar: {
        create: [
          {
            nombre: 'Laura',
            apellido: 'Rodríguez',
            tipoDocumento: 'CC',
            numeroDocumento: '9876543210',
            fechaNacimiento: new Date('1992-08-20'),
            genero: 'Femenino',
            telefono: '3009876543',
            parentesco: 'esposo',
          },
          {
            nombre: 'Sofía',
            apellido: 'Rodríguez',
            tipoDocumento: 'TI',
            numeroDocumento: '1122334455',
            fechaNacimiento: new Date('2015-03-10'),
            genero: 'Femenino',
            parentesco: 'hijo',
          },
        ],
      },
      contactosEmergencia: {
        create: {
          nombre: 'Laura',
          apellido: 'Rodríguez',
          telefono: '3009876543',
          parentesco: 'esposo',
        },
      },
      cargos: {
        create: {
          fechaIngreso: new Date('2020-01-15'),
          nombreCargo: 'Ingeniero de Software Senior',
          ubicacion: 'SEDE Principal',
        },
      },
    },
  });

  const empleado2 = await prisma.empleado.create({
    data: {
      nombre: 'María',
      apellido: 'González',
      tipoDocumento: 'CC',
      numeroDocumento: '9988776655',
      permisoTrabajo: true,
      genero: 'Femenino',
      fechaNacimiento: new Date('1985-11-22'),
      tipoVivienda: 'CASA',
      direccion: 'Carrera 45 #12-34',
      estratoSocioeconomico: 4,
      estadoCivil: 'Soltera',
      telefono: '3112233445',
      email: 'maria.gonzalez@example.com',
      estado: 'ACTIVO',
      contactosEmergencia: {
        create: {
          nombre: 'Pedro',
          apellido: 'González',
          telefono: '3198765432',
          parentesco: 'padre',
        },
      },
      cargos: {
        create: {
          fechaIngreso: new Date('2019-06-01'),
          nombreCargo: 'Gerente de Proyectos',
          ubicacion: 'SEDE Principal',
        },
      },
      vehiculos: {
        create: {
          tipoVehiculo: 'Automóvil',
          placas: 'ABC123',
          tipoLicencia: 'B1',
          numeroLicencia: '12345678',
        },
      },
    },
  });

  const empleado3 = await prisma.empleado.create({
    data: {
      nombre: 'Juan',
      apellido: 'Pérez',
      tipoDocumento: 'CC',
      numeroDocumento: '1122334455',
      permisoTrabajo: true,
      genero: 'Masculino',
      fechaNacimiento: new Date('1988-03-10'),
      tipoVivienda: 'APARTAMENTO',
      direccion: 'Avenida 80 #30-20',
      estratoSocioeconomico: 3,
      estadoCivil: 'Soltero',
      telefono: '3201112233',
      email: 'juan.perez@example.com',
      estado: 'ACTIVO',
      contactosEmergencia: {
        create: {
          nombre: 'Rosa',
          apellido: 'Pérez',
          telefono: '3156789012',
          parentesco: 'madre',
        },
      },
      cargos: {
        create: {
          fechaIngreso: new Date('2021-03-15'),
          nombreCargo: 'Técnico en Seguridad',
          ubicacion: 'SEDE Norte',
        },
      },
      certificadoAlturas: {
        create: {
          fechaExpedicion: new Date('2023-01-15'),
          fechaVencimiento: new Date('2026-01-15'),
        },
      },
      certificadoRiesgoElectrico: {
        create: {
          fechaExpedicion: new Date('2023-02-01'),
          fechaVencimiento: new Date('2025-02-01'),
        },
      },
    },
  });

  console.log(`✅ Created ${3} employees`);

  // 3. Create Payroll Records
  console.log('💰 Creating payroll records...');

  const nomina1 = await prisma.nomina.create({
    data: {
      empleadoId: empleado1.id,
      tipoContrato: 'TERMINO_INDEFINIDO',
      fechaInicio: new Date('2020-01-15'),
      cargo: 'Ingeniero de Software Senior',
      salario: 6000000,
      fechaPago: new Date('2024-01-31'),
      periodo: 'MENSUAL',
      deducciones: {
        create: [
          { tipo: 'SALUD', valor: 240000, descripcion: 'Aporte salud 4%' },
          { tipo: 'PENSION', valor: 240000, descripcion: 'Aporte pensión 4%' },
          { tipo: 'RETENCION_FUENTE', valor: 180000, descripcion: 'Retención en la fuente' },
        ],
      },
      beneficios: {
        create: [
          { nombreBeneficio: 'Auxilio de transporte', valor: 150000 },
          { nombreBeneficio: 'Prima técnica', valor: 500000 },
        ],
      },
    },
  });

  await prisma.comprobantePago.create({
    data: {
      nominaId: nomina1.id,
      periodoInicio: new Date('2024-01-01'),
      periodoFin: new Date('2024-01-31'),
      totalDevengado: 6650000,
      totalDeducciones: 660000,
      netoPagar: 5990000,
    },
  });

  console.log(`✅ Created payroll records`);

  // 4. Create Clients
  console.log('🏥 Creating clients...');

  const cliente1 = await prisma.cliente.create({
    data: {
      nombre: 'Pedro Martínez López',
      tipoDocumento: 'CC',
      numeroDocumento: '5566778899',
      fechaNacimiento: new Date('1975-06-15'),
      genero: 'Masculino',
      telefono: '3145678901',
      email: 'pedro.martinez@example.com',
      estado: 'ACTIVO',
      notas: 'Cliente preferencial',
      contactosEmergencia: {
        create: {
          nombre: 'Sandra López',
          telefono: '3167890123',
          parentesco: 'esposo',
        },
      },
    },
  });

  const cliente2 = await prisma.cliente.create({
    data: {
      nombre: 'Ana Gómez Ruiz',
      tipoDocumento: 'CC',
      numeroDocumento: '6677889900',
      fechaNacimiento: new Date('1980-12-05'),
      genero: 'Femenino',
      telefono: '3189012345',
      email: 'ana.gomez@example.com',
      estado: 'ACTIVO',
      contactosEmergencia: {
        create: {
          nombre: 'Luis Gómez',
          telefono: '3123456789',
          parentesco: 'padre',
        },
      },
    },
  });

  const cliente3 = await prisma.cliente.create({
    data: {
      nombre: 'Roberto Silva Castro',
      tipoDocumento: 'CC',
      numeroDocumento: '7788990011',
      fechaNacimiento: new Date('1995-09-20'),
      genero: 'Masculino',
      telefono: '3209876543',
      estado: 'ACTIVO',
      informacionSeguro: 'Seguro Salud Plus - Póliza #123456',
      observacionesEspeciales: 'Alérgico a penicilina',
    },
  });

  console.log(`✅ Created ${3} clients`);

  // 5. Create Instruments (Forms/Templates)
  console.log('📋 Creating instruments...');

  const instrumento1 = await prisma.instrumento.create({
    data: {
      nombreInstrumento: 'Ficha de Valoración Médica Inicial',
      codigo: 'FVM-001',
      descripcion: 'Evaluación médica inicial del paciente',
      tipo: 'VALORACION',
      periodicidad: 'ANUAL',
      rolesPermitidos: 'ADMIN,EMPLEADO',
      estado: 'ACTIVO',
      creadoPor: admin.id,
      versionPlantilla: 'v1.0',
    },
  });

  const instrumento2 = await prisma.instrumento.create({
    data: {
      nombreInstrumento: 'Plan Nutricional',
      codigo: 'NUT-001',
      descripcion: 'Evaluación y plan nutricional personalizado',
      tipo: 'NUTRICION',
      periodicidad: 'TRIMESTRAL',
      rolesPermitidos: 'ADMIN,EMPLEADO,OPERADOR',
      estado: 'ACTIVO',
      creadoPor: admin.id,
      versionPlantilla: 'v1.0',
    },
  });

  const instrumento3 = await prisma.instrumento.create({
    data: {
      nombreInstrumento: 'Formulario de Admisión',
      codigo: 'ADM-001',
      descripcion: 'Proceso de admisión de nuevo paciente',
      tipo: 'ADMISION',
      periodicidad: 'UNICA',
      rolesPermitidos: 'ADMIN,OPERADOR',
      estado: 'ACTIVO',
      creadoPor: admin.id,
      versionPlantilla: 'v1.0',
    },
  });

  console.log(`✅ Created ${3} instruments`);

  // 6. Create Form Completion Records
  console.log('📝 Creating form completion records...');

  const registro1 = await prisma.registroFichaCompletada.create({
    data: {
      clienteId: cliente1.id,
      instrumentoId: instrumento1.id,
      estado: 'COMPLETADO',
      fechaCompletado: new Date('2024-01-15'),
      versionRegistro: 'v1',
      responsable: empleado1User.id,
      fechaVencimiento: new Date('2025-01-15'),
      alertaVencimiento: '30 días',
    },
  });

  const registro2 = await prisma.registroFichaCompletada.create({
    data: {
      clienteId: cliente2.id,
      instrumentoId: instrumento2.id,
      estado: 'PENDIENTE',
      versionRegistro: 'v1',
      responsable: operador.id,
      fechaVencimiento: new Date('2024-06-30'),
      alertaVencimiento: '15 días',
    },
  });

  const registro3 = await prisma.registroFichaCompletada.create({
    data: {
      clienteId: cliente3.id,
      instrumentoId: instrumento3.id,
      estado: 'COMPLETADO',
      fechaCompletado: new Date('2024-02-01'),
      versionRegistro: 'v1',
      responsable: operador.id,
      notasObservaciones: 'Proceso de admisión completado sin observaciones',
    },
  });

  console.log(`✅ Created ${3} form records`);

  // 7. Create Client Notes
  console.log('📌 Creating client notes...');

  await prisma.notaCliente.create({
    data: {
      clienteId: cliente1.id,
      registroFichaId: registro1.id,
      tipoNota: 'POSITIVA',
      autor: empleado1User.id,
      contenido: 'Paciente muestra excelente progreso en tratamiento. Cumple con todas las indicaciones.',
      prioridad: 'MEDIA',
      visiblePara: 'TODOS',
    },
  });

  await prisma.notaCliente.create({
    data: {
      clienteId: cliente2.id,
      tipoNota: 'ALERTA',
      autor: operador.id,
      contenido: 'Recordar seguimiento nutricional pendiente. Paciente ha solicitado cambio de horario.',
      prioridad: 'ALTA',
      visiblePara: 'SOLO_MEDICOS',
    },
  });

  await prisma.notaCliente.create({
    data: {
      clienteId: cliente3.id,
      tipoNota: 'NEUTRAL',
      autor: admin.id,
      contenido: 'Documentación de admisión completa y archivada correctamente.',
      prioridad: 'BAJA',
      visiblePara: 'TODOS',
    },
  });

  console.log(`✅ Created ${3} client notes`);

  // 8. Create Cost Centers and Products
  console.log('💼 Creating finance records...');

  const centroIngresos = await prisma.centroCostos.create({
    data: {
      nombre: 'Servicios Médicos',
      tipo: 'INGRESOS',
      descripcion: 'Centro de ingresos por servicios de salud',
    },
  });

  const centroEgresos = await prisma.centroCostos.create({
    data: {
      nombre: 'Operaciones Generales',
      tipo: 'EGRESOS',
      descripcion: 'Gastos operacionales generales',
    },
  });

  const producto1 = await prisma.productoServicio.create({
    data: {
      centroCostosId: centroIngresos.id,
      codigoInterno: 'SRV-001',
      nombre: 'Consulta Médica General',
      precioTotal: 60000,
      nombreImpuesto: 'IVA',
      porcentajeImpuesto: 0,
      precioBase: 60000,
      costoUnitario: 25000,
      cantidadInicial: 100,
      unidadMedida: 'unidad',
      descripcion: 'Consulta médica general con especialista',
    },
  });

  const producto2 = await prisma.productoServicio.create({
    data: {
      centroCostosId: centroIngresos.id,
      codigoInterno: 'SRV-002',
      nombre: 'Plan Nutricional Personalizado',
      precioTotal: 150000,
      nombreImpuesto: 'IVA',
      porcentajeImpuesto: 19,
      precioBase: 126050.42,
      costoUnitario: 50000,
      cantidadInicial: 50,
      unidadMedida: 'unidad',
      descripcion: 'Plan nutricional completo con seguimiento',
    },
  });

  await prisma.egreso.create({
    data: {
      centroCostosId: centroEgresos.id,
      codigoInterno: 'EGR-001',
      item: 'Material médico descartable',
      notas: 'Compra mensual de insumos médicos',
      proveedorNombre: 'Distribuidora Médica S.A.',
      proveedorTipoDoc: 'NIT',
      proveedorNumero: '900123456-1',
      valor: 850000,
      numeroFactura: 'FM-2024-001',
      fecha: new Date('2024-01-10'),
    },
  });

  // 9. Create Pre-invoice
  await prisma.prefactura.create({
    data: {
      clienteId: cliente1.id,
      productoServicioId: producto1.id,
      subtotal: 60000,
      impuestos: 0,
      total: 60000,
      estado: 'PAGADO',
    },
  });

  await prisma.prefactura.create({
    data: {
      clienteId: cliente2.id,
      productoServicioId: producto2.id,
      subtotal: 126050.42,
      impuestos: 23949.58,
      total: 150000,
      estado: 'ENVIADO',
    },
  });

  console.log(`✅ Created finance records`);

  // 10. Create Vacation and Absence Records
  console.log('🏖️ Creating time management records...');

  await prisma.gestionTiempoVacaciones.create({
    data: {
      empleadoId: empleado1.id,
      fechaInicio: new Date('2024-07-01'),
      fechaFinalizacion: new Date('2024-07-15'),
      diasTomados: 10,
      estado: 'APROBADO',
      fechaSolicitud: new Date('2024-05-15'),
    },
  });

  await prisma.ausentismo.create({
    data: {
      empleadoId: empleado2.id,
      causa: 'LICENCIA_LEGAL',
      tipoLicencia: 'LUTO',
      fechaInicio: new Date('2024-03-10'),
      fechaFin: new Date('2024-03-14'),
      observaciones: 'Licencia por luto familiar',
    },
  });

  console.log(`✅ Created time management records`);

  console.log('✨ Database seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   Users: 4 (admin, empleado, auditor, operador)`);
  console.log(`   Employees: 3`);
  console.log(`   Clients: 3`);
  console.log(`   Instruments: 3`);
  console.log(`   Form Records: 3`);
  console.log(`   Notes: 3`);
  console.log(`   Finance: 2 cost centers, 2 products, 1 expense, 2 pre-invoices`);
  console.log('\n🔑 Login credentials:');
  console.log(`   Admin: admin@miempresa.com / password123`);
  console.log(`   Empleado: empleado@miempresa.com / password123`);
  console.log(`   Auditor: auditor@miempresa.com / password123`);
  console.log(`   Operador: operador@miempresa.com / password123`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
