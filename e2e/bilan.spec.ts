import { ASSESSMENT_QUESTIONS } from '@kodav/shared';
import { expect, test } from '@playwright/test';
import { failOnPageErrors, uniqueEmail } from './helpers';

test('bilan de santé : score, points urgents et rapport par email @mobile', async ({ page }) => {
  const check = failOnPageErrors(page);
  await page.goto('/bilan-informatique');
  await page.getByRole('radio', { name: 'PME' }).click({ force: true });
  await page.getByRole('radio', { name: '6 à 20 postes' }).click({ force: true });
  await page.getByRole('button', { name: 'Commencer le bilan' }).click();

  // Meilleure réponse partout, sauf les sauvegardes : jamais.
  for (const [i, q] of ASSESSMENT_QUESTIONS.entries()) {
    await expect(page.getByText(`Question ${i + 1} sur 12`)).toBeVisible();
    await expect(page.getByRole('heading', { name: q.label })).toBeVisible();
    const option = q.key === 'backup' ? q.options.at(-1)! : q.options[0]!;
    await page.getByRole('radio', { name: option.label, exact: true }).click({ force: true });
  }

  await expect(page.getByRole('img', { name: 'Score 90 sur 100, Bon niveau' })).toBeVisible();
  await expect(page.getByText('1. Sauvegardes')).toBeVisible();

  await page.getByLabel(/Nom et prénom/).fill('Test Bilan');
  await page.getByLabel(/^Email/).fill(uniqueEmail('bilan'));
  await page.getByLabel(/Téléphone/).fill('0707000005');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Recevoir mon rapport' }).click();
  await expect(page.getByText('Rapport envoyé')).toBeVisible();
  check();
});
