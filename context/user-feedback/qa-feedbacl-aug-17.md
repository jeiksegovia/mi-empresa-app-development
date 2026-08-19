# Raw transcript
Quiero quiero dos pestañas, o sea, quiero los inactivos obviamente van a estar porque es importante, pero no los quiero ver.
Exacto. Pero son, o sea, como que por
Entonces que yo puedo ponerle activos, que si quiero ver los inactivos, pongo inactivos, ¿me entiendes?
Exacto. O sea, es simplemente esto, por defecto. Ay, perdón.
Eso
por defecto sale así.
Ay,
o sea, ya está. Simplemente que por defecto te aparece solo los activos, que es lo que importa.
Y que si quiero ver los inactivos, pues los No, aquí, aquí, chin.
Y los ponen acá y ya. Pero que aquí no esté en todos, sino que esté en activos por defecto y ya.
Listo.
Perfecto.
Siga. Es que siga. Siga usted. A ver, entonces, eh, aquí tenemos este que está en edición. Sí, está la parte de contrato que aquí no tiene nada. Cargárselo.
Entonces, vamos a editar. Sí. Y hay un tema de en el acceso que yo no entiendo qué es que no le está permitiendo el acceso específicamente a lo del contrato. Es que yo no sé si es A ver
qué qué es lo que no te está permitiendo.
No está permitiendo el tema de en la parte de edición de empleado. Sí. en los permisos de el administrador y el usuario eh con el rol contratos sigue habiendo un problema cuando el empleado se desbloquea y el rol contratos tiene que hacer cambios en la parte de contratos. Hay un error específicamente cargando el cargando el end point de cargos que dice que no tiene permisos. Dice un warning 403, acceso no permitido para su perfil en la parte de cargos. Entonces, hay que hacer una revisión paso a paso porque los cargos en el tema de escritura está, o sea, no permitidos, pero en el tema de lectura por el rol contrato sí es permitido, sobre todo si el empleado está desbloqueado. El rol cargos debe el rol contratos debe poder eh editar cada una de las dimensiones, sea datos personales, núcleo familiar, información laboral, educación, certificados y contrato laboral, incluyendo los entities o subentities que tiene cada uno. Y esto incluye los cargos. ¿Cuáles cargos? O sea, los puede leer, puede obtener qué cargos hay, qué cargos hay disponible para poder renderizar qué tipo de contrato va a asignarle al empleado que está desbloqueado. Eso es un arreglo importante. Listo. Eh, de ahí para allá en en el tema de empleado.
Sí, ahí en editar es que lo cargo, ¿no? Mi amor,
exacto. O sea, ahí ella vería esto tal cual como usted.
Así
usted lo edita y aquí puede ver qué pasa. Tin. Entonces, aquí ya, por ejemplo, tenemos
subimos el archivo y aquí es donde viene la otra el otro arreglo, ¿no? Que es en en el tema de empleados, edición, nuevo contrato, tenemos OPS, obra o labor y término fijo,
término indefinido,
término indefinido, término fijo. Entonces, cuando es término fijo, como loca la loca
de pronto porque está loca para que la lca para que la traiga.
De pronto porque están ellos.
Claro, debe ser que más.
Sí, esa. No es eso. Es como bueno en la parte de nomina eh ya eh anotado los y aprobados los cambios en la parte de contratos que que está bien. E en la parte de nómina agregar o registrar nómina en contratos de término fijo o término indefinido. donde es el valor mensual. Además de los aportes sociales, hay que agregar los bonos porque los bonos es una adicional que tiene que ser, digamos que guardado de manera diferente al total del valor mensual.
Pero entonces si de aquí valor mensual, bonos, esto
valor mensual, bonos y después como ya está subtotal y aportes sociales
y abajito como ya está total a pagar. Entonces repito, arriba valor mensual como ya está. Se agrega la parte de bonos, después sigue el subtotal como ya está, aportes sociales y al final total a pagar.
Recuerda que el total a pagar es esto. Esto no se le paga al empleado, ¿sí me entiendes? O sea, no tiene que sumarlo. Esto se contabiliza, pero no se suma aquí.
Okay. Eso es importante.
A ver,
porque esto se paga directamente a las entidades, pero yo tengo que saber cuándo pagué.
Pero y también depende, ¿no? Porque al empleado a veces no se le paga eso. Pero sí le das el total.
No debe, no eso nunca, eso jamás se puede hacer. Yo lo hago por ahora. Yo lo hago, pero eso no se debe hacer. Esal, o sea, eso es mejor ni ponerlo porque los estamos induciendo al error. Error. Exacto.
Usted ahí,
mejor dicho, la norma dice, el que paga mal paga dos veces.
Y si usted le pagó al empleadom
eh lasías lao.
Sí, claro. O sea, ya usted verá
si usted le pagó la embargo. Lo único que se le puede pagar al empleado es el salario prima de servicios y intereses a lasantías
nada más.
Entonces, cabe aclarar ahí de que el total a pagar es igual a el valor mensual
más los bonos.
Eso es el subtotal y el total a pagar no tiene en cuenta el tema de aportes sociales.
No tenemos solamente comoar referente de cuánto estamos pagando.
Pero Exacto. Pero el tema de aportes sociales sí queda en el registro de los pagos de nómina para para tener un referente de cuánto se cuánto es en pesos el valor de los aportes sociales de todos los empleados. O sea, eso sí debe quedar ahí, pero el total a pagar no es la sumatoria de aportes sociales, eso no va bien. Entonces, bueno, ahí notas desprendible. Guardar validación. Está chistoso. A ver, pam. Otra vez tanan. Aquí. Okay. Nomina. ¿Será que exige el desprender o no creo no debería? Eh, pongámosle un archivo cualquiera. ¿Qué será? Pongámosle eh ¿Qué? No tiene por ahí archivos cualquiera. Tiene la familia
es que está pesado. Ah, no, no. Charla de la familia.
Subiendo. Ah, venga, estamos a ocho. Igual, mira que aquí te sale la asistencia, ¿no? O sea,
como como referencia. Bueno, entonces en la parte de nómina, cuando se efectúa el pago de de tipo de contrato término fijo, el end point de periodos que es AP B1 nómina/periodos tiene una un request 400. Muy seguramente alguno de los valores no está. Muy seguramente el valor de jornada lo está esperando, pero hay que hacer un reglo porque el valor de jornada no es requerido. ni valor de jornada ni medias jornadas es requerido cuando el tipo de contrato es término fijo o indefinido. Eso hay que repararlo porque claro está dice como que ve te faltan de estos datos, pero no viene el caso en este en estos tipos de contratos. Entonces hay que hacer un análisis paso a paso, validar el tema de de el endpint de periodos y asegurarse de que valide los valores requeridos dependiendo del tipo de contrato. Listo. Otra cosa que no sé si mencionamos es que en la parte de empleados uno de los cambios es que cuando se abre la vista empleados, ya sea para el administrador o para el rol contratos, automáticamente se muestra en estados activos. O sea, por defecto El filtro por defecto es mostrar todos los empleados en estado activo. Listo. Ahora
pones.
No, no, el el después. Entonces ahora hay que revisar en la parte de los instrumentos. los instrumentos, signos vitales. Aquí lo que quería revisar Eliana era el tema de que no es necesario los datos personales porque claramente el instrumento va a estar e en cada vuelo.
Exacto. O sea, va a estar linkqueado al paciente. Ya todos los datos personales ya están. Usted se va a desaponer eh
las medidas que son las mediciones. Esto sí está bien. Puras mediciones. Puras mediciones. Pi pi pi pi pi y no es más. Y el y la evaluación anual que es importante porque en la evaluación anual pasado es lo mismo. No es necesario poner hm datos personales porque ya están con el paciente.
Eh tampoco era necesario poner el periodo, pero lo decidimos dejar para para temas de tensión como que, ah, no, mira, estamos haciendo esto. Entonces, usted manualmente pone esto y pone también eh el nombre de el profesional, que es que es así como como cuando te ponen a o sea hacer una acción en una plataforma y te dicen, "Eh, por favor, ponga su nombre manualmente para estar seguro de que usted leyó todo y que lo hizo pues conciencia y y eso pues digamos que es equivalente a una firma."
Sí. Ya. Entonces, este ya quedó como es. Perfecto. Entonces, eh esto está bien. Aquí lo único que faltaría por evaluar es el tema de el tema de las actividades de los profesores. No sé si se acuerdo.
Mm. Entonces, porque eso también ya se había planillado, pero ahí sí recuerdo dónde está el usuario. Eh, a ver, entonces tenemos feedback Q. Entonces, en aquí busquémoslo. Esto era actividades actividades Informe de actividades. Y aquí está informe de actividades. Cont. Informe de actividades. Cuenta de coro. Archivos es que nos toca pagar por esa los ojos
18.
Depende, depende del lente.
Es que la creo que es la misma.
Listo. Entonces, en términos generales, hasta aquí está todo okay
con la aplicación. Sin embargo, hay un un feature adicional que hay que crear. Es el tema de el informe, el log de actividades. eh de los profesionales, en este caso de el rol de los profesores y enfermeros también, ¿no? Sí. O sea, todos los empleados pueden tener ese ese lock de actividades,
¿eh? Ajá. Ay, qué lindo ese pajarito que siempre nos visita, ¿eh? Solamente el profesor y el auxiliar de enfermería.
Solo esos dos. Sí, los otros no son pasantes.
Ah, bueno. Entonces, solo esos dos roles, profesor y auxiliar de enfermería, tienen tienen acceso a este, digamos que nuevo módulo, que sería un tipo de submódulo de asistencia, porque es similar a asistencia en el sentido de que es diario. Sí. O puede ser casi diario o puede ser cada dos días o tres. Eso es libre y opcional, pero debe dejar registro de las actividades de los profesores y auxiliares. de enfermería y permitir un login. Entonces, el profesor, el flujo ideal es el profesor va a la plataforma, inicia con su combinación de correo, contraseña, eh tiene acceso a limitado a los pacientes porque un profesor o auxiliar de enfermería puede poner notas sobre los pacientes, eso es lo único que pues puede hacer. Y puede también registrar en su log de actividades que que hizo el día de hoy también con la misma restricción de solo se puede el día de hoy, no se puede
llenar las actividades de otros días, sino el día de hoy se llena lo que se hizo hoy y punto. Si no lo llenó, tienes que mandar un correo y con el éxito
justificar.
Eh, y ese log de actividades, ¿cómo es? Es pues muy sencillo. Aparece la fecha, un campo de texto y ya. Pues es texto, según lo que recuerdo que Te dijo Elian, no más.
Perfecto,
es texto y ya queda con con la fecha y digamos que relacionado con el profesor. Sí. Y ese registro va como paralelo al tema de las asistencias, o sea, los logs de las actividades por día y la asistencia. ¿Sí? Entonces, si por ejemplo hay asistencia y lock, ahí se ve bueno. Como así, si no vino, entonces, ¿cómo hizo el lock?
Mm.
O lo contrario, vino y no hizo, no dejó puesto que hizo, eh, Eso también sirve para rectificar que la asistencia sea consistente. Entonces, eso sería lo único que falta de toda esta sección que es como de e pacientes, empleados, nómina, eh datos personales de empleados, pacientes, notas y certificados.
