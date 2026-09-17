 ux fixes Jul 8

## certification flow
The idea of certificados empresa is the following:
- create a certificate with the desired state: 
- e.g a certificate That renews every month. User does no have certificate at that moment, so user upload an expired certificate just for the record.
 - that record it's like an update that belongs to that certificate. In this case user create cert and algo add first update: optional file optional note and dates for the certificate
 - then certificate is created and it's pending so user must generate new certificate
 - then user can go to "Detalle del certificado" and see dataika and previous updates
 - then user click over "agregar" and adds an update with file notes and a update to the dates of the certificate. If date is going to be changes a new update is require with optional file and optional notes.
 - then when saved, the new certificate file appears at the top. The status is" valid" and new date with future expiration date is visible at the top.
  - the other old certificate updates appeared below, in case user need to validate any old file updates or note updated previously added.

Considering example flow, add modifications to the views and buttons, and proper db schema updates.
- new schema support the certificate with the updates entries ( optional file optional notes, a change in dates) 
- certificado detalles show option "agregar" to post update with file notes and new este.
- edit button could edit the actual certificado description and date. But this is not an update and you can not add files from edit view.
- when you create a certificate you fill up information, and you can post a fist update so user don't need to execute double step to setup a certificate.

## instrumentos flow
On the nuevo instrumento view:
- roles field must be a predetermined tag selector so user can not add a bad role. And the api function must properly cast these roles in a secure way.
- then instrumento nuevo must have option to upload the blank template file certificate O an optional helper file used to give insights about the certificate or as blank template to later upload the instrumento updates.

## paciente
- on historial de fichas: name of instrumento does not render not shown properly
- on historial de fichas - actualizar estado: ficha
   When selecting completado and select a file. User clicks guardar cambios but those changes are not saved properly and no action update frontend. Possibly a logi error on button, there are no visible logs on the backend services confirm by reading the logs on backend frontend. Looks like the issue is not related to code but some default behavior that reloads the page whenever user change page between foreground then background then foreground again, the moment user come back to the app the app reload itself resetting any state, view or logic ongoing and this also happens when uploading a file and pop-up view appeared in Android devices. Revisit this issue execute step by step analysis and propose solution. \
- on historial de fichas - actualizar estado: when ever you update with vencido, and clic guardar cambios It works but user is no longer able to click the pencil icon to apply changes. Double check why the edit pencil icon is disabled. User should be able to edit it and change status from vencido to completado with an attached file. 

## nomina 
- When checking nomina add option to filter by empleado with contract, and by default only show empleado with contract and filter by contract type and no contract. 
- when click on registrar and pop-up view appear to add nomina, que. Add nomina entry on OPS and no cuenta de cobro is attached and user try to save there is an error which Is expected. But there is no clear indication of the error that cuenta de cobro is required. 


# considerations 
The issue: reload webpage when browse comeback from background is causing some of the issues so first start with this. 
Follow current code patterns and always follow the structure 
Use your tools to track progress
Create main feature plan on context/plans/{ plans title - date}.md
