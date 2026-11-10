import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connect } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { hashPassword } from '../../lib/crypto.js';
import { testOutbox } from '../../lib/mailer.js';
import { closeSocket, initSocket } from '../../lib/socket.js';
import { seedDatabase } from '../../seed/seed.js';
import { startTestDatabase, stopTestDatabase, waitUntil } from '../../test/db.js';
import { User } from '../users/user.model.js';
import { Appointment } from './appointment.model.js';
import { canJoinAppointment, sendReminders } from './appointment.service.js';

const app = createApp();
const server = http.createServer(app);
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const tokens: Record<string, string> = {};
let techId = '';

async function account(email: string, role: 'client' | 'technicien' | 'admin') {
  const user = await User.create({
    email,
    firstName: role === 'technicien' ? 'Koffi' : 'Test',
    lastName: role,
    phone: '+2250101010101',
    role,
    passwordHash: await hashPassword('motdepasse2026'),
    emailVerifiedAt: new Date(),
  });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'motdepasse2026' });
  tokens[role] = `Bearer ${res.body.data.accessToken as string}`;
  return user;
}

async function availableSlots() {
  const res = await request(app).get('/api/v1/availability/slots?days=14');
  return (res.body.data as { slots: { start: string; available: boolean }[] }[])
    .flatMap((d) => d.slots)
    .filter((s) => s.available)
    .map((s) => s.start);
}

const booking = (start: string) => ({
  start,
  mode: 'sur_site',
  contact: { name: 'Awa Koné', email: 'awa@example.ci', phone: '0707123456' },
  address: { street: 'Rue des Jardins', commune: 'Cocody', landmark: 'Face à la pharmacie' },
  description: 'Imprimante réseau hors service',
  consent: true,
});

beforeAll(async () => {
  await startTestDatabase();
  await seedDatabase();
  await account('admin@example.ci', 'admin');
  techId = String((await account('tech@example.ci', 'technicien'))._id);
  await account('client@example.ci', 'client');
  initSocket(server, {
    appointment: canJoinAppointment,
    ticket: async () => null,
    displayName: async () => '',
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
});
afterAll(async () => {
  await closeSocket();
  server.close();
  await stopTestDatabase();
});
beforeEach(() => {
  testOutbox.length = 0;
});

describe('réservation et suivi', () => {
  let id = '';
  let reference = '';

  it('réserve un créneau libre puis le rend indisponible', async () => {
    const [start] = await availableSlots();
    const res = await request(app).post('/api/v1/appointments').send(booking(start!));
    expect(res.status).toBe(201);
    ({ id, reference } = res.body.data);
    expect(reference).toMatch(/^INT-\d{4}-0001$/);
    expect(res.body.data).toMatchObject({ status: 'demande_recue', hasAccount: false });
    expect(await availableSlots()).not.toContain(start);

    const again = await request(app).post('/api/v1/appointments').send(booking(start!));
    expect(again.status).toBe(409);

    const next = await request(app).get('/api/v1/availability/next');
    expect(next.body.data.start).not.toBe(start);
    await waitUntil(() => testOutbox.some((m) => m.subject.includes(reference)));
  });

  it('refuse un créneau inventé et exige la commune sur site', async () => {
    const odd = await request(app)
      .post('/api/v1/appointments')
      .send(booking('2030-01-01T03:17:00.000Z'));
    expect(odd.status).toBe(400);
    const [start] = await availableSlots();
    const noCommune = await request(app)
      .post('/api/v1/appointments')
      .send({ ...booking(start!), address: {} });
    expect(noCommune.body.error.details[0].path).toBe('address.commune');
  });

  it('donne le suivi public avec la référence et le téléphone, sans fuite', async () => {
    const wrong = await request(app)
      .post('/api/v1/tracking/lookup')
      .send({ reference, contact: '0101010101' });
    expect(wrong.status).toBe(404);
    const ok = await request(app)
      .post('/api/v1/tracking/lookup')
      .send({ reference: reference.toLowerCase(), contact: '07 07 12 34 56' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ reference, status: 'demande_recue' });
    expect(JSON.stringify(ok.body.data)).not.toContain('awa@example.ci');
    expect(ok.body.data.trackingToken).toEqual(expect.any(String));
  });

  it('diffuse en temps réel les changements de statut sur la page de suivi', async () => {
    const lookup = await request(app)
      .post('/api/v1/tracking/lookup')
      .send({ reference, contact: 'awa@example.ci' });
    const { port } = server.address() as AddressInfo;
    const socket = connect(`http://localhost:${port}`, {
      auth: { trackingToken: lookup.body.data.trackingToken },
      transports: ['websocket'],
    });
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });
    const received = new Promise<{ status: string }>((resolve) =>
      socket.on('appointment:status', resolve),
    );

    const assigned = await request(app)
      .patch(`/api/v1/admin/appointments/${id}`)
      .set('Authorization', tokens.admin!)
      .send({ technician: techId });
    expect(assigned.body.data).toMatchObject({
      status: 'planifiee',
      technician: { firstName: 'Koffi' },
    });
    expect((await received).status).toBe('planifiee');
    socket.disconnect();

    const anonymous = connect(`http://localhost:${port}`, { transports: ['websocket'] });
    const refused = await new Promise<string>((resolve) =>
      anonymous.on('connect_error', (err) => resolve(err.message)),
    );
    expect(refused).toBe('UNAUTHORIZED');
    anonymous.disconnect();
  });
});

describe('intervention par le technicien', () => {
  it('suit les étapes, complète le rapport avec photo et fait signer le client', async () => {
    const [mine] = (
      await request(app)
        .get('/api/v1/technician/appointments?range=week')
        .set('Authorization', tokens.technicien!)
    ).body.data as { id: string }[];
    expect(mine).toBeDefined();
    const base = `/api/v1/technician/appointments/${mine!.id}`;
    const tech = { Authorization: tokens.technicien! };

    await request(app).patch(`${base}/status`).set(tech).send({ status: 'terminee' }).expect(409);
    await request(app).put(`${base}/report`).set(tech).send({ workDone: 'x' }).expect(409);
    await request(app).patch(`${base}/status`).set(tech).send({ status: 'en_route' }).expect(200);
    await request(app).patch(`${base}/status`).set(tech).send({ status: 'en_cours' }).expect(200);

    await request(app)
      .put(`${base}/report`)
      .set(tech)
      .send({
        workDone: 'Remplacement du câble réseau et réinstallation du pilote.',
        timeSpentMinutes: 75,
        materials: [{ label: 'Câble RJ45 3 m', quantity: 1 }],
      })
      .expect(200);

    const fake = await request(app)
      .post(`${base}/report/photos`)
      .set(tech)
      .attach('photos', Buffer.from('<script>alert(1)</script>'), 'photo.png');
    expect(fake.status).toBe(400);
    const photo = await request(app)
      .post(`${base}/report/photos`)
      .set(tech)
      .attach('photos', PNG, 'photo.png');
    expect(photo.status).toBe(201);
    expect(photo.body.data.report.photos).toHaveLength(1);

    const early = await request(app)
      .post(`${base}/report/sign`)
      .set(tech)
      .send({
        signerName: 'Awa Koné',
        signature: `data:image/png;base64,${PNG.toString('base64')}`,
      });
    expect(early.status).toBe(409);

    await request(app).patch(`${base}/status`).set(tech).send({ status: 'terminee' }).expect(200);
    const signed = await request(app)
      .post(`${base}/report/sign`)
      .set(tech)
      .send({
        signerName: 'Awa Koné',
        signature: `data:image/png;base64,${PNG.toString('base64')}`,
      });
    expect(signed.status).toBe(200);
    expect(signed.body.data.status).toBe('validee');
    expect(signed.body.data.report).toMatchObject({ status: 'signe', signerName: 'Awa Koné' });

    await request(app).put(`${base}/report`).set(tech).send({ workDone: 'modif' }).expect(409);

    const pdf = await request(app)
      .get(`/api/v1/appointments/${mine!.id}/report/pdf`)
      .set('Authorization', tokens.admin!);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('cache les interventions des autres', async () => {
    const other = await account('tech2@example.ci', 'technicien');
    expect(other).toBeDefined();
    const list = await request(app)
      .get('/api/v1/technician/appointments?range=week')
      .set('Authorization', tokens.technicien!);
    expect(list.body.data).toEqual([]);
    await request(app)
      .get('/api/v1/admin/appointments')
      .set('Authorization', tokens.technicien!)
      .expect(403);
  });
});

describe('espace client', () => {
  it('reporte puis annule avant le délai limite, et envoie le rappel la veille', async () => {
    const slots = await availableSlots();
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', tokens.client!)
      .send({
        ...booking(slots.at(-1)!),
        contact: { name: 'Client', email: 'client@example.ci', phone: '0505050505' },
      });
    expect(res.body.data.hasAccount).toBe(true);
    const id = res.body.data.id as string;

    const list = await request(app)
      .get('/api/v1/appointments')
      .set('Authorization', tokens.client!);
    expect(list.body.data.map((a: { id: string }) => a.id)).toEqual([id]);

    const moved = await request(app)
      .post(`/api/v1/appointments/${id}/reschedule`)
      .set('Authorization', tokens.client!)
      .send({ start: slots.at(-2) });
    expect(moved.status).toBe(200);
    expect(moved.body.data.start).toBe(slots.at(-2));

    // Rappel : intervention ramenée dans 24 h.
    await Appointment.updateOne(
      { _id: id },
      {
        start: new Date(Date.now() + 24 * 3600_000),
        end: new Date(Date.now() + 25.5 * 3600_000),
      },
    );
    expect(await sendReminders()).toBe(1);
    expect(await sendReminders()).toBe(0);

    // Moins de 24 h avant : plus modifiable en ligne.
    const late = await request(app)
      .post(`/api/v1/appointments/${id}/cancel`)
      .set('Authorization', tokens.client!)
      .send({});
    expect(late.status).toBe(409);
    await Appointment.updateOne(
      { _id: id },
      { start: new Date(Date.now() + 72 * 3600_000), end: new Date(Date.now() + 73.5 * 3600_000) },
    );
    const cancelled = await request(app)
      .post(`/api/v1/appointments/${id}/cancel`)
      .set('Authorization', tokens.client!)
      .send({ reason: 'Déplacement imprévu' });
    expect(cancelled.body.data.status).toBe('annulee');
  });
});
