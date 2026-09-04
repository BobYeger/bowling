import { defineConfig } from '@playwright/test';

// Headless balance checks: each spec loads a game page with `?sim` (which stops the
// animation loop), then drives window.__<game>.step(dt) by hand. Uses the installed
// Google Chrome so no browser download is needed.
export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  retries: 0,
  reporter: 'list',
  use: {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1000, height: 700 },
    baseURL: 'http://localhost:5199',
  },
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
