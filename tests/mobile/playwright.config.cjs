const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '**/iphone.spec.cjs',
  fullyParallel: false,
  timeout: 45000,
  expect: { timeout: 14000 },
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['iPhone 13'],
    browserName: 'webkit',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15000,
  },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
