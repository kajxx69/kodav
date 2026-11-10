import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  categoryWithServicesSchema,
  maintenancePlanSchema,
  publicSettingsSchema,
  serviceSchema,
} from '@kodav/shared';
import { seedCategories, seedServices } from '@kodav/shared/seed';
import { createApp } from '../../app.js';
import { seedDatabase } from '../../seed/seed.js';
import { startTestDatabase, stopTestDatabase } from '../../test/db.js';
import { ServiceCategory, Service } from './catalog.model.js';

const app = createApp();

beforeAll(startTestDatabase);
afterAll(stopTestDatabase);

describe('paramètres publics', () => {
  it('renvoie les valeurs par défaut avant le seed', async () => {
    const res = await request(app).get('/api/v1/settings/public');
    expect(res.status).toBe(200);
    const data = publicSettingsSchema.parse(res.body.data);
    expect(data.brand.legalName).toBe('KODAV Technologies');
    expect(data.stats).toEqual([]);
  });
});

describe('catalogue public', () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  it('le seed est idempotent', async () => {
    const counts = await seedDatabase();
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
    expect(await Service.countDocuments()).toBe(seedServices.length);
  });

  it('liste les 4 pôles avec leurs services', async () => {
    const res = await request(app).get('/api/v1/catalog/categories');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('public');
    const categories = categoryWithServicesSchema.array().parse(res.body.data);
    expect(categories.map((c) => c.slug)).toEqual(seedCategories.map((c) => c.slug));
    for (const category of categories) {
      expect(category.services.length).toBeGreaterThanOrEqual(5);
      expect(category.services.length).toBeLessThanOrEqual(7);
    }
  });

  it('marque les prix du seed comme exemples et masque ceux des services sur devis', async () => {
    const res = await request(app).get('/api/v1/catalog/services');
    const services = serviceSchema.array().parse(res.body.data);
    for (const s of services) {
      if (s.pricingMode === 'sur_devis') expect(s.priceMin).toBeUndefined();
      else expect(s.isPlaceholderPrice).toBe(true);
    }
  });

  it('filtre par profil et par mise en avant', async () => {
    const res = await request(app).get('/api/v1/catalog/services?profile=ecole&featured=true');
    const services = serviceSchema.array().parse(res.body.data);
    expect(services.length).toBeGreaterThan(0);
    expect(services.every((s) => s.featured && s.targetProfiles.includes('ecole'))).toBe(true);
  });

  it('rejette un filtre invalide', async () => {
    const res = await request(app).get('/api/v1/catalog/services?profile=pirate');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('renvoie un service par pôle et slug, et 404 sinon', async () => {
    const ok = await request(app).get('/api/v1/catalog/services/developpement/site-vitrine');
    expect(ok.status).toBe(200);
    expect(serviceSchema.parse(ok.body.data).category.slug).toBe('developpement');

    const wrongPole = await request(app).get('/api/v1/catalog/services/logiciels/site-vitrine');
    expect(wrongPole.status).toBe(404);
  });

  it('masque un pôle désactivé et ses services', async () => {
    await ServiceCategory.updateOne({ slug: 'logiciels' }, { isActive: false });
    const res = await request(app).get('/api/v1/catalog/categories/logiciels');
    expect(res.status).toBe(404);
    const all = await request(app).get('/api/v1/catalog/services');
    expect(
      all.body.data.some((s: { category: { slug: string } }) => s.category.slug === 'logiciels'),
    ).toBe(false);
    await ServiceCategory.updateOne({ slug: 'logiciels' }, { isActive: true });
  });

  it('expose les formules de maintenance', async () => {
    const res = await request(app).get('/api/v1/plans');
    const plans = maintenancePlanSchema.array().parse(res.body.data);
    expect(plans.map((p) => p.slug)).toEqual(['essentiel', 'pro', 'etablissement']);
    expect(plans.every((p) => p.isPlaceholderPrice)).toBe(true);
  });

  it('expose la FAQ, et aucun témoignage ni réalisation fictifs', async () => {
    const faqs = await request(app).get('/api/v1/content/faqs');
    expect(faqs.body.data.length).toBeGreaterThan(0);
    const testimonials = await request(app).get('/api/v1/content/testimonials');
    expect(testimonials.body.data).toEqual([]);
    const projects = await request(app).get('/api/v1/content/projects');
    expect(projects.body.data).toEqual([]);
  });
});
