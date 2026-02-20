# Backend Improvements

## ts setup
`npm i --save-dev @types/node` some lint errors are shown in basic types like process.

## Empresa entity implementation
On the db scheme "empresa" or company should be an entity which is linked to all other entities, so platform could be multitenant and each company could have its own data, users, etc. Follow these steps:
- analyze current db scheme and context/initial/schema-v2.md reference
- propose new schema with proper relationships and fields for "empresa" entity

## Fix on create empleado
Revisit create empleado test, confirm create empleado endpoint is working properly.
- create test for create empleado endpoint with all fields.
    - dev detected an issue when adding experience, language, education and Vehiculo.
    - fix the issue and make sure test is passing and entity is created on DB with all the correct relationships and fields.

# Frontend improvements

## Add empresa state
Add empresa logic to frontend, no great changes are expected, since backend and session will handle all logic related to empresa relationships and data isolation, confirm and add basic empresa data and forms to frontend, following .superdesign/DESIGN_GUIDELINES.md.

## Confirm fix on empleados backend is working on frontend
After fixing the create empleado endpoint, confirm that the frontend is able to create empleados with playwright test:
- check if there is already a create empleado test, if not create one, with only required fields.
- create a playwright test for create empleado endpoint, with all fields, including experience, language, education and vehiculo.
    - make sure test is passing and empleado is created with all the correct relationships and fields by checking DB.

## nuxt migration
- upgrade to nuxt 4, follow the plan in context/nuxt-v4-upgrade/plan.md
- confirm all tests are passing after upgrade, fix any issues that arise.

Create comprehesive todo list for the above improvements, with clear steps and expected outcomes for each task. Update and create test per new steps, or confirm current tests are passing. If test are not passing, spawn sub-agent with proper context to fix the issue and update the test accordingly, Iterate 10 times until all tests are passing and improvements are implemented successfully.
