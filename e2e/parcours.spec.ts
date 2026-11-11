import { expect, test } from '@playwright/test';
import { ACCOUNTS, failOnPageErrors, login, uniqueEmail } from './helpers';

test('demande de devis visiteur, puis traitement par l’admin', async ({ page, browser }) => {
  const check = failOnPageErrors(page);
  await page.goto('/diagnostic');
  await page.getByRole('radio', { name: /PME et commerces/ }).click({ force: true });
  await page
    .getByRole('radio', { name: 'Installer ou refaire le réseau de nos locaux' })
    .click({ force: true });
  await page.getByRole('radio', { name: /Dans les prochains jours/ }).click({ force: true });
  await page.getByRole('radio', { name: /Sur place/ }).click({ force: true });
  await page.getByLabel('Commune').selectOption('Cocody');
  await page.getByRole('button', { name: 'Voir les recommandations' }).click();
  await page.getByRole('link', { name: 'Obtenir mon devis' }).click();

  await expect(page.getByRole('heading', { name: '2. Détails' })).toBeVisible();
  await page.getByLabel(/Nombre de postes/).fill('12');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel(/Nom et prénom/).fill('Test Devis');
  await page.getByLabel(/Téléphone/).fill('0707000002');
  await page.getByLabel(/^Email/).fill(uniqueEmail('devis'));
  await page.getByRole('checkbox', { name: /J’accepte/ }).check();
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await expect(page.getByText('Demande envoyée')).toBeVisible();
  const reference = (await page.locator('strong').filter({ hasText: /^DEV-/ }).innerText()).trim();
  check();

  const admin = await (await browser.newContext()).newPage();
  await login(admin, ACCOUNTS.admin);
  await expect(admin).toHaveURL(/\/admin$/);
  await expect(admin.getByText('Devis à traiter')).toBeVisible();
  await admin.goto('/admin/devis');
  await admin.getByRole('link', { name: reference }).click();
  await expect(admin.getByRole('heading', { name: `Devis ${reference}` })).toBeVisible();
});

test('réservation d’une intervention et suivi public', async ({ page }) => {
  const check = failOnPageErrors(page);
  await page.goto('/rendez-vous?service=maintenance-support/depannage');
  await page.getByLabel(/Décrivez votre besoin/).fill('Ordinateur portable qui ne démarre plus.');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByRole('heading', { name: '2. Créneau' })).toBeVisible();
  await page
    .getByRole('button', { name: /^\d\d:\d\d$/, disabled: false })
    .first()
    .click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel(/Nom et prénom/).fill('Test Rendez-vous');
  await page.getByLabel(/Téléphone/).fill('0707000004');
  await page.getByLabel(/^Email/).fill(uniqueEmail('rdv'));
  await page.getByLabel(/Commune/).selectOption('Marcory');
  await page.getByLabel(/Point de repère/).fill('Derrière la station');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Confirmer le rendez-vous' }).click();
  await page.getByRole('link', { name: 'Suivre l’intervention' }).click();
  await page.getByLabel('Téléphone ou email').fill('07 07 00 00 04');
  await page.getByRole('button', { name: 'Suivre' }).click();
  await expect(page.getByText(/INT-\d{4}-\d{4}/).first()).toBeVisible();
  check();
});

test('chaque rôle arrive dans son espace', async ({ browser }) => {
  for (const [email, url, heading] of [
    [ACCOUNTS.client, /\/espace-client$/, /Bonjour/],
    [ACCOUNTS.technician, /\/technicien$/, /Bonjour/],
  ] as const) {
    const page = await (await browser.newContext()).newPage();
    const check = failOnPageErrors(page);
    await login(page, email);
    await expect(page).toHaveURL(url);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    check();
  }
});

test('un visiteur ne peut pas ouvrir le back-office', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/connexion/);
});
