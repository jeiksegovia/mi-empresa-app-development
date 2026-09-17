# QA session 2026-09-02 — extracted Meet captions (Jake + Paola)

**Source**: `qa-centro-costos-feedback-sep-2-raw.md` (Google Meet HTML captions)  
**Speakers**: You = Jake (developer) · paola = Paola (ADMIN / product)

001 Jake: 8 buenas
002 paola: Cómo vamos?
003 Jake: Bien, muy bien, aquí tengo reunión a las 12 en punto.
004 paola: Ay bruto bueno rápidamente Entonces vamos, te voy a compartir pantalla. Entonces primera modificación prenda su asistente Entonces vamos.
005 Jake: Ya está prendido ready está tomando notas.
006 paola: Entonces, primera modificación no me deja cargar Eli no puede cargar, no tiene la opción de cargar los documentos entonces en la opción de certificados. certificación empresarial sí, Añadir documento no le aparece la opción de Añadir documento cuando lo crea espérame
007 Jake: En la parte de certificados de la empresa aclaración listo.
008 paola: Para el usuario de Eli vale?
009 Jake: Sí que es rol de gerontóloga Entonces eso por diseño fue hecho así O sea solo podía leer ahora que pueda modificar o sea todos los permisos.
010 paola: No ella puede cargarlos ella puede cargarlos lo que no puedes modificarlos Si me entiendes.
011 Jake: okay O sea una vez cargado Ya solo el
012 paola: Se genera candado.
013 Jake: Admin Perfecto entonces clarísimo eso Roger gerontóloga puede digamos que agregar crear entonces puede por ejemplo actualizar el de El 2027, pero no puede modificarlos solo es la modificarlos en certificados y empresa listo.
014 paola: Listo, el segundo segundo Aquí vamos a gestión clientes, Sí valoración aquí en el buscador vamos a dar valoración integral. Qué le pasó?
015 Jake: Es que ahí buscas, es por el nombre de el paciente.
016 paola: Así Yo sí decía estaba como en él Entonces vamos aquí cogemos al paciente, No lo hicimos diferente. Ah sí sí sí sí sí, sí, cogimos al paciente. Sí, nos fuimos al subcampo de fichas y evaluaciones en el buscador, vamos a ver valoración integral sí, y en el y en valoración integral estos datos no los necesitamos desde cédula hasta sexo hasta acá Esto no se necesita porque ya está cargado acá.
017 Jake: sí Pero qué peculiar eso eso lo habremos removido.
018 paola: Sí eso me dijo Eli dijo esto ya lo habíamos anterior, pero no sigue, sigue estando.
019 Jake: Eso eso Me imagino que fue un tema por el backup que se hizo porque ya estaba removido Y ya hay una versión que tenía esos Campos removidos O sea ya ya nada, nada de los datos personales se repiten porque el paciente ya los tiene por defecto, entonces voy a rectificar ese cuál versión de valoración integral está en este momento en staging para validar de que esté la última la cual no debe tener los campos repetidos.
020 paola: exactamente
021 Jake: listo Tiene esos Campos verdad?
022 paola: listo
023 Jake: Ya los otros listo.
024 paola: Desde fecha de ingreso en adelante, Sí listo y en el en el en el rol de
025 Jake: Bien.
026 paola: Carolina en el rol de Carolina Solamente necesitamos es que en el rol de Carolina en centros de costos que ella pueda digitar pueda digitar el precio, por qué nos pasa esto? Porque por ejemplo un cliente que viene a matricularse o bueno, se llama matricularse el quince del mes en teoría va a aparecer por defecto el valor a cancelar si coge mensualidad completa o coge por días o bueno, lo que sea tanto en mensualidad como en transporte, pero resulta que ese ese valor por defecto no va a ser porque nosotros hacemos todos corte 30, entonces uno serán 300.000 otros serán 250 mil entonces que en todos estos Campos ella pueda digitar el valor. En todo lo que son ingresos y egresos.
027 Jake: OK Pero entonces digitar el valor se refiere a hágame la demostración con el usuario usted Abre
028 paola: Aquí por ejemplo abro y y y voy a cargar un nuevo un nuevo vuelo Sí entonces aquí está método de pago y aquí este valor, Mira que ya está entonces ella lo pueda digitar.
029 Jake: O sea que es el valor total unitario por defecto ese Solo lo puede poner usted que ese es el valor que va a salir.
030 paola: No, no, elimina lo que no entre por defecto que yo lo pueda digitar.
031 Jake: Ah o sea, ya no hay valor unitario por defecto, sino que en cada ítem de centro de costos de tipo ingreso. El valor unitario va a hacer un campo que es editable completamente y ni siquiera va a tener un valor inicial, o sea, toca digitarlo desde cero.
032 paola: exactamente
033 Jake: Listo Entonces eso es un cambio, pues importante es fácil de hacer porque si O sea ya está la estructura de la información, pero la manera en que se asegura va a ser diferente Entonces eso quiere decir que en centro de costos los de tipo ingreso ya se va a remover el campo de valor unitario por defecto Entonces ya no, no hay valor unitario por defecto y en el ingreso de cada ítem, centro de costos de tipo ingreso, el costo unitario es un campo numérico que se puede asignar en cada cada vez que se ingresa un ítem, verdad? listo perfecto
034 paola: Listo ya Esas son las modificaciones Ahora sí viene la más importante y es que le podamos poner al recibo a No mentira en el recibo. verás que cuando tú vas a ingresar una mensualidad aparece aparece como Un aparece un formato, pero cuando vos vas a ingresar una valoración solamente aparece pagador y nada más O sea no aparece el beneficiario que sí aparece en el de mensualidad. Entonces queremos, es que quede el mismo formato, o sea, el mismo formato que sale en mensualidad sea el mismo formato que sale en valoración que es fecha pagador beneficiario concepto Pues que en este caso es valoración detalle cantidad valor unitario y el total medio de pago notas esos
035 Jake: Okay.
036 paola: mismos Campos dejarlos para el ingreso de valoración.
037 Jake: listo Bueno yo tengo que
038 paola: Y el encabezado ya ese sí ahorita lo hacemos. Y para finalizar necesito ponerle al a la factura kidon que no diga empresa tal sino que diga en casa.
039 Jake: Sí mire que que es raro porque eso lo está cogiendo de la empresa del del de los valores de la empresa Pero por alguna razón no se modifica, o sea, en la parte de admin. Tú puedes cambiar el nombre de la empresa y ahí poner en casa y la dirección, pero por alguna razón, no, no está tomando usted Ya revisó de que en la parte de opciones ya tuviera los datos de en casa.
040 paola: No, es que eso, Por ejemplo yo tampoco sé cómo crear cosas nuevas, entonces, pues haga su reunión me hace desocupe, yo voy a estar aquí hasta la una, si se
041 Jake: No creo va a tener que ser en la tardecita.
042 paola: desocupa rápido, me avisa para que hagamos esas modificaciones, me enseño. A las dos Bueno dale por la tarde usted me llama apenas este desocupado.
