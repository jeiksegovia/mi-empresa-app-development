
# Validar que ya esta implementado 

## Gestion clientes: pacientes
### Cambio genero
cambiar por drop down: masculino, femenimo y otro (espacio para poner la opcion)

### cambio parentesco
dropdown: padre, madre, hijo, otro-> cual(agregar con input-text)


# Milestone -  july 09

## 1 flujo de certificados 
certificados completa: agregar, borrar, alertas archivos
### e.g certificados de afiliacion a caja de compensacion y Sena ( certificados de aportes Empresa )
tiene que afiliarte a fondos de penciones registrarte un documento para subir a la plataforma. Agregar estos certificados en la opcion "otros" y el comprobande de pago ante entidad finaciera del periodo. Estos certificados en este ejemplo son mensuales.
Este certificado es a nivel de empresa, No es por empleado.
#### importante de aportes sociales ( Empresa )
Este certificado de paga mes a mes, y contiene todos los empleados con contrato termino indefinido. Y es necesario pagarla mensualmente.

## 2 empleado

### Certificados custom: en opcion "otros"
El administrador crea los certificados necesarios dependiento del cargo y las necesidades, para ser agregados al tab de certificados por empleado.

e.g: la genrontologa necesita unos cursos, los profesores necesitan otros cursos y las auxiliares de enfermeria otros.

EL admin admin crea los certificados y luego se agregan en cada uno de los empleados dependiendo de lo que se necesite

Edge case: el admin deja la alarma que esta faltando un curso que debe hace 15 dias, y le permiti ingreso al systema antes de velidarlo adecuadamsnte.

Es important las alarmar de lo que le debe cada cargo.

### Cambio en Centificados 
cambiar por el siguiente flow:
- "Agregar nuevo certificado"
- elegir tipo: ( Alturas, riesgo electrico, manipulacion de alimentos, otros)

### Crear seccion de pendinetes en empleado
creare una seccion de pendientes, de cualquier tipologia o cualquier accion pendiente en el empleado especifico.
muestra certificados pendientes por subir/actualizar u otros items que estan pendientes: e.g adjuntar hoja de vida

### nuevo campo: Hoja de vida

Opcion para cargar de hoja de vide a para facilmente validacion de cargos y estudios leyendo el archivo de hoja de vida. En el tab de info laborar agregar el campo para subir el archivo.


## Nomina

### Creacion de fundation: modulo Nomina

Creacion de modulo de nomima. Este modulo permite agregar infromacion simple sobre el pago de nomina en el periodo actual. permite crear entradas de nomina por empleado en el periodo ( mes actual o mes a seleccion ).
las entradas de nomina tiene informacion dependiendo del tipo de contrato que tenga el empleado.
e.g: Si en el periodo mayo 2026 el empleado tiene contrato tipo termino fijo, entonces ingresa el documento desprendible de nomina ( el pago de nomina ) y el salario registrado

casi todos los empleados son de prestacion de servicos entonces:
- cuentas de cobro por mes ( va acompana de informe de actividades, cuenta de cobro y pago de aportes ) son 3 o mas archivos para cargar, se muestra la opcion para cargar 3 archivos basicos y opcion de "otros", y recibos de pago por mes
    - fase 1: de contratacion: hoja de vida y contrato
        - certificado con el archivos; fecha de inicio
            - alturas
            - manipulacion de alimentos en el modulo que coresponde
            - contrato: tipo de contrado, fecha de inicio, fecha de fin (si es contrato termino indefinido no tiene fecha y carga el contrato).
    - fase 2: ya esta trabajando:
        - si es por prestacion de servicio, cuenta de cobro del periodo, documento de informe de actividades y comprobante pago de aportes
        - si es termino indefinido, desprendible de pago de nomina se adjunta

## Modulo novedades - en empleados
este modulo permite crear entradas de novedades por empleado, similar a notas, pero son novedades en relacion a cualquier incidencia relacionada con un empleado en particular.

tipos de novedades:
- llamado de atencion
- memorando
- permisos de ausentismo y etc
- vacaciones
- otra
Permite adjuntar archivos en al novedad como evidencia o informacion complementaria.
