# QA Session Jul 24 - RAW

Bueno, esta es la sesión de QA de el 24 de julio. Entonces, eh estamos en la parte de agregar empleados. En la parte de agregar empleados tenemos eh un primer cambio en el medio medio de pago de nómina, donde serían eh bueno, está sin definir como ya está en este momento. Neki o llave. O sea, en la opción de N hay que agregar la parte de llave. Ese número de N o llave es alfa numérico porque en X es un número celular, pero la llave es alfaérico. Puede ser letras, números o correos inclusive. En la opción de transferencia bancaria está bien como está, nombre de el banco, tipo de cuenta y el número de cuenta
y agregar efectivo
y y se le agregaría una opción en el medio de pago de efectivo. Eh, también hay que validar un bug en la parte de eh edición porque cuando se editan estos campos hay un error en el backend, es decir, no se puede editar solo ese campo, debería poderse editar eh tanto por el administrador como por el rol de contratos. también en la parte de experiencia en la parte de información laboral hay que remover la parte de cargos, ya que es redundante con lo de experiencia laboral. Entonces, el ítem de cargos en el tab de información laboral es
se elimina. M bien. Eh, en la parte de editar contrato o agregar contrato, esto está bien, ¿verdad? Las opciones.
Vamos a a a corregir solamente los Listo. Listo. En la parte de los contratos todo está bien. Lo único es el tema de cargos, que hay unos cargos por defecto. Eh, los cargos por defecto que se van a crear son administrador, ¿qué más? Auxiliar de enfermería, gerontología, gerontóloga y servicios generales.
Eliminar.
Y en lugar
no eliminar cociner. Mm.
Y se elimina cocinera y se agrega un cargo más que que se va a llamar temporal
y los profesionales no terapeuta ocupacional.
Okay. Entonces,
fisioterap
y hay otros
cargos que son los profesionales que son
terapeuta ocupacional, fisioterapeuta, psicólogo, educador físico y artes y manualidades. Bien dicho eso. Listo. De ahí para allá no hay más cambios. Usted ahí pone el par de la jornada. Tin tin. También en la parte de eh perfil de empleado, en los detalles de el empleado, en la información personal. debe salir un previo de el medio de pago que está seleccionado por si acaso o de la información disponible de el medio de pago solo para validar. Bueno, ahora en la parte de asistencia hay un cambio sobre eh los permisos o permis en la parte de asistencia de empleados. En esta parte, hm, el el rol eh de contratos, el rol de contratos que usualmente solo puede acceder a la parte de empleados y pacientes no más, eh, va a poder guardar asistencia solo del día de hoy, solo de el día presente. Y el administrador es el que puede elegir una fecha diferente a la de hoy y cambiar eh cualquier récord de asistencia en el pasado. Sí. E sí, eso es. Eh, de ahí para allá no hay más cambio, ¿no? Mm. Está bien. Y usted aquí puede reportar no asistencia, por ejemplo,
o la justificación de por qué se está pagando doble. Ahí la nota. Beautiful. Hoy es
24
y el 23. Perfecto. Listo. Entonces, eh también Bien, habíamos discutido otro cambio, pero no recuerdo. Nómina
Ah, nómina. Nómina.
No,
está bien.
Entonces, en la parte de contratos, nuevo contrato,
todos los contratos
cuando el contrato sea término definido, fijo, obra o labor. se fija un valor mensual de salario.
Entonces, el contrato, obra o labor, término fijo o término indefinido, tiene un valor que no es por jornada, sino es mensual,
es decir, que por todo el mes es un es un total, ¿no? Esos contratos tienen una lógica diferente, es decir, que e

# tenical consideration
Be aware the new contrato type - impact the nomina model. Recommendation is adding the field into the shema and only use the target field depending on the contrato type so nomina is fairly simple. it always be labor-hour/half hornada payment/ montly-value.