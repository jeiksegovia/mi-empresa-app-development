---

## title: Requerimientos Técnicos - Mi Empresa App created: 2025-07-08 author: Equipo Arquitectura de Software

## 📄 Breve descripción del sistema

"Mi Empresa App" es una solución empresarial enfocada en la gestión de personal, nómina, ausentismo, vacaciones y presupuesto financiero con centros de costo. Diseñada para cumplir obligaciones legales-labores, la aplicación busca facilitar la administración de empresas con personal vinculado con contratos de diferentes modalidades, de forma, eficiente y organizada.. Diseñada para adaptarse al contexto legal colombiano, la aplicación busca facilitar la administración de empresas con personal contratado de forma legal, eficiente y organizada.

## 📊 Funcionalidades Principales

1. Gestión de Empleados

Registro detallado de datos personales y laborales

Registro de familiar de contacto y núcleo familiar

Historial de experiencia laboral interna y externa

Registro de educación e idiomas

Registro de vehículos, certificados de altura y riesgo eléctrico

Movilidad geográfica y datos migratorios

6. Modulo Paciente y notas

7. modulo de certificacion y formatos
- carga de formatos estandarizados
- recordatorio de renovacion

2. Módulo de Contratación y Nómina

Gestión de tipos de contrato laboral (OPS, Obra/Labor, Término Fijo/Indefinido)

Liquidación de salario y generación de comprobantes

Deducciones, beneficios y otras obligaciones

Generación de certificados laborales

Liquidación al finalizar el vínculo laboral según ley

3. Gestión del Tiempo

Registro y cálculo de vacaciones acumuladas y disfrutadas

Reporte de personas con vacaciones vencidas

4. Ausentismo y Licencias

Registro de causas de ausentismo

Adjuntar certificados (incapacidad, prórrogas, licencias legales)

5. Finanzas y Presupuesto

Definición de ingresos por centro de costos (ej: mensualidades, eventos)

Registro de egresos por ítem, proveedor y factura

Generación de pre-facturas y trazabilidad contable



---

--- client feedback ----

manejo de redes basico
--- end ---

## ✅ Technical Requirements

### Backend

- **Runtime & Language**: Node.js with TypeScript for type safety and developer productivity
- **Framework**: Express.js – lightweight, battle-tested, minimal overhead for business logic focus
- **Database**: PostgreSQL – proven reliability, excellent JSON support, cost-effective at scale
- **ORM**: Prisma – strongly typed, auto-generated migrations, simplified data access layer
- **Authentication & Authorization**: JWT-based stateless authentication with role-based access control (RBAC) – Admin, Employee, Auditor, Operator
- **Third-party Integrations**: Phase 2 (deferred for MVP focus)

### Frontend

- **Framework**: Nuxt 4 + TypeScript – universal rendering with simplified SSR, type-safe development
- **UI Framework**: Tailwind CSS – utility-first approach reduces custom CSS debt and design inconsistencies
- **State Management**: Pinia – lightweight store library, built-in Vue 3 composition API support
- **Internationalization**: i18n via nuxt-i18n (future phase, deferred for MVP)

### DevOps & Infrastructure

- **Cloud Provider**: AWS – EC2 for application servers, RDS for managed PostgreSQL, S3 for static assets/document storage
- **CI/CD Pipeline**: GitHub Actions + Docker containerization for reproducible, scalable deployments
- **Logging & Monitoring**: Open-source solution (ELK Stack or similar) on dedicated cost-optimized VM instead of AWS CloudWatch to reduce licensing costs
- **Security**: HTTPS/TLS, OWASP Top 10 compliance, Content Security Policy (CSP) headers, XSS/CSRF token protection

---

## 📚 Requerimientos No Técnicos

- Soporte a navegadores modernos (Chrome, Safari, Edge)
- Usabilidad: Diseño accesible y responsive (mobile-first)
- Multitenencia: posibilidad de administrar múltiples empresas en una sola instancia (future phase)

---

## 📌 Diagrama de Entidades (Resumen Simplificado)

```mermaid
erDiagram
  EMPLEADO {
    string nombre
    string apellido
    string documento_tipo
    string documento_numero
    string genero
    date fecha_nacimiento
    string tipo_vivienda
    string direccion
    int estrato
    string estado_civil
    string telefono
    string correo_electronico
  }
  NUCLEO_FAMILIAR {
    int id
  }
  MIEMBRO_FAMILIA {
    string nombre
    string apellido
    string documento
    date fecha_nacimiento
    string genero
    string telefono
    string parentesco
  }
  EMPLEADO ||--o{ NUCLEO_FAMILIAR : tiene

  NUCLEO_FAMILIAR ||--|{MIEMBRO_FAMILIA  : contiene

  FAMILIAR_CONTACTO {
    string nombre
    string apellido
    string telefono
    string parentesco
  }
  EMPLEADO ||--|{ FAMILIAR_CONTACTO : notifica

  EXPERIENCIA_EXTERNA {
    string empresa
    string telefono
    string cargo
    string sector
    date inicio
    date fin
    string funciones_logros
  }
  EMPLEADO ||--o{ EXPERIENCIA_EXTERNA : tiene

  EDUCACION_IDIOMA {
    string idioma
    string institucion
    string nivel_escritura
    string nivel_habla
    string puede_traducir
  }
  EMPLEADO ||--o{ EDUCACION_IDIOMA : posee

  EDUCACION {
    string institucion
    string nivel_academico
    string contenido
  }
  EMPLEADO ||--o| EDUCACION : posee

  CONTRATO {
    string tipo
    date inicio
    date fin
    string cargo
    float salario
  }
  EMPLEADO ||--o{ CONTRATO : firmado_por

  NOMINA {
    float salario_base
    float deduccion_salud
    float deduccion_pension
    float retencion_fuente
    float solidaridad
    string otros_beneficios
    string otras_deducciones
  }
  CONTRATO ||--|{ NOMINA : genera

  LIQUIDACION {
    int id
    date fecha_liquidacion
    float salario_base
    float auxilio_transporte
    float dias_trabajados
    float cesantias
    float intereses_cesantias
    float prima_servicios
    float vacaciones
    float indemnizacion
    float total_deducciones
    float total_pagado
    string observaciones
  }
  CONTRATO ||--o| LIQUIDACION : "genera al desvincularse"

  COMPROBANTE {
    date fecha_emision
    string descripcion
    float valor
  }
  NOMINA ||--o| COMPROBANTE : emite

  VACACIONES {
    date inicio
    date fin
    int dias_disfrutados
  }
  EMPLEADO ||--o{ VACACIONES : disfruta

  AUSENTISMO {
    string causa
    string certificado
    date inicio
    date fin
  }
  EMPLEADO ||--o{ AUSENTISMO : registra

  BENEFICIO {
    string nombre
    float valor
  }
  EMPLEADO ||--o{ BENEFICIO : recibe

  EMPRESA {
    string nombre
    string nit
  }
  EMPRESA ||--|{ EMPLEADO : emplea
  EMPRESA ||--|{ CENTRO_COSTO : emplea

  CENTRO_COSTO {
    string nombre
    string descripcion
  }
  INGRESO {
    string nombre
    string unidad
    float valor_unitario
  }

  PRODUCTO_O_SERVICIO{
    %% pendiente %%
  }

  INGRESO ||--o{ PRODUCTO_O_SERVICIO : contiene

  EGRESO {
    string item
    string proveedor
    string numero_factura
    float valor
  }
  CENTRO_COSTO ||--o{ INGRESO : "genera por periodo"
  CENTRO_COSTO ||--o{ EGRESO : usa
```

---

## 🌐 Consideraciones Legales Colombianas

### Contratación y Nómina

- **Tipos de contrato válidos**: OPS, Término fijo, indefinido, obra o labor. Cada uno tiene distintas implicaciones para liquidación y aportes.
- **Aportes obligatorios**: Salud (12.5%), Pensión (16%), ARL, Caja de compensación.
- **Retención en la fuente**: Debe calcularse automáticamente según tablas de la DIAN.
- **Liquidaciones**: Cálculo conforme al Código Sustantivo del Trabajo (Cesantías, intereses, prima y vacaciones).

### Protección de Datos

- La información personal y laboral del empleado está protegida bajo la Ley 1581/2012 de protección de datos.
- Se debe solicitar autorización para el tratamiento de datos personales.

---

## 🛠️ Siguientes pasos

- Validación de historias de usuario con el PO
- Definir MVP para la primera versión: Módulo de Empleados + Nómina + Finanzas
- Crear prototipo funcional (Figma)
- Estimación de esfuerzo y roadmap

---

## ✉️ Notas Adicionales

- Se debe permitir exportar información en PDF y Excel
- Requiere generador de certificados laborales y reportes de ausentismo
- El sistema debe tener auditoría de cambios (bitácora)

---

