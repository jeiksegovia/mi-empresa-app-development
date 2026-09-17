# backend improvements

## user type: empleado
User or Usuario entity is linked to session and authentication (already implemented). change: it should also have a relationship with Empleado entity if role is employee, so we can easily get user data (employee) and permissions based on empleado entity role/position,

# Frontend improvements

## ui elements style improvements

### input element: Buscar por nombre, apellido o documento...
input text is overlaping  with the serach icon. add pading to the left of the input text. 
Fix across all screens where this input is used, like empleados list, pacientes list, etc.

### navbar menu icon change
Menu button in desktop should be hidden

### element <!-- Sidebar -->
Add logic to hide Items from <!-- Navigation Menu --> depending on user role.
- empresa should be visible only for admin users, and hidden for users with employee roles

## Pacientes screen improvements
Implement proper flow followin current desing patter and styles for:
- add note to the patiente
- update ficha ir add an update to a pending ficha, with proper form and flow.
- edit patiente
- create patiente

# Important
Create comprehesive todo list for the above improvements, with clear steps and expected outcomes for each task. Update and create test per new steps, or confirm current tests are passing. If test are not passing, spawn sub-agent with proper context to fix the issue and update the test accordingly, Iterate 10 times until all tests are passing and improvements are implemented successfully.
shutdown any server backend frontend dev server or bash script after finihing the session and create reports.