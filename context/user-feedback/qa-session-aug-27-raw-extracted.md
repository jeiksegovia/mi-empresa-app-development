# Extracted transcript — 2026-08-27

## Speakers

- **Developer (Jake)** — labeled `You` in Google Meet captions (developer running the QA session).
- **Paola** — labeled `paola` in Google Meet captions (client / product owner).

Other people mentioned (not speaking in this dump): Liliana / Eliana (gerontóloga / auditorías), Carolina (rol contratos), Karol.

Source: Google Meet live captions HTML dumped into markdown (mixed markdown wrapper + HTML). Speech-to-text errors preserved.

## Transcript

**Developer (Jake):** correcto que El rol cubay contratos no puede crear nuevos certificados es correcto.

**Paola:** Listo, míralo aquí de divino.

**Developer (Jake):** Exacto pero entonces estamos validando es correcto eso que digo, o sea, el kit de contratos puede o no puede crear certificados?

**Paola:** que no, pues dijimos que esto iba a estar a cargo de Liliana

**Developer (Jake):** Digamos que son son las dos, porque las dos necesitan a veces acceder a los certificados acceder.

**Paola:** No, es que una cosa es acceder y otra cosa es crearlo.

**Developer (Jake):** correcto, Quién es el que los crea porque

**Paola:** No yo prefiero yo prefiero que siga siendo yo, verdad, mi vida, que ellas no tengan como manipular la información ellas pueden acceder.

**Developer (Jake):** exacto acceder y leer y descargar

**Paola:** imprimir y descargar pero manipular no

**Developer (Jake):** Exacto porque digamos que por ejemplo algún certificado cosa pues importante eso digamos que repercute entonces si por ejemplo se necesita hacer una actualización sobre un certificado clave se lo mandan usted entonces usted ya está así esto lo actualizamos yo mismo lo hizo e igual es algo que pasa cada cada año, o sea no es no es cada mes.

**Paola:** Y mejor yo más, no?

**Developer (Jake):** Entonces sí sí y Eliana si necesita acceso para descargarlo porque pues ella sí me comentó que para muchos reportes y cosas lo descarga y lo adjunta y lo envía.

**Paola:** Y ella es la que la que la que atiende todas las visitas auditorías todo lo que nos hacen. Vamos al gestión de personal, vamos a borrar todo lo que hay. para Empezar a cargar realmente todos los empleados.

**Developer (Jake):** Excelente entonces Pero bueno sería bueno que se cree ahí un certificado de prueba. Aunque ese ya lo

**Paola:** Que vayamos.

**Developer (Jake):** Ya lo hemos ido probando exacto Me gusta.  bello

**Paola:** divino listo aprobado

**Developer (Jake):** Listo aparte de certificado está bien Lo único, es corroborar que los permisos son correctos y tanto qa contratos y cuajaerontólogo Rolls pueden solo leer y descargar no pueden ni editar ni crear solo. Solo read Access eso es lo único. Listo, ahora Estamos en la parte de empleados nuevo empleado el formato para crear los empleados paso a paso estaba en la parte de datos personales.

**Paola:** Ya no quiero todo eso.

**Developer (Jake):** listo

**Paola:** listo

**Developer (Jake):** ahora quiere seguir haciendo las pruebas de empleados porque recuerda que teníamos que hacer una prueba de empleados de que usted crea ese empleado está desbloqueado sin el candadito y ese empleado tiene el candadito lo puede editar Carolina Entonces puede ir ahí?

**Paola:** a este

**Developer (Jake):** Y le da le da primero creo que es ver perfil. Eso ahí ve el perfil. Ahí, Ahí le sale la opción para bloquear o desbloquear. Entonces ahí está desbloqueado como está desbloqueado Carolina lo puede editar. Entonces se tiene que meter en el perfil de Carolina

**Paola:** La idea es que ella lo ingrese ella lo ingresa y

**Developer (Jake):** y ya usted solo usted lo puede bloquear que eso sí, eso sí funciona, pero teníamos problemas de los permisos, entonces hay que validar, que ella lo cuando esté desbloqueado lo puede crear y

**Paola:** Mañana me vengo a sentar con ella para ingresar a todos los empleados. Mañana porque pues La idea, es que ingresemos todo y empecemos a legalizar

**Developer (Jake):** pero pues

**Paola:** todo.

**Developer (Jake):** Pero entonces venga, antes de ingresar todo probemos entonces sálgase de su sesión. de clic arriba viene arriba en en La en la barra no, no tan arriba más abajito donde está la lunita al lado.

**Paola:** aquí

**Developer (Jake):** al lado

**Paola:** aquí

**Developer (Jake):** inicie con el de Carolina

**Paola:** No lo bloqueé no lo bloqueé. Ni a ninguno, pues para para mirar cómo funcionaba acá. Allí hice una modificación me lo aseguro.

**Developer (Jake):** no lo vaya a cerrar que

**Paola:** No cierro.

**Developer (Jake):** Es ahí ya.

**Paola:** Ya, ya le modifiqué la cédula.

**Developer (Jake):** Y ya salió que sí, guardó, no?

**Paola:** A información laboral o acá?

**Developer (Jake):** Vi Ah sí, Perfecto perfecto. Ahora vaya a contrato laboral. contrato laboral al final de la del tap exacto Exacto ahí Ahí no sé cómo la vuelta. Porque ya no recuerdo que habíamos dicho de contrato laboral.

**Paola:** solamente es Contrato laboral pues pero por acá está la información, no?

**Developer (Jake):** Si no, no O sea contrato laboral ahí al menos según Exacto ahí no le está

**Paola:** Era cargarlo.

**Developer (Jake):** dejando acceder a la parte de creación de contrato laboral por si acaso, pero creo que ella sí debe poder crear, o sea, además de editar cargar cargar

**Paola:** Claro Ella lo tiene que

**Developer (Jake):** contrato lavadora, listo Entonces ese es ese es la primera cosa de que además O sea ya está. está bien pero

**Paola:** Ha subido hoja de vida. Pero mira que tampoco le da.

**Developer (Jake):** No sé si ahí está, ahí está, sí.

**Paola:** ya

**Developer (Jake):** Sí ahí está. Bien. Si no, ahí lo único es que lo de contrato laboral tiene como otros otros seguros entonces.

**Paola:** Dónde estaba el contrato laboral, Sí sí, pero pero cómo lo creamos, no?

**Developer (Jake):** al final Por eso, o sea, Ahí ahí no le aparece para agregar el contrato laboral por el tipo de rol que tiene Entonces sí debe permitirle crear actualizar todo del contrato laboral. Cuando esté desbloqueado. Listo, ese es uno de los cambios que pues sí o sí hay que hacer Pero ese lo podría ir haciendo ya mismo. Venga. entonces lo primero es en la parte de information on empleado crear

**Paola:** Qué estás haciendo?

**Developer (Jake):** redactando la corrección

**Paola:** Mañana nos puede, nos puede prestar asistencia técnica remota.

**Developer (Jake):** Para qué? Qué será Ah para

**Paola:** Sí pues para hacer para decirle a Liliana que tenga a Liliana que tenga todo lo

**Developer (Jake):** el

**Paola:** de los abuelos a Carolina que tenga todo lo de los empleados y empezar a cargar la información

**Developer (Jake):** Bueno, sigamos entonces ahí ya está trabajando en el fix para esa vuelta.

**Paola:** uniforme aquí Sí, sí, sí, sí sí sí. Me voy ahorita. Listo Entonces qué más hago?

**Developer (Jake):** sigamos sigamos con el Kevin Entonces ya ya sabemos que vamos a reparar es esa parte de

**Paola:** contrato laboral

**Developer (Jake):** De contrato por el rol de contratos Así que es lo que lo importante ahí.

**Paola:** Entonces usted me borra usted me borra toda la información. para amanecer limpia y empezar

**Developer (Jake):** Sí, correcto. correcto Pues el tema es que yo quisiera hacer estos fixes antes de antes de cualquier cosa porque pues imagínense

**Paola:** entro con el rol de Eliana para mirar

**Developer (Jake):** Exacto Tengo que entrar con el rol de Eliana para mirar las cosas de ella también Y con el rol de los profesores que ese ese es nuevo.

**Paola:** listo

**Developer (Jake):** una pregunta Contratos el rol de contratos puede crear cargos también?

**Paola:** sí

**Developer (Jake):** sí, eso sí pues Si no, pues no veo que que sea peligroso si ella cree a cargos Usted igual,

**Paola:** sí

**Developer (Jake):** después los puede borrar. Y lo que importa es los cargos que tienen contrato igual, o sea, si si hay diez cargos que no hacen nada, pero los que tienen contratos son los que o sea, eso es lo que realmente, vale, legalmente, verdad?

**Paola:** exactamente

**Developer (Jake):** Entonces vamos a permitir que pueda editar crear y borrar cargos.

**Paola:** No borrar, no.

**Developer (Jake):** solo leer y crear listo

**Paola:** Sí ahí la bloqueamos para que para borrar me tenga que informar a mí y yo tenga.

**Developer (Jake):** Sí claro justo o sea Generalmente el admin es el que ahorro Usted es la que ahorra.

**Paola:** exacto Qué está haciendo?

**Developer (Jake):** redactando las limitaciones de contratos can not create

**Paola:** ya

**Developer (Jake):** Listo, aquí está y para esto estoy usando croc cuatro punto seis que es el nuevo croc que usted todavía no lo no lo está usando. Tiene tiene que configurarlo el tema es que ese grogu es costoso Entonces mejor

**Paola:** ya

**Developer (Jake):** dicho usted solo lo usa cuando usted necesita que Rafa haga algo brutal Entonces usted Dice Rafa Necesito que te pongas en el modo súper croc y el cambia y usa el modelo más caro para cosas.

**Paola:** Pero conmigo lo puedo hacer.

**Developer (Jake):** Sí claro. con su con su Rafa lo puede hacer Lastimosamente con grog De la interfaz web ese no te da la opción para poner el último modelo, no sé por qué.

**Paola:** Bueno, Esto sí nos toca hacerlo Pues en línea con Eliana Pero y ella Ya revisó su módulo, verdad?

**Developer (Jake):** Sí pero pero por ejemplo, por ejemplo, aquí no hemos revisado en la nota se crea una nota. Exacto que era la nota

**Paola:** Sino que no quería era porque como ella ya cargó esta usuaria No porque yo es que pensara que me reía porque le iba a ponerse enloqueció, pero no.

**Developer (Jake):** No pues pues pero es que pues igual Patito o sea, lo que hemos hecho Igual igual

**Paola:** bueno

**Developer (Jake):** hay que hay que borrar Sí claro, Hay que borrarlo para para que quede.

**Paola:** Todo Borrar listo. la nota perfecta

**Developer (Jake):** listo listo acá listo

**Paola:** Espérate que quiero con el rol de Karol ya me salgo Quiero con el rol de Carolina mirar lo de la caja, que es lo que más quiero que me ingrese mañana.

**Developer (Jake):** bueno yo tengo que Ir al baño un ratín. pero

**Paola:** Entonces yo me voy por la niña

**Developer (Jake):** Ah bueno bueno

**Paola:** y

**Developer (Jake):** Porque igual aquí ya está reparando lo que hay que reparar Sería bueno.

**Paola:** Me dice que Iniciar sesión.

**Developer (Jake):** Mire el password que le está poniendo a ver.

**Paola:** Y ya le Ya le puse Mira está el de contratos y está el de contratos.

**Developer (Jake):** a ver contratos Pero si ese lo iniciamos ahoritica

**Paola:** Por eso será porque vos le estás haciendo alguna actualización.

**Developer (Jake):** Que no, pero todavía no. Sí, no es que está metiéndome en el dedo.

**Paola:** Ya no señor.

**Developer (Jake):** Sí porque cuando lo copió lo copió mal, o sea usted lo copió y le metió el

**Paola:** no

**Developer (Jake):** dedo entonces claro, ahí quedó ya chueco con el espacio pues Ah por ejemplo, ahí habíamos cambiado, no? Que cuando usted va a buscar eso cuando usted va a comprar ve cuando usted va Cuando ponen los empleados por defecto salen los activos, eso está así, no? Porque vi que solo salían los activos. Eso Se nos olvidó echarle un ojo.

**Paola:** Sabes qué, mi vida? Aquí quiero que nos vaya bloqueando, o sea, lo que ella va creando, se vaya bloqueando.

**Developer (Jake):** Ah pero en el rol Exacto en el rol de contratos Claro claro, Sí o sea Exacto

**Paola:** Que no. Sí que ya no.

**Developer (Jake):** porque recuerdo que lo que nos faltaba en el centro de costos era hablar de las limitaciones de los otros roles porque claro es lo mismo pueden crear. No pueden no pueden borrar.

**Paola:** No, pero otra cosa importantísima otra cosa importantísima no pueden creer, no pueden borrar, pero tampoco me pueden crear con fechas anteriores. Este rol Si me entiendes mi vida, por qué? Porque por de algo ella aquí Hoy me reportó, por ejemplo dos pagos. Llega el veinte de agosto y me meto otro pago como si hubiera ingresado el primero.

**Developer (Jake):** exacto

**Paola:** No lo puede hacer O sea ella solamente puede ingresar.

**Developer (Jake):** Eso no lo puedo.

**Paola:** un día anterior No puede hacia más atrás, no me puede ingresar esa fecha, o sea la fecha aquí cuando yo le doy Añadir ítem, esta fecha solamente puede ser Del día anterior. Ah bueno y el fin de semana Cómo lo manejamos del día se puede del día hábil anterior?

**Developer (Jake):** Me acuerdo que eso lo teníamos.

**Paola:** si en alguna en alguna en alguno de los controles

**Developer (Jake):** sí Del día sí sí sí sí sí, del día hábil anterior Entonces si el lunes festivo del viernes lo deja. Si eso es posible. Eso es posible.

**Paola:** Dale es importante, mi vida.

**Developer (Jake):** A ver, aquí vamos a poner.

**Paola:** Pero pero Espérate Espérate porque mañana no O sea en este momento no, no, no le des la orden porque como mañana Vamos a ingresar lo que es julio y agosto.

**Developer (Jake):** No, pero es que eso debe ser eso, Por ejemplo, debe debe ser una opción de ir de El admin usted, pues porque eso va a ser común de que a veces sí, entonces hay que ponerlo es como una opción de limitar edición de centro de costos en rol contratos. A digámoslo así el día hábil anterior. O sin limitación. O sea, tiene esas dos opciones, te gusta lo Desbloquea o lo bloquea normal?

**Paola:** Exactamente para que ya mañana me puede ingresar todo

**Developer (Jake):** Sí, listo. Sí claro.

**Paola:** Amo mi centro de costos.

**Developer (Jake):** Si está está bonito, la verdad. Ahí hay unas cosillas que voy a mejorar, pero pero primero.

**Paola:** Cómo ingreso como ingreso un nuevo centro de costos con mi usuario

**Developer (Jake):** Correcto el admin sí puede. correctísimo

**Paola:** eres un

**Developer (Jake):** Bueno Entonces voy a voy a poner al baño que me reviento y

**Paola:** Genio, voy al baño. Yo me voy y en 15 minutos estoy aquí.

**Developer (Jake):** bueno

**Paola:** Vale, Ya nos vemos.

**Developer (Jake):** Chao.
