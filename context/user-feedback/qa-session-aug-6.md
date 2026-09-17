# Raw trabscript
O sea, quitarle cédula, nombre y datos personales a los dos nuevos instrumentos creados. signos vitales y boletin anual usuarios. Esto porque los datos personales ya estan linkeados con el paciente, por lo tanto cualquier dato personal como cedua nombre viene de la entidad paciente y no necesuta repetirce.

Eh, el tema de permisos dijo usted para Caro.
Sí, porque cuando Carolina cuando el usuario contratos de Role Contratos está intentando editar la parte de contratos de un empleado, sale que no tiene permiso. Esto debe ser debido a que digamos que hay ahora hay un "Locked", pero entonces cuando el perfil está unlocked debe poder permitir al rol contratos editar cualquier información, tanto de contratos como información básica, etcétera, etcétera.
En todo caso hay un tema con los permisis porque con o sin el empleado en estado "locked" qa-contratos no puede editar la informacion de contratos y sale un error de permisis, por lo tanto es necesario analyzar paso a paso la logica de los permisos, create test para asegurar funcionacmiento de edicion.

