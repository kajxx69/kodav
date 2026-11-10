import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { hashPassword } from '../../lib/crypto.js';
import { testOutbox } from '../../lib/mailer.js';
import { seedDatabase } from '../../seed/seed.js';
import { startTestDatabase, stopTestDatabase, waitUntil } from '../../test/db.js';
import { AuthToken } from '../auth/authToken.model.js';
import { Service } from '../catalog/catalog.model.js';
import { Lead } from '../leads/lead.model.js';
import { Organization } from '../organizations/organization.model.js';
import { Plan } from '../plans/plans.model.js';
import { Quote } from '../quotes/quote.model.js';
import { AuditLog } from '../support/support.model.js';
import { User } from '../users/user.model.js';

const app = createApp();
const auth: Record<string, string> = {};
const ids: Record<string, string> = {};

async function account(
  key: string,
  role: 'client' | 'technicien' | 'admin',
  organization?: unknown,
) {
  const user = await User.create({
    email: `${key}@example.ci`,
    firstName: key,
    lastName: 'Test',
    phone: '+2250707000000',
    role,
    organization: organization ?? null,
    orgRole: organization ? 'owner' : null,
    profile: role === 'client' ? (organization ? 'pme' : 'particulier') : null,
    passwordHash: await hashPassword('motdepasse2026'),
    emailVerifiedAt: new Date(),
  } as never);
  ids[key] = String(user._id);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: `${key}@example.ci`, password: 'motdepasse2026' });
  auth[key] = `Bearer ${res.body.data.accessToken as string}`;
}

beforeAll(async () => {
  await startTestDatabase();
  await seedDatabase();
  const org = await Organization.create({
    name: 'Boutique Awa',
    type: 'pme',
    owner: '0123456789abcdef01234567',
  });
  ids.org = String(org._id);
  await account('admin', 'admin');
  await account('awa', 'client', org._id);
  await account('autre', 'client');
});
afterAll(stopTestDatabase);
beforeEach(() => {
  testOutbox.length = 0;
});

describe('factures', () => {
  let quoteId = '';
  let invoiceId = '';

  it('refuse de facturer un devis non accepté, puis facture avec la TVA des paramètres', async () => {
    const quote = await Quote.create({
      reference: 'DEV-2026-0099',
      client: ids.awa,
      organization: ids.org,
      contact: {
        name: 'Awa Test',
        email: 'awa@example.ci',
        phone: '+2250707000000',
        profile: 'pme',
        company: 'Boutique Awa',
      },
      request: [],
      mode: 'sur_site',
      commune: 'Cocody',
      status: 'envoye',
      estimate: null,
      finalItems: [
        {
          label: 'Câblage',
          description: '',
          quantity: 10,
          unitLabel: 'poste',
          unitPrice: 25000,
          total: 250000,
        },
      ],
      finalTotals: { subtotal: 250000, discount: 10000, travelFee: 5000, total: 245000 },
      submittedAt: new Date(),
    });
    quoteId = String(quote._id);
    await request(app)
      .post(`/api/v1/admin/invoices/from-quote/${quoteId}`)
      .set('Authorization', auth.admin!)
      .send({})
      .expect(409);

    const settings = await request(app)
      .get('/api/v1/admin/settings')
      .set('Authorization', auth.admin!);
    await request(app)
      .put('/api/v1/admin/settings')
      .set('Authorization', auth.admin!)
      .send({
        ...settings.body.data,
        invoice: {
          taxRate: 18,
          legalMentions: 'RCCM : à compléter',
          bankDetails: 'Banque : à compléter',
        },
        emailTemplates: [
          { key: 'invoice_issued', subject: 'Facture {{reference}} pour {{prenom}}', body: '' },
        ],
      })
      .expect(200);

    await Quote.updateOne({ _id: quoteId }, { status: 'accepte' });
    const res = await request(app)
      .post(`/api/v1/admin/invoices/from-quote/${quoteId}`)
      .set('Authorization', auth.admin!)
      .send({ dueDays: 10 });
    expect(res.status).toBe(201);
    invoiceId = res.body.data.id;
    expect(res.body.data).toMatchObject({
      reference: expect.stringMatching(/^FAC-\d{4}-0001$/),
      subtotal: 250000,
      taxRate: 18,
      taxAmount: 44100, // 18 % de 245 000
      total: 289100,
      status: 'impayee',
      billing: { company: 'Boutique Awa' },
    });
    await request(app)
      .post(`/api/v1/admin/invoices/from-quote/${quoteId}`)
      .set('Authorization', auth.admin!)
      .send({})
      .expect(409);

    await waitUntil(() => testOutbox.some((m) => m.to === 'awa@example.ci'));
    const mail = testOutbox.find((m) => m.to === 'awa@example.ci');
    expect(mail?.subject).toBe(`Facture ${res.body.data.reference} pour Awa`);
    expect(mail?.attachments?.[0]?.content.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('enregistre les règlements jusqu’au solde', async () => {
    const base = `/api/v1/admin/invoices/${invoiceId}`;
    const pay = (amount: number) =>
      request(app)
        .post(`${base}/payments`)
        .set('Authorization', auth.admin!)
        .send({ amount, method: 'mobile_money', reference: 'OM-123', paidAt: '2026-11-10' });
    expect((await pay(100000)).body.data).toMatchObject({ status: 'partielle', paid: 100000 });
    expect((await pay(500000)).status).toBe(400);
    expect((await pay(189100)).body.data).toMatchObject({ status: 'payee', paid: 289100 });
    await request(app).post(`${base}/cancel`).set('Authorization', auth.admin!).expect(409);
  });

  it('montre la facture et les documents au client seulement', async () => {
    const mine = await request(app).get('/api/v1/invoices').set('Authorization', auth.awa!);
    expect(mine.body.data).toHaveLength(1);
    const other = await request(app).get('/api/v1/invoices').set('Authorization', auth.autre!);
    expect(other.body.data).toEqual([]);
    await request(app)
      .get(`/api/v1/invoices/${invoiceId}/pdf`)
      .set('Authorization', auth.autre!)
      .expect(404);
    const pdf = await request(app)
      .get(`/api/v1/invoices/${invoiceId}/pdf`)
      .set('Authorization', auth.awa!);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    const docs = await request(app).get('/api/v1/documents').set('Authorization', auth.awa!);
    expect(docs.body.data.map((d: { kind: string }) => d.kind).sort()).toEqual([
      'devis',
      'facture',
    ]);
  });
});

describe('clients, abonnements et délais', () => {
  it('applique le délai de la formule souscrite aux nouveaux tickets', async () => {
    const pro = await Plan.findOne({ slug: 'pro' }).lean();
    const sub = await request(app)
      .put(`/api/v1/admin/clients/organisation/${ids.org}/subscription`)
      .set('Authorization', auth.admin!)
      .send({
        planId: String(pro!._id),
        seats: 12,
        billingCycle: 'annuel',
        startDate: '2026-01-01',
        status: 'active',
      });
    expect(sub.status).toBe(200);
    expect(sub.body.data).toMatchObject({ plan: { name: pro!.name }, seats: 12 });

    const ticket = await request(app).post('/api/v1/tickets').set('Authorization', auth.awa!).send({
      subject: 'Serveur inaccessible',
      category: 'reseau',
      priority: 'haute',
      body: 'Plus d’accès aux partages.',
    });
    expect(ticket.body.data.slaHours).toBe(pro!.sla.haute);
  });

  it('liste les clients et assemble la fiche 360°', async () => {
    const list = await request(app).get('/api/v1/admin/clients').set('Authorization', auth.admin!);
    const awa = list.body.data.items.find((c: { id: string }) => c.id === ids.org);
    expect(awa).toMatchObject({
      kind: 'organisation',
      quoteCount: 1,
      openTickets: 1,
      invoicedTotal: 289100,
      dueTotal: 0,
      subscription: 'Pro',
    });
    expect(list.body.data.items.some((c: { kind: string }) => c.kind === 'particulier')).toBe(true);

    await request(app)
      .patch(`/api/v1/admin/clients/organisation/${ids.org}/notes`)
      .set('Authorization', auth.admin!)
      .send({ notes: 'Client fidèle' })
      .expect(200);
    const card = await request(app)
      .get(`/api/v1/admin/clients/organisation/${ids.org}`)
      .set('Authorization', auth.admin!);
    expect(card.body.data).toMatchObject({
      notes: 'Client fidèle',
      subscription360: { seats: 12 },
    });
    expect(card.body.data.contacts.map((c: { email: string }) => c.email)).toEqual([
      'awa@example.ci',
    ]);
    expect(card.body.data.invoices).toHaveLength(1);
    expect(card.body.data.tickets).toHaveLength(1);
    await request(app)
      .get(`/api/v1/admin/clients/organisation/${ids.org}`)
      .set('Authorization', auth.awa!)
      .expect(403);
  });
});

describe('prospects, équipe et audit', () => {
  it('qualifie un prospect', async () => {
    const lead = await Lead.create({
      source: 'contact',
      name: 'Kouadio',
      email: 'k@example.ci',
      phone: '+2250101010101',
      message: 'Bonjour',
      consentAt: new Date(),
    });
    const list = await request(app)
      .get('/api/v1/admin/leads?status=nouveau')
      .set('Authorization', auth.admin!);
    expect(list.body.data.items.map((l: { id: string }) => l.id)).toContain(String(lead._id));
    await request(app)
      .patch(`/api/v1/admin/leads/${String(lead._id)}`)
      .set('Authorization', auth.admin!)
      .send({ status: 'contacte', assignee: ids.admin, notes: 'Rappel jeudi' })
      .expect(200);
    expect((await Lead.findById(lead._id).lean())?.status).toBe('contacte');
  });

  it('crée un technicien qui choisit son mot de passe, et protège les droits de l’admin', async () => {
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', auth.admin!)
      .send({
        firstName: 'Yao',
        lastName: 'Konan',
        email: 'yao@example.ci',
        phone: '0707070707',
        role: 'technicien',
      });
    expect(res.status).toBe(201);
    expect(testOutbox[0]?.text).toContain('/reinitialiser-mot-de-passe?token=');
    expect(await AuthToken.countDocuments({ user: res.body.data.id, type: 'password_reset' })).toBe(
      1,
    );

    await request(app)
      .patch(`/api/v1/admin/users/${ids.admin}`)
      .set('Authorization', auth.admin!)
      .send({ isActive: false })
      .expect(409);
    await request(app)
      .patch(`/api/v1/admin/users/${res.body.data.id}`)
      .set('Authorization', auth.admin!)
      .send({ isActive: false })
      .expect(200);
    expect((await User.findById(res.body.data.id).lean())?.isActive).toBe(false);
  });

  it('journalise les actions et les montre à l’admin', async () => {
    expect(await AuditLog.countDocuments({ action: 'invoice.create' })).toBe(1);
    const logs = await request(app)
      .get('/api/v1/admin/audit-logs?entity=Invoice')
      .set('Authorization', auth.admin!);
    expect(logs.body.data.items.map((l: { action: string }) => l.action)).toEqual(
      expect.arrayContaining(['invoice.create', 'invoice.payment']),
    );
    expect(logs.body.data.items[0].actor.name).toBe('admin Test');
  });

  it('exporte en CSV lisible par Excel, sans injection de formule', async () => {
    await Lead.create({
      source: 'contact',
      name: '=HYPERLINK("http://x")',
      email: 'x@example.ci',
      phone: '+2250101010102',
      message: 'x',
      consentAt: new Date(),
    });
    const res = await request(app)
      .get('/api/v1/admin/export/prospects.csv')
      .set('Authorization', auth.admin!);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    expect(res.text).toContain('Date;Source;Statut;Nom');
    expect(res.text).toContain(`"'=HYPERLINK(""http://x"")"`);
    await request(app)
      .get('/api/v1/admin/export/inconnu.csv')
      .set('Authorization', auth.admin!)
      .expect(404);
  });

  it('calcule les indicateurs du tableau de bord', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard?period=30')
      .set('Authorization', auth.admin!);
    expect(res.body.data.kpis).toMatchObject({
      invoiced: 289100,
      collected: 289100,
      outstanding: 0,
      newLeads: 1,
    });
    expect(res.body.data.kpis.openTickets.haute).toBe(1);
    expect(res.body.data.series.length).toBeGreaterThanOrEqual(30);
    const year = await request(app)
      .get('/api/v1/admin/dashboard?period=365')
      .set('Authorization', auth.admin!);
    expect(year.body.data.series.length).toBeLessThanOrEqual(13);
  });
});

describe('contenu et catalogue', () => {
  it('publie un avis client seulement après validation', async () => {
    await request(app)
      .post('/api/v1/content/testimonials')
      .set('Authorization', auth.awa!)
      .send({ content: 'Intervention rapide et soignée, je recommande.', rating: 5, consent: true })
      .expect(201);
    expect((await request(app).get('/api/v1/content/testimonials')).body.data).toEqual([]);
    const list = await request(app)
      .get('/api/v1/admin/content/testimonials')
      .set('Authorization', auth.admin!);
    const t = list.body.data[0];
    expect(t).toMatchObject({ status: 'en_attente', fromClient: true, authorName: 'awa T.' });
    await request(app)
      .put(`/api/v1/admin/content/testimonials/${t.id}`)
      .set('Authorization', auth.admin!)
      .send({ ...t, status: 'publie' })
      .expect(200);
    expect((await request(app).get('/api/v1/content/testimonials')).body.data).toHaveLength(1);
  });

  it('crée une réalisation publiée et refuse une adresse en double', async () => {
    const body = {
      slug: 'reseau-ecole',
      title: 'Réseau d’une école',
      status: 'publie',
      summary: 'Câblage de 3 salles',
    };
    await request(app)
      .post('/api/v1/admin/content/projects')
      .set('Authorization', auth.admin!)
      .send(body)
      .expect(201);
    await request(app)
      .post('/api/v1/admin/content/projects')
      .set('Authorization', auth.admin!)
      .send(body)
      .expect(409);
    const pub = await request(app).get('/api/v1/content/projects');
    expect(pub.body.data[0]).toMatchObject({
      slug: 'reseau-ecole',
      publishedAt: expect.any(String),
    });
  });

  it('crée un service avec options et l’estime aussitôt', async () => {
    const pole = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', auth.admin!)
      .send({ slug: 'formation', name: 'Formation', icon: 'graduation-cap' });
    expect(pole.status).toBe(201);
    const service = await request(app)
      .post('/api/v1/admin/services')
      .set('Authorization', auth.admin!)
      .send({
        categoryId: pole.body.data.id,
        slug: 'excel-avance',
        name: 'Excel avancé',
        targetProfiles: ['pme'],
        estimatedDuration: { min: 1, max: 2, unit: 'jour' },
        pricingMode: 'par_unite',
        unitLabel: 'participant',
        priceMin: 30000,
        priceMax: 40000,
        modes: ['sur_site'],
        options: [
          {
            key: 'support',
            label: 'Support imprimé',
            type: 'boolean',
            impact: { kind: 'fixed', min: 2000, max: 3000 },
            perUnit: true,
          },
        ],
      });
    expect(service.status).toBe(201);
    const est = await request(app)
      .post('/api/v1/pricing/estimate')
      .send({
        items: [{ serviceId: service.body.data.id, quantity: 4, options: { support: true } }],
        mode: 'distance',
      });
    expect(est.body.data.total).toEqual({ min: 128000, max: 172000 });

    const bad = await request(app)
      .put(`/api/v1/admin/services/${service.body.data.id}`)
      .set('Authorization', auth.admin!)
      .send({
        ...service.body.data,
        categoryId: pole.body.data.id,
        options: [{ key: 'x', label: 'X', type: 'select' }],
      });
    expect(bad.status).toBe(400);
  });

  it('met à jour les règles tarifaires (niveau standard obligatoire)', async () => {
    const rules = {
      urgency: [{ key: '24h', label: '24 h', percent: 50 }],
      travel: [],
      volumeDiscount: [],
    };
    await request(app)
      .put('/api/v1/admin/pricing-rules')
      .set('Authorization', auth.admin!)
      .send(rules)
      .expect(400);
    const ok = await request(app)
      .put('/api/v1/admin/pricing-rules')
      .set('Authorization', auth.admin!)
      .send({
        ...rules,
        urgency: [{ key: 'standard', label: 'Standard', percent: 0 }, ...rules.urgency],
        travel: [{ commune: 'Plateau', fee: 6000 }],
      });
    expect(ok.body.data.travel).toEqual([{ commune: 'Plateau', fee: 6000, isAbidjan: true }]);
    expect(await Service.countDocuments({ isPlaceholderPrice: false })).toBeGreaterThan(0);
  });
});
