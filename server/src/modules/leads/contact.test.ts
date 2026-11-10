import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { startTestDatabase, stopTestDatabase } from '../../test/db.js';
import { Lead } from './lead.model.js';

const app = createApp();

const valid = {
  name: 'Awa Koné',
  email: 'Awa@Example.ci',
  phone: '07 07 12 34 56',
  subject: 'Installation Wi-Fi',
  message: 'Bonjour, nous souhaitons équiper nos bureaux.',
  consent: true,
};

beforeAll(startTestDatabase);
afterAll(stopTestDatabase);

describe('POST /api/v1/contact', () => {
  it('enregistre un prospect avec des données normalisées', async () => {
    const res = await request(app).post('/api/v1/contact').send(valid);
    expect(res.status).toBe(201);
    const lead = await Lead.findOne().lean();
    expect(lead).toMatchObject({
      source: 'contact',
      email: 'awa@example.ci',
      phone: '+2250707123456',
      status: 'nouveau',
    });
  });

  it('refuse un formulaire sans consentement ou avec un téléphone invalide', async () => {
    const res = await request(app)
      .post('/api/v1/contact')
      .send({ ...valid, consent: false, phone: '123' });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['consent', 'phone']));
  });

  it('ignore silencieusement un robot qui remplit le pot de miel', async () => {
    const before = await Lead.countDocuments();
    const res = await request(app)
      .post('/api/v1/contact')
      .send({ ...valid, website: 'http://spam.example' });
    expect(res.status).toBe(201);
    expect(await Lead.countDocuments()).toBe(before);
  });

  it('neutralise les opérateurs MongoDB injectés', async () => {
    const res = await request(app)
      .post('/api/v1/contact')
      .send({ ...valid, email: { $gt: '' } });
    expect(res.status).toBe(400);
  });
});
