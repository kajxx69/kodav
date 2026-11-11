import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { failOnPageErrors } from './helpers';

const PAGES = [
  '/',
  '/services',
  '/services/reseaux-systemes/wifi-professionnel',
  '/contrats-maintenance',
  '/bilan-informatique',
  '/diagnostic',
  '/devis',
  '/rendez-vous',
  '/contact',
  '/faq',
];

test.describe('Pages publiques', () => {
  for (const path of PAGES) {
    test(`${path} : sans erreur ni violation d’accessibilité grave`, async ({ page }) => {
      const check = failOnPageErrors(page);
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const serious = violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      expect(serious).toEqual([]);
      check();
    });
  }

  test('balises SEO, sitemap, robots et manifeste', async ({ page, request }) => {
    await page.goto('/contrats-maintenance');
    await expect(page).toHaveTitle(/Contrats de maintenance/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/contrats-maintenance$/,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-image/);
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/bilan-informatique</loc>');
    expect(sitemap).not.toContain('/admin');
    expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap:');
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  });

  test('« Je suis… » réorganise l’accueil et s’en souvient', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: /^École$/ }).click();
    await expect(page.getByRole('radio', { name: /^École$/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.reload();
    await expect(page.getByRole('radio', { name: /^École$/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('palette Ctrl+K : recherche d’un service au clavier', async ({ page }) => {
    await page.goto('/');
    await page.locator('h1').waitFor();
    await page.keyboard.press('Control+k');
    const input = page.getByRole('combobox');
    await expect(input).toBeFocused();
    await input.fill('wifi pro');
    await expect(page.getByRole('option', { name: /Wi-Fi professionnel/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/services\/reseaux-systemes\/wifi-professionnel$/);
    await expect(page.locator('h1')).toHaveText(/Wi-Fi professionnel/);
  });

  test('comparateur : prix selon le nombre de postes @mobile', async ({ page }) => {
    await page.goto('/contrats-maintenance');
    await page.getByLabel('Nombre de postes', { exact: true }).fill('30');
    await expect(page.getByText('Adaptée à 30 postes', { exact: true })).toBeVisible();
    await page.getByRole('radio', { name: /Annuel/ }).click();
    await expect(page.getByText(/par an/).first()).toBeVisible();
  });
});
