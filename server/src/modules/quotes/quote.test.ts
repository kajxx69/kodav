import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { hashPassword } from '../../lib/crypto.js';
import { testOutbox } from '../../lib/mailer.js';
import { seedDatabase } from '../../seed/seed.js';
import { startTestDatabase, stopTestDatabase } from '../../test/db.js';
import { Service } from '../catalog/catalog.model.js';
import { Lead } from '../leads/lead.model.js';
import { User } from '../users/user.model.js';
import { Quote } from './quote.model.js';
import { expireQuotes } from './quote.service.js';

const app = createApp();
const ids: Record<string, string> = {};

const contact = {
  name: 'Awa Koné',
  email: 'awa@example.ci',
  phone: '0707123456',
  profile: 'pme',
  company: 'Boutique Awa',
};

async function token(email: string, role: 'client' | 'admin') {
  await User.create({
    email,
    firstName: 'Test',
    lastName: role,
    role,
    passwordHash: await hashPassword('motdepasse2026'),
    emailVerifiedAt: new Date(),
  });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'motdepasse2026' });
  return `Bearer ${res.body.data.accessToken as string}`;
}

function linkToken() {
  const mail = testOutbox.findLast((m) => m.text.includes('/devis/reponse?token='));
  return mail?.text.match(/token=([\w-]+)/)?.[1];
}

let admin: string;
let client: string;

beforeAll(async () => {
  await startTestDatabase();
  await seedDatabase();
  for (const s of await Service.find({}, { slug: 1 }).lean()) ids[s.slug] = String(s._id);
  admin = await token('admin@example.ci', 'admin');
  client = await token('client@example.ci', 'client');
});
afterAll(stopTestDatabase);
beforeEach(() => {
  testOutbox.length = 0;
});

const request1 = () => ({
  items: [
    { serviceId: ids['installation-reseau-cablage'], quantity: 12, options: { baie: true } },
    { serviceId: ids['application-web-mobile'], quantity: 1 },
  ],
  urgency: '48h',
  mode: 'sur_site',
  commune: 'Cocody',
});

describe('estimation et diagnostic', () => {
  it('calcule une fourchette côté serveur', async () => {
    const res = await request(app).post('/api/v1/pricing/estimate').send(request1());
    expect(res.status).toBe(200);
    const e = res.body.data;
    expect(e.lines).toHaveLength(2);
    expect(e.lines[1].onQuote).toBe(true);
    expect(e.volumeDiscount.min).toBeGreaterThan(0);
    expect(e.urgency).toMatchObject({ key: '48h', percent: 25 });
    expect(e.travel).toMatchObject({ status: 'included', fee: 5000 });
    expect(e.isPlaceholderPrice).toBe(true);
    expect(e.total.min).toBeLessThanOrEqual(e.total.max);
  });

  it('refuse un service inconnu ou désactivé', async () => {
    const res = await request(app)
      .post('/api/v1/pricing/estimate')
      .send({ items: [{ serviceId: '0123456789abcdef01234567' }] });
    expect(res.status).toBe(400);
  });

  it('recommande des services adaptés au profil et au besoin', async () => {
    const res = await request(app).post('/api/v1/diagnostic/recommend').send({
      profile: 'ecole',
      need: 'salle_info',
      urgency: 'rapide',
      mode: 'sur_site',
      commune: 'Yopougon',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.recommendations[0].serviceId).toBe(ids['salle-informatique']);
    expect(res.body.data.recommendations.length).toBeLessThanOrEqual(3);
    expect(res.body.data.prefill).toMatchObject({
      urgency: '48h',
      mode: 'sur_site',
      commune: 'Yopougon',
    });
  });
});

describe('demande de devis', () => {
  it('enregistre la demande d’un visiteur, crée un prospect et envoie les emails', async () => {
    const res = await request(app)
      .post('/api/v1/quotes')
      .send({ ...request1(), contact, consent: true, clientNotes: 'Bureaux au 2e étage' });
    expect(res.status).toBe(201);
    const q = res.body.data;
    expect(q.reference).toMatch(/^DEV-\d{4}-0001$/);
    expect(q.status).toBe('soumis');
    expect(q.hasAccount).toBe(false);
    expect(q.contact.phone).toBe('+2250707123456');
    expect(await Lead.countDocuments({ source: 'devis_visiteur' })).toBe(1);

    // Les emails partent en arrière-plan.
    await new Promise((r) => setTimeout(r, 300));
    const confirmation = testOutbox.find((m) => m.to === 'awa@example.ci');
    expect(confirmation?.attachments?.[0]?.filename).toBe(`${q.reference}.pdf`);
    expect(confirmation?.attachments?.[0]?.content.subarray(0, 4).toString()).toBe('%PDF');
    expect(testOutbox.some((m) => m.subject.includes('Nouvelle demande'))).toBe(true);
  });

  it('exige la commune pour une intervention sur site et le consentement', async () => {
    const res = await request(app)
      .post('/api/v1/quotes')
      .send({ ...request1(), commune: undefined, contact });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['commune', 'consent']));
  });

  it('rattache la demande au client connecté et efface son brouillon', async () => {
    await request(app)
      .put('/api/v1/quotes/draft')
      .set('Authorization', client)
      .send({ step: 2, items: [{ serviceId: ids['depannage'] }] })
      .expect(200);
    const draft = await request(app).get('/api/v1/quotes/draft').set('Authorization', client);
    expect(draft.body.data).toMatchObject({ step: 2 });

    const res = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', client)
      .send({
        items: [{ serviceId: ids['depannage'] }],
        mode: 'atelier',
        contact: { ...contact, email: 'client@example.ci' },
        consent: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.hasAccount).toBe(true);
    expect(await Quote.countDocuments({ status: 'brouillon' })).toBe(0);

    const list = await request(app).get('/api/v1/quotes').set('Authorization', client);
    expect(list.body.data.items.map((q: { reference: string }) => q.reference)).toEqual([
      res.body.data.reference,
    ]);
  });

  it('cache les devis des autres clients', async () => {
    const visitorQuote = await Quote.findOne({ 'contact.email': 'awa@example.ci' }).lean();
    await request(app)
      .get(`/api/v1/quotes/${String(visitorQuote!._id)}`)
      .set('Authorization', client)
      .expect(404);
    await request(app).get('/api/v1/quotes').expect(401);
    await request(app).get('/api/v1/admin/quotes').set('Authorization', client).expect(403);
  });
});

describe('traitement par l’admin et réponse du client', () => {
  it('ajuste, envoie puis le client accepte via le lien reçu', async () => {
    const quote = await Quote.findOne({ 'contact.email': 'awa@example.ci' }).lean();
    const id = String(quote!._id);

    const list = await request(app)
      .get('/api/v1/admin/quotes?q=boutique')
      .set('Authorization', admin);
    expect(list.body.data.items.map((q: { id: string }) => q.id)).toContain(id);

    await request(app)
      .post(`/api/v1/admin/quotes/${id}/send`)
      .set('Authorization', admin)
      .send({})
      .expect(400);

    const patched = await request(app)
      .patch(`/api/v1/admin/quotes/${id}`)
      .set('Authorization', admin)
      .send({
        finalItems: [
          { label: 'Câblage', quantity: 12, unitLabel: 'poste', unitPrice: 25000 },
          { label: 'Baie de brassage', quantity: 1, unitPrice: 200000 },
        ],
        discount: 20000,
        travelFee: 5000,
        adminNotes: 'Visite faite',
      });
    expect(patched.status).toBe(200);
    expect(patched.body.data.status).toBe('en_revue');
    expect(patched.body.data.finalTotals).toEqual({
      subtotal: 500000,
      discount: 20000,
      travelFee: 5000,
      total: 485000,
    });

    const sent = await request(app)
      .post(`/api/v1/admin/quotes/${id}/send`)
      .set('Authorization', admin)
      .send({ validityDays: 15 });
    expect(sent.status).toBe(200);
    expect(sent.body.data.status).toBe('envoye');
    const action = linkToken();
    expect(action).toBeDefined();
    expect(testOutbox.at(-1)?.attachments?.[0]?.filename).toMatch(/\.pdf$/);

    const view = await request(app).get(`/api/v1/quotes/action/${action}`);
    expect(view.body.data.finalTotals.total).toBe(485000);

    const accepted = await request(app)
      .post(`/api/v1/quotes/action/${action}`)
      .send({ decision: 'accept' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.status).toBe('accepte');
    expect(accepted.body.data.statusHistory.map((h: { status: string }) => h.status)).toEqual([
      'soumis',
      'en_revue',
      'envoye',
      'accepte',
    ]);

    // Lien à usage unique ; devis clos.
    await request(app)
      .post(`/api/v1/quotes/action/${action}`)
      .send({ decision: 'decline' })
      .expect(400);
    await request(app)
      .patch(`/api/v1/admin/quotes/${id}`)
      .set('Authorization', admin)
      .send({ finalItems: [] })
      .expect(409);

    const pdf = await request(app)
      .get(`/api/v1/admin/quotes/${id}/pdf`)
      .set('Authorization', admin);
    expect(pdf.headers['content-type']).toBe('application/pdf');
  });

  it('rattache les demandes d’un visiteur quand il confirme son email', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      firstName: 'Awa',
      lastName: 'Koné',
      email: 'awa@example.ci',
      phone: '0707123456',
      password: 'motdepasse2026',
      profile: 'particulier',
      consent: true,
    });
    const verify = testOutbox.findLast((m) => m.text.includes('verifier-email'));
    const verifyToken = verify?.text.match(/token=([\w-]+)/)?.[1];
    await request(app).post('/api/v1/auth/verify-email').send({ token: verifyToken }).expect(200);

    const list = await request(app)
      .get('/api/v1/quotes')
      .set('Authorization', `Bearer ${res.body.data.accessToken as string}`);
    expect(list.body.data.total).toBe(1);
    expect(list.body.data.items[0].status).toBe('accepte');
  });

  it('expire un devis envoyé dont la validité est dépassée et refuse alors la réponse', async () => {
    const quote = await Quote.findOne({ 'contact.email': 'client@example.ci' });
    const id = String(quote!._id);
    await request(app)
      .patch(`/api/v1/admin/quotes/${id}`)
      .set('Authorization', admin)
      .send({ finalItems: [{ label: 'Dépannage', quantity: 1, unitPrice: 25000 }] })
      .expect(200);
    await request(app)
      .post(`/api/v1/admin/quotes/${id}/send`)
      .set('Authorization', admin)
      .send({})
      .expect(200);

    await Quote.updateOne({ _id: id }, { validUntil: new Date(Date.now() - 1000) });
    const late = await request(app)
      .post(`/api/v1/quotes/${id}/decision`)
      .set('Authorization', client)
      .send({ decision: 'accept' });
    expect(late.status).toBe(409);
    expect((await Quote.findById(id).lean())?.status).toBe('expire');
    expect(await expireQuotes()).toBe(0);
  });
});
