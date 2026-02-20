import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for backend API testing
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  
  // Maximum time one test can run
  timeout: 30 * 1000,
  
  // Test execution settings — use 1 worker so auth sessions don't conflict across spec files
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  
  // Global test configuration
  use: {
    // Base URL for API testing
    baseURL: process.env.TEST_API_URL || 'http://localhost:3001',
    
    // API testing context options
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    
    // Timeout for each action
    actionTimeout: 10 * 1000,
    
    // Collect trace on failure
    trace: 'on-first-retry',
  },

  // Web server configuration (optional - if you want Playwright to start the server)
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3001',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
});
