
# Informacion personal - perfil_empleado

| props                   | descripcion                                                                                                                                                                                                 | ejemplo |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| nombre                  |                                                                                                                                                                                                             |         |
| apellido                |                                                                                                                                                                                                             |         |
| documento               | debe tener tipos de cedula: extrangeria, ciudadania, pasaporte                                                                                                                                              |         |
| numero de documento     | corresponde a tipo de documento                                                                                                                                                                             |         |
| permiso de trabajo      | Si necesita permiso de trabajo, si o no. Muchos restaurantes necesitan permiso                                                                                                                              |         |
| genero                  |                                                                                                                                                                                                             |         |
| fecha de nacimiento     |                                                                                                                                                                                                             |         |
| tipo de vivienda        | casa, apartamento, lote. Por el tema de fraudo o seguridad                                                                                                                                                  |         |
| direccion               | direccion domicilio                                                                                                                                                                                         |         |
| estrato socio economico |                                                                                                                                                                                                             |         |
| estado civil            |                                                                                                                                                                                                             |         |
| nucleo familiar         | Multi campo:  padre, madre, hijo esposo<br>en caso de siniestro<br>- nombre, apellido, documento( registro civil, targeta de identidad, cc, cedula extrangeria), numero, fecha nacimiento, genero, telefono |         |
| telefono                |                                                                                                                                                                                                             |         |
| correo electronico      |                                                                                                                                                                                                             |         |
|                         |                                                                                                                                                                                                             |         |
# Familiar de contacto
| props      | descripcion | ejemplo |
| ---------- | ----------- | ------- |
| nombre     |             |         |
| apellido   |             |         |
| telefono   |             |         |
| parentesco |             |         |

# Cargo
| props                | descripcion                                                     | ejemplo |
| -------------------- | --------------------------------------------------------------- | ------- |
| fecha de ingreso     |                                                                 |         |
| fecha de terminacion |                                                                 |         |
| nombre del cargo     |                                                                 |         |
| Ubicacion            | CEDE o direccion fisica de la oficina donde el cargo se ejecuta |         |
|                      |                                                                 |         |
# Experiencia labora externa

| props                  | descripcion                                                                                                                                                         | ejemplo |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| empresa                |                                                                                                                                                                     |         |
| telefono de la empresa |                                                                                                                                                                     |         |
| cargo                  |                                                                                                                                                                     |         |
| sector                 | Es validad si viene del mismo sector: telecomunicaciones, mercado masivo, comercial/ventas, restaurante, servicio al cliente, (investigar donde se puede sacar eso) |         |
| periodo de tiempo      | inicio y final                                                                                                                                                      |         |
| funciones y logros     | lista de textos                                                                                                                                                     |         |
# Experiencia interna
| props | descripcion | ejemplo |
| ----- | ----------- | ------- |
|       |             |         |

# Education 

## Idiomas
| props                   | descripcion       | ejemplo |
| ----------------------- | ----------------- | ------- |
| institusion             |                   |         |
| nivel                   | escritura y habla |         |
| capacidad para traducir |                   |         |
|                         |                   |         |
# Registro de vehiculo

| props              | descripcion | ejemplo |
| ------------------ | ----------- | ------- |
| tipi de vehiculo   |             |         |
| placas             |             |         |
| typo de dicencia   |             |         |
| numeor de licencia |             |         |
# Centificado de alturas
| props             | descripcion | ejemplo |
| ----------------- | ----------- | ------- |
| fecha exp         |             |         |
| fecha vencimiento |             |         |

# certificado de riesgo electrico
| props             | descripcion | ejemplo |
| ----------------- | ----------- | ------- |
| fecha exp         |             |         |
| fecha vencimiento |             |         

# Movilidad geografica
disponibilidad de desplazar dentro del pais
# Datos Migracion
| props     | descripcion                            | ejemplo |
| --------- | -------------------------------------- | ------- |
| pasaporte | numero, fecha expedicion vencimiento   |         |
| visa      | nuemro fecah de expedicion vencimiento |         |

# Nomina
| props                        | descripcion                                                                                                                                                                                                                                   | ejemplo |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| tipo de contrato             | lista desplegable<br>- OPS : prestacion de servicios<br>- Obra o labor<br>- Contrato termino fijo<br> - opcion e alarma no, por el reisgo a que un contrato se renueve y es mejor salir de responsabilidad. <br>- Contrato termino indefinido |         |
| fecha de inicio              |                                                                                                                                                                                                                                               |         |
| fecha de terminacion         |                                                                                                                                                                                                                                               |         |
| Cargo                        |                                                                                                                                                                                                                                               |         |
| Salario                      | - valor                                                                                                                                                                                                                                       |         |
| deducciones salario          | - salud<br>- pension<br>- retencion en la fuenta<br>- Solidaridad                                                                                                                                                                             |         |
| beneficios                   | - cada empresa tiene su lista de beneficios<br>text: valor                                                                                                                                                                                    |         |
| otros beneficios (opciona)   |                                                                                                                                                                                                                                               |         |
| otras deducciones (opcional) |                                                                                                                                                                                                                                               |         |
Certificado Laboral
- con la anterior informacion se genera el centicado laborar de esa persona, se puede solicitar desde el modulo de Nomina.
Comprobantes de pago
- generar comprobante de pago con la informacion en este modulo. Solo se puede generar una vez se liquide la nomina, desde la fecha de inicio hasta el periodo inmediatamente anterior. porque no se puede generar a futuro o meses incompletos.
# Gestion del tiempo
Es para que el cliente calcule las vacaciones de su personal.
Acumular vacaciones no es adecuado para la empresa por tema control financiero. Genera una carga finaciera alta en el momento de una liquidacion 

E.G: Yo como dueña pueda con un click ver cuantas personas tiene vacaciones cumplidas y no disfrutadas.

| props                 | descripcion                                   | ejemplo |
| --------------------- | --------------------------------------------- | ------- |
| nombre                |                                               |         |
| cedula                |                                               |         |
| fecha de inicio       |                                               |         |
| fecha de finalizacion |                                               |         |
| Tiempo tomado         | tiempo por dia habil de vacaciones disfrutado |         |
# Ausentismo
| props         | descripcion                                                                                                                                                                                                                                                                                                        | ejemplo |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| nombre id etc |                                                                                                                                                                                                                                                                                                                    |         |
| causa         | lista:<br>- incapacidad<br>   - certificado medico<br>- prorroga de incapacidad<br>  - certificado medico <br>- permisos<br>- licencias No remuneradas<br>- licencia legales:<br>  - licencia de maternidad paternidad<br>     - certificado de nacido vivo<br>  - luto<br>    - certificado de defuncion <br><br> |         |

# Finanzas y centro de costos

Ejemplo con Emcasa:

Emcasa es una empresa que brinda servicios de cuidado a adultos mayores, trabaja bajo una subscripcion donde el adulto mayor (abuelito), supear unos test y entra a la comunidad Emcasa para ejercitar habilidades cognitivas, motrices y emocionales recomendadas para la 3r edad. funciona bajo una subscripcion mensual.

Los ingresos viene de la mensualidad de los abuelitos, de conferencias y eventos que se hacen en Emkasa.

Dependiendo del centro de costos, se puede 
## ingresos
centro de costos: Mensualidades en Emkasa

| id                           | nombre                      | descripcion                                                                    | unidad | valor unidad |
| ---------------------------- | --------------------------- | ------------------------------------------------------------------------------ | ------ | ------------ |
| 001 el codigo de mensualidad | Mensualidad tiempo completo | Esta mensualidad es la que viene todos los dias de lunes a viernes de 9 a 5 pm | 1      | 300          |
| 002                          | Mensualidad jornada AM      | Se asiste Lunes miercoles y viernes                                            | 2      | 150          |
Ejemplo de plantila completa

| **Nombre**             (Requerido) | **Precio Total**<br><br>(Requerido) | **Nombre impuesto**<br><br> (Opcional) | **Porcentaje impuesto** <br><br>(Opcional) | **Precio Base**<br><br>(Automático) | **Costo unitario**<br><br>(Requerido para inventariables) | **Cantidad inicial en bodega Principal** <br><br>(Requerido para inventariables) | **Unidad de Medida** <br><br>(Requerido para inventariables) | **Descripción**           (Opcional) | **Referencia**          (Opcional) | **Cuenta de ingresos**<br><br>(Opcional) | **Cuenta de inventario**<br><br>(Opcional) | **Cuenta de costo de venta**<br><br>(Opcional) | **Venta en negativo**<br><br>(Opcional) |
| ---------------------------------- | ----------------------------------- | -------------------------------------- | ------------------------------------------ | ----------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------ | ---------------------------------- | ---------------------------------------- | ------------------------------------------ | ---------------------------------------------- | --------------------------------------- |
|                                    |                                     |                                        |                                            |                                     |                                                           |                                                                                  |                                                              |                                      |                                    |                                          |                                            |                                                |                                         |
Feture: generar una pre-factura, una vez toda la informacion de clientes y centro de costos esta completa. E.g: Pao puede hacer click en el cliente "Maria Fany" y luego buscar la mensualidad que adquirio, y genera una pre-factura para la operacion.

## Egresos

Alegra es una referencia, y esta enfocado en contabilidad, pero no tiene la parte de personal.

Centro de costos papeleria

| id     | Item                   | notas                           | proveedor                                                 | valor                                                                        | # factura |
| ------ | ---------------------- | ------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- | --------- |
| 2000   | papeleria              | papeleria de todas las oficinas | - nombre: ex<br>- tipo documento: nit<br>- numero: 0000-9 | la factura es la que relaciona los detalles de que se compro especificamente |           |
| 2000-1 | papeleria de oficina 1 | papeleria de oficina 1          |                                                           |                                                                              |           |


# clientes

Este modulo habilita crear entity "cliente" con informacion basica de contacto. El nombre de la entidad "cliente" es customizable segun el tipo de negocio (ej: "Pacientes" en contextos medicos, "Estudiantes" en educacion, etc.).

## Modulo Basico: Cliente

| props              | descripcion                                                                                              | ejemplo                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| nombre             | Nombre completo del cliente                                                                              | Pedro García Martínez                   |
| tipo_documento     | Tipo de identificación: Cédula de Ciudadanía (CC), Cédula de Extranjería (CE), Pasaporte, Registro Civil | CC                                      |
| numero_documento   | Número del documento de identificación                                                                    | 1.234.567.890                           |
| fecha_nacimiento   | Fecha de nacimiento del cliente                                                                          | 15/03/1952                              |
| edad               | Edad calculada automáticamente desde fecha_nacimiento                                                    | 72 años (auto-calculado)                |
| genero             | Género del cliente                                                                                       | Masculino, Femenino, Otro               |
| telefono           | Número de teléfono de contacto                                                                           | +57 300 123 4567                        |
| email              | Correo electrónico                                                                                       | pedro.garcia@email.com                  |
| fecha_ingreso      | Fecha de ingreso/registro del cliente en el sistema                                                      | 15/01/2024                              |
| estado             | Estado actual del cliente en el sistema                                                                  | Activo, Inactivo                        |
| notas              | Campo de texto para notas generales sobre el cliente (opcional)                                          | Cliente requiere atención especial...   |

### Información Adicional (Opcional por tipo de negocio)

| props                    | descripcion                                                   | ejemplo                              |
| ------------------------ | ------------------------------------------------------------- | ------------------------------------ |
| informacion_seguro       | Datos del seguro médico o póliza (si aplica)                 | EPS: Sanitas, Número: 123456         |
| contacto_emergencia      | Información de contacto de emergencia                         | Ver tabla "Contacto de Emergencia"   |
| observaciones_especiales | Observaciones especiales o alertas sobre el cliente          | Alergias, restricciones, preferencias |

### Contacto de Emergencia

| props      | descripcion                                | ejemplo             |
| ---------- | ------------------------------------------ | ------------------- |
| cliente_id | Foreign key al cliente                     | (relación)          |
| nombre     | Nombre completo del contacto de emergencia | María García López  |
| telefono   | Teléfono del contacto de emergencia        | +57 301 987 6543    |
| parentesco | Relación con el cliente                    | Hija, Esposo, Padre |

---

## sub modulo: Fichas y Documentos

Este modulo permite hacer seguimiento a documentos/fichas/evaluaciones que deben ser actualizadas periódicamente sobre el cliente, por efectos legales o de control. Cuando este módulo está habilitado, los clientes pueden visualizarse como "Pacientes" (o el nombre customizado), y el sistema permite:

1. **Administrar plantillas** de fichas/documentos (instrumentos)
2. **Registrar completación** de fichas por cliente
3. **Hacer seguimiento** con alertas de vencimiento según periodicidad
4. **Gestionar notas** asociadas a cada cliente

### Ficha/Documento (Instrumento - Plantilla)

Tabla que define las plantillas de fichas/documentos que pueden ser completadas para cada cliente.

| props                  | descripcion                                                                                                           | ejemplo                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| nombre_instrumento     | Nombre descriptivo de la ficha/documento                                                                              | Ficha de Valoración General                  |
| codigo                 | Código interno para identificación del instrumento (opcional)                                                         | 1.2.1                                        |
| descripcion            | Descripción breve del propósito del instrumento                                                                       | Evaluación inicial completa del paciente     |
| tipo (enum)            | Categoría o tipo del instrumento                                                                                      | Valoración, Nutrición, Matrícula, Admisión   |
| periodicidad           | Frecuencia con la que se debe completar este instrumento                                                              | Única, Anual, Mensual, Trimestral, Semestral |
| roles_permitidos       | Roles de usuario que pueden completar este instrumento (multi-select)                                                 | Médico, Nutricionista, Psicólogo, Admin      |
| estado                 | Estado del instrumento en el sistema                                                                                  | Activo, Inactivo                             |
| plantilla_archivo      | Archivo de plantilla (Excel, PDF, Word, etc.) que se descarga para completar                                          | ficha_valoracion_v1.xlsx                     |
| fecha_creacion         | Fecha en que se creó el instrumento (metadata)                                                                        | 10/01/2024                                   |
| creado_por             | Usuario que creó el instrumento (metadata)                                                                            | user_id o nombre de usuario                  |
| fecha_modificacion     | Fecha de última modificación del instrumento (metadata)                                                               | 15/01/2024                                   |
| modificado_por         | Usuario que realizó la última modificación (metadata)                                                                 | user_id o nombre de usuario                  |
| version_plantilla      | Versión de la plantilla del instrumento (metadata)                                                                    | v1.0, v1.1, v2.0                             |

### Registro de Ficha Completada

Tabla que registra cada instancia de una ficha/documento completada para un cliente específico.

| props                  | descripcion                                                                                              | ejemplo                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| cliente_id             | Foreign key al cliente (paciente)                                                                        | (relación)                               |
| instrumento_id         | Foreign key al instrumento (plantilla) utilizado                                                         | (relación)                               |
| estado                 | Estado actual del registro                                                                               | Completado, Pendiente, Vencido           |
| fecha_completado       | Fecha en que se completó la ficha                                                                        | 07/01/2024                               |
| version_registro       | Versión del registro (permite múltiples iteraciones del mismo instrumento para un cliente)               | v1, v2, v3                               |
| responsable            | Usuario que completó la ficha                                                                            | L. González (user_id)                    |
| archivo_completado     | Archivo adjunto con la ficha completada (permite cualquier tipo de archivo: Excel, PDF, Word, imágenes) | ficha_valoracion_pedro_garcia_v1.xlsx    |
| notas_observaciones    | Notas u observaciones del responsable sobre la completación                                              | Paciente mostró buena colaboración...    |
| fecha_vencimiento      | Fecha de vencimiento calculada automáticamente según periodicidad del instrumento                        | 07/01/2025 (si periodicidad es anual)    |
| alerta_vencimiento     | Días antes del vencimiento para enviar alerta/recordatorio                                               | 30 días antes, 15 días antes, 7 días antes |
| fecha_creacion_registro | Fecha en que se creó el registro (metadata)                                                              | 07/01/2024                               |

### Notas

Tabla que almacena notas asociadas a cada cliente. Las notas pueden ser de seguimiento general o relacionadas a fichas específicas.

| props                  | descripcion                                                                                      | ejemplo                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| cliente_id             | Foreign key al cliente                                                                           | (relación)                                        |
| tipo_nota              | Clasificación de la nota                                                                         | Positiva, Negativa, Neutral, Alerta               |
| fecha                  | Fecha y hora en que se creó la nota                                                              | 20/01/2024 10:30 AM                               |
| autor                  | Usuario que escribió la nota                                                                     | L. González (user_id)                             |
| contenido              | Texto completo de la nota                                                                        | Paciente mostró gran avance en terapia física... |
| relacionado_a          | Referencia opcional a una ficha completada específica (si la nota está relacionada a una ficha)  | registro_ficha_id (opcional, puede ser NULL)      |
| prioridad              | Nivel de prioridad o importancia de la nota                                                      | Alta, Media, Baja                                 |
| visible_para           | Roles que pueden ver esta nota (control de privacidad)                                           | Todos, Solo Médicos, Solo Admin                   |

### Estadísticas de Cliente (Vista calculada)

Estas métricas se calculan automáticamente desde las tablas anteriores y se muestran en la vista de perfil del cliente:

| metrica                   | descripcion                                                      | ejemplo            |
| ------------------------- | ---------------------------------------------------------------- | ------------------ |
| total_fichas_completadas  | Número total de fichas completadas por el cliente                | 8                  |
| fichas_pendientes         | Número de fichas pendientes de completar                         | 3                  |
| fichas_vencidas           | Número de fichas que han vencido y requieren actualización       | 1                  |
| dias_ultima_nota          | Días transcurridos desde la última nota registrada               | 3 días             |
| notas_positivas           | Conteo de notas clasificadas como positivas                      | 18                 |
| notas_negativas           | Conteo de notas clasificadas como negativas                      | 6                  |
| alertas_activas           | Número de alertas activas (fichas próximas a vencer)             | 2                  |

### Relaciones entre Entidades

```
Cliente (1) ─── (N) Registro de Ficha Completada
Cliente (1) ─── (N) Notas
Cliente (1) ─── (1) Contacto de Emergencia

Instrumento (1) ─── (N) Registro de Ficha Completada

Registro de Ficha Completada (1) ─── (0..N) Notas [relación opcional]
```

### Flujo de Trabajo

1. **Admin crea Instrumento** (plantilla) con periodicidad y roles permitidos
2. **Usuario descarga plantilla** desde el sistema
3. **Usuario completa ficha** en formato Excel/PDF/Word fuera del sistema
4. **Usuario sube archivo completado** y registra metadata (fecha, observaciones)
5. **Sistema calcula fecha de vencimiento** según periodicidad
6. **Sistema envía alertas** cuando se aproxima el vencimiento
7. **Usuario agrega notas** de seguimiento en cualquier momento
8. **Vista de perfil muestra estadísticas** calculadas automáticamente

