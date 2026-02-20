# Frontend improvements

## Inicio
Inicio screen should follow the .superdesign/design_iterations/dashboard_1.html welcome screen design, with the following components:
```
Bienvenido a Mi Empresa App
Gestiona tu empresa desde estos 4 módulos principales
4 cards with the 4 main modules: Empleados, Contratación y Nómina, Gestión del Tiempo, Finanzas y Presupuesto
```

check the desing, and mimic the same strucutre and style with primevue components and minimun changes.
use playwright MCP or playwright to create helper script to get html, ariaStructure css and screenshot to compare both desing. Use a sub agent to iterate over the desing and make it similart on every step. 

### 🕐 Actividad Reciente
put the section following the design, with a table with the recent activity.

User sub-agent to compare desing, get snapshopt screnshot identify diferences, create plan, then implement the minumal changes to make it similar, iterate until 10 times the design is similar enough.

## color themes and contrast
fix `pi pi-users` icon, is not visible due same color on background and icon color. use .superdesign/design_iterations/default_ui_theme.css as reference for color shceme.

## ui style
- check butons, inputs, active icon, card corner radious and make it more similar to the design, use .superdesign/design_iterations/default_ui_theme.css .superdesign/design_iterations/dashboard_1.html .superdesign/design_iterations/employee_history_1.html .superdesign/design_iterations/employees_list_1.html and so on for refernece.

- check nabar and make it more consistent with the design, use .superdesign/design_iterations/dashboard_1.html as reference. 
 - ussues when scrolling the bar has transparent backgroind so content behind mix with navbar text, fix it.

- thin graylines on borders, sidebar navbar was not part of the design. remove it.
- search bar icon  pi-search is overlaping input-placehoder text. add maring to text. identify similar issues on other inputs and fix them.

identify wich .superdesign/design_iterations/xxx.html file corresponds to each screen and use it as reference for the design, create a checklist of components and styles to compare and fix on each screen, iterate until the design is similar enough. Iterate 10 times on each screen, using a frontend sub-agent to compare design, get snapshot screenshot identify diferences, create plan, then implement the minumal changes to make it similar, iterate until 10 times the design is similar enough.

empresa is a new screen, so use the default_ui_theme.css as reference for the design, and iterate until is similar enough to the design system.

## empreados
Inactivos icon is not visible due contrast issue, fix the color to make it visible, use .superdesign/design_iterations/default_ui_theme.css as reference for color shceme.

# Important
Create comprehesive todo list for the above improvements, with clear steps and expected outcomes for each task. Update and create test per new steps, or confirm current tests are passing. If test are not passing, spawn sub-agent with proper context to fix the issue and update the test accordingly, Iterate 10 times until all tests are passing and improvements are implemented successfully.
shutdown any server backend frontend dev server or bash script after finihing the session and create reports.