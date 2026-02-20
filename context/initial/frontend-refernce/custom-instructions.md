# GitHub Copilot Custom Instructions for Mi Empresa App Front

## Project Overview

"Mi Empresa App" is an enterprise solution focused on personnel management, payroll, absence tracking, vacations, and financial budget management with cost centers. The application is designed to meet legal and labor obligations in the Colombian context, facilitating efficient and organized administration of companies with legally contracted personnel.

## Technology Stack

- **Framework**: Nuxt v4 (with compatibilityVersion: 4)
- **UI Component Library**: PrimeVue v4
use: https://primevue.org/llms/llms-full.txt as reference for PrimeVue components and usage
- **CSS Framework**: Tailwind CSS v4 with tailwindcss-primeui plugin
- **State Management**: Pinia with @pinia/nuxt
- **Theme Configuration**:
  - Theme: material
  - Primary color: violet
  - Surface color: slate

## Code Style and Standards

- Use TypeScript for type safety
- Follow Vue 3 Composition API with `<script setup>` syntax
- Implement modular architecture with domain-driven design principles
- Ensure responsive design (mobile-first approach)
- Follow accessibility standards (WCAG)
- Use i18n for internationalization support (es/en)

## Project Structure Guidelines

- Organize components using atomic design principles
- Implement feature-based folder structure
- Separate business logic from UI components using composables
- Use Pinia stores for global state management
- Implement server routes for API endpoints
- Use middleware for authentication and route protection

## Authentication and Authorization

- Implement JWT-based authentication
- Use RBAC (Role-Based Access Control) with the following roles:
  - Admin
  - Employee
  - Auditor
  - Operator

## Styling Conventions

- Use Tailwind utility classes as primary styling method
- Create custom utility classes only when necessary
- Apply PrimeVue theming system with material design
- Ensure consistent color schemes using tailwind config extensions

## Form Handling

- Use FormKit or similar form library for complex forms
- Implement proper validation for all forms based on Colombian legal requirements
- Ensure all inputs have proper error handling and user feedback

## Data Fetching

- Use Nuxt's built-in data fetching capabilities
- Implement proper loading states and error handling
- Create reusable composables for common data operations

## Performance Considerations

- Implement component lazy loading
- Use proper image optimization
- Follow Nuxt best practices for SEO and performance
- Implement proper caching strategies

## Testing

- Write unit tests for critical business logic
- Implement component testing for UI components
- Ensure proper test coverage for all features

## Deployment

- Configure for AWS deployment
- Set up proper environment variables
- Implement CI/CD with GitHub Actions
