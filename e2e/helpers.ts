import { expect, type Page } from '@playwright/test';

export const PASSWORD = process.env.E2E_PASSWORD!;
export const ACCOUNTS = {
  admin: 'admin@kodav.test',
  technician: 'technicien@kodav.test',
  client: 'client.pme@kodav.test',
} as const;

/** Adresse unique par exécution, dans le domaine réservé aux tests. */
export const uniqueEmail = (prefix: string) => `e2e.${prefix}.${Date.now()}@kodav.test`;

export async function login(page: Page, email: string) {
  await page.goto('/connexion');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

/** Fait échouer le test sur toute erreur JavaScript de la page. */
export function failOnPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return () => expect(errors, 'erreurs JavaScript dans la page').toEqual([]);
}
