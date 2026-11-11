import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

const API_PORT = 4100;
const WEB_PORT = 5180;
// Mot de passe des comptes de test, propre à chaque exécution (base en mémoire).
process.env.E2E_PASSWORD ??= `Kodav-${randomBytes(9).toString('base64url')}-9a`;

/**
 * Parcours clés dans un vrai navigateur, contre une API isolée (MongoDB en mémoire).
 * Le front doit être construit avant : `npm run test:e2e` s'en charge.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'fr-FR',
    timezoneId: 'Africa/Abidjan',
    trace: 'retain-on-failure',
    // Chrome installé sur le poste (PW_CHANNEL=chrome) ou Chromium de Playwright.
    channel: process.env.PW_CHANNEL || undefined,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: 'npx tsx src/test/e2e-server.ts',
      cwd: 'server',
      url: `http://localhost:${API_PORT}/api/v1/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { E2E_API_PORT: String(API_PORT), E2E_WEB_PORT: String(WEB_PORT) },
    },
    {
      command: 'node e2e/serve.mjs',
      url: `http://localhost:${WEB_PORT}/`,
      reuseExistingServer: false,
      env: { E2E_WEB_PORT: String(WEB_PORT) },
    },
  ],
});
