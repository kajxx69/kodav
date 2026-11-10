import http from 'node:http';
import type { Types } from 'mongoose';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { hashPassword } from '../../lib/crypto.js';
import { testOutbox } from '../../lib/mailer.js';
import { closeSocket, initSocket } from '../../lib/socket.js';
import { startTestDatabase, stopTestDatabase } from '../../test/db.js';
import { Organization } from '../organizations/organization.model.js';
import { User } from '../users/user.model.js';
import { closeStaleTickets, ticketSocketAccess } from './ticket.service.js';
import { sendLicenseAlerts } from './asset.routes.js';
import { Asset, AuditLog, Notification, Ticket } from './support.model.js';

const app = createApp();
const server = http.createServer(app);
const auth: Record<string, string> = {};
const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function account(
  key: string,
  role: 'client' | 'technicien' | 'admin',
  organization?: unknown,
) {
  const user = await User.create({
    email: `${key}@example.ci`,
    firstName: key,
    lastName: 'Test',
    role,
    organization: (organization ?? null) as Types.ObjectId | null,
    passwordHash: await hashPassword('motdepasse2026'),
    emailVerifiedAt: new Date(),
  });
  ids[key] = String(user._id);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: `${key}@example.ci`, password: 'motdepasse2026' });
  tokens[key] = res.body.data.accessToken as string;
  auth[key] = `Bearer ${tokens[key]}`;
}

function socketFor(key: string) {
  const { port } = server.address() as AddressInfo;
  return connect(`http://localhost:${port}`, {
    auth: { token: tokens[key] },
    transports: ['websocket'],
  });
}
const once = <T>(socket: Socket, event: string) =>
  new Promise<T>((resolve) => socket.once(event, resolve));
const join = (socket: Socket, id: string) =>
  new Promise<boolean>((resolve) => socket.emit('ticket:join', id, resolve));

beforeAll(async () => {
  await startTestDatabase();
  const org = await Organization.create({
    name: 'École Test',
    type: 'ecole',
    owner: '0123456789abcdef01234567',
  });
  await account('awa', 'client', org._id);
  await account('collegue', 'client', org._id);
  await account('autre', 'client');
  await account('koffi', 'technicien');
  await account('admin', 'admin');
  initSocket(server, {
    appointment: async () => false,
    ticket: ticketSocketAccess,
    displayName: async (id) => (await User.findById(id).lean())?.firstName ?? '',
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
});
afterAll(async () => {
  await closeSocket();
  server.close();
  await stopTestDatabase();
});

describe('parc informatique', () => {
  it('enregistre une licence sans jamais renvoyer la clé, et la partage à l’organisation', async () => {
    const res = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', auth.awa!)
      .send({
        type: 'licence',
        name: 'Office salle info',
        license: {
          product: 'Microsoft 365',
          seats: 20,
          expiresAt: new Date(Date.now() + 5 * 24 * 3600_000).toISOString().slice(0, 10),
          key: 'ABCDE-FGHIJ-KLMNO-PQRST-UVWXY',
          storeKey: true,
        },
      });
    expect(res.status).toBe(201);
    ids.licence = res.body.data.id;
    expect(res.body.data.license).toMatchObject({ keyLast5: 'UVWXY', keyStored: true, seats: 20 });
    expect(JSON.stringify(res.body.data)).not.toContain('ABCDE');
    const stored = await Asset.findById(ids.licence).select('+license.keyEncrypted').lean();
    expect(stored?.license?.keyEncrypted).toBeDefined();
    expect(stored?.license?.keyEncrypted).not.toContain('ABCDE');

    const poste = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', auth.collegue!)
      .send({ type: 'poste', name: 'PC accueil', brand: 'Dell', serialNumber: 'SN-42' });
    ids.poste = poste.body.data.id;

    const shared = await request(app).get('/api/v1/assets').set('Authorization', auth.awa!);
    expect(shared.body.data.map((a: { name: string }) => a.name).sort()).toEqual([
      'Office salle info',
      'PC accueil',
    ]);
    const other = await request(app).get('/api/v1/assets').set('Authorization', auth.autre!);
    expect(other.body.data).toEqual([]);
    await request(app)
      .delete(`/api/v1/assets/${ids.poste}`)
      .set('Authorization', auth.autre!)
      .expect(404);

    const expiring = await request(app)
      .get('/api/v1/assets/licenses/expiring')
      .set('Authorization', auth.awa!);
    expect(expiring.body.data).toHaveLength(1);
  });

  it('exige les champs d’une licence', async () => {
    const res = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', auth.awa!)
      .send({ type: 'licence', name: 'Antivirus', license: { storeKey: true } });
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(
      expect.arrayContaining(['license.product', 'license.expiresAt', 'license.key']),
    );
  });

  it('révèle la clé confiée à l’admin seulement, et journalise l’accès', async () => {
    await request(app)
      .post(`/api/v1/admin/assets/${ids.licence}/reveal-key`)
      .set('Authorization', auth.koffi!)
      .expect(403);
    const res = await request(app)
      .post(`/api/v1/admin/assets/${ids.licence}/reveal-key`)
      .set('Authorization', auth.admin!);
    expect(res.body.data.key).toBe('ABCDE-FGHIJ-KLMNO-PQRST-UVWXY');
    expect(await AuditLog.countDocuments({ action: 'license.reveal_key', actor: ids.admin })).toBe(
      1,
    );
  });

  it('alerte une seule fois par seuil avant expiration', async () => {
    testOutbox.length = 0;
    expect(await sendLicenseAlerts()).toBe(1);
    expect(await sendLicenseAlerts()).toBe(0);
    // 5 jours restants : seuil de 7 jours, emails aux deux membres.
    expect(testOutbox.filter((m) => m.subject.includes('expire dans 5 jours'))).toHaveLength(2);
    const notes = await Notification.find({ type: 'license_expiring' }).lean();
    expect(notes).toHaveLength(2);
  });
});

describe('tickets', () => {
  let ticketId = '';

  it('crée un ticket avec pièce jointe et délai cible en heures ouvrées', async () => {
    const res = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', auth.awa!)
      .field('subject', 'Imprimante <b>bloquée</b>')
      .field('category', 'materiel')
      .field('priority', 'haute')
      .field('assetId', ids.poste!)
      .field('body', 'Elle affiche une erreur <script>alert(1)</script> depuis ce matin.')
      .attach('attachments', PNG, 'erreur.png');
    expect(res.status).toBe(201);
    ticketId = res.body.data.id;
    expect(res.body.data).toMatchObject({
      reference: expect.stringMatching(/^TCK-\d{4}-0001$/),
      status: 'ouvert',
      priority: 'haute',
      slaHours: 48,
      subject: 'Imprimante bloquée',
      asset: { name: 'PC accueil' },
    });
    expect(new Date(res.body.data.slaDueAt).getTime()).toBeGreaterThan(Date.now() + 48 * 3600_000);
    expect(res.body.data.messages[0].body).toBe(
      'Elle affiche une erreur alert(1) depuis ce matin.',
    );
    expect(res.body.data.messages[0].attachments).toEqual([
      { id: '0', name: 'erreur.png', mime: 'image/png', size: PNG.length },
    ]);

    const file = await request(app)
      .get(`/api/v1/tickets/${ticketId}/messages/${res.body.data.messages[0].id}/attachments/0`)
      .set('Authorization', auth.collegue!);
    expect(file.headers['content-type']).toBe('image/png');

    const bad = await request(app)
      .post('/api/v1/tickets')
      .set('Authorization', auth.awa!)
      .field('subject', 'Test')
      .field('category', 'autre')
      .field('body', 'Pièce jointe déguisée')
      .attach('attachments', Buffer.from('MZ fake exe'), 'facture.pdf');
    expect(bad.status).toBe(400);
    expect(await Ticket.countDocuments()).toBe(1);
  });

  it('isole les tickets : autre client, technicien non assigné', async () => {
    await request(app)
      .get(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', auth.autre!)
      .expect(404);
    await request(app)
      .get(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', auth.koffi!)
      .expect(404);
    const list = await request(app)
      .get('/api/v1/tickets?open=true')
      .set('Authorization', auth.admin!);
    expect(list.body.data.items[0]).toMatchObject({ id: ticketId, unread: 1 });
  });

  it('diffuse en direct les messages, cache les notes internes au client', async () => {
    await request(app)
      .patch(`/api/v1/admin/tickets/${ticketId}`)
      .set('Authorization', auth.admin!)
      .send({ assignee: ids.koffi })
      .expect(200);

    const client = socketFor('awa');
    const tech = socketFor('koffi');
    const outsider = socketFor('autre');
    expect(await join(client, ticketId)).toBe(true);
    expect(await join(tech, ticketId)).toBe(true);
    expect(await join(outsider, ticketId)).toBe(false);

    const typing = once<{ name: string }>(client, 'ticket:typing');
    tech.emit('ticket:typing', ticketId);
    expect((await typing).name).toBe('koffi');

    const internalSeen: string[] = [];
    client.on('ticket:message', (e: { message: { body: string } }) =>
      internalSeen.push(e.message.body),
    );
    const techGotNote = once<{ message: { isInternal: boolean } }>(tech, 'ticket:message');
    await request(app)
      .post(`/api/v1/tickets/${ticketId}/messages`)
      .set('Authorization', auth.koffi!)
      .field('body', 'Note : cartouche à commander')
      .field('isInternal', 'true')
      .expect(201);
    expect((await techGotNote).message.isInternal).toBe(true);

    const clientGotReply = once<{ message: { body: string } }>(client, 'ticket:message');
    const updated = once<{ status: string }>(client, 'ticket:updated');
    await request(app)
      .post(`/api/v1/tickets/${ticketId}/messages`)
      .set('Authorization', auth.koffi!)
      .send({ body: 'Bonjour, pouvez-vous redémarrer l’imprimante ?' })
      .expect(201);
    expect((await clientGotReply).message.body).toContain('redémarrer');
    expect((await updated).status).toBe('en_cours');
    expect(internalSeen).not.toContain('Note : cartouche à commander');
    [client, tech, outsider].forEach((s) => s.disconnect());

    await request(app)
      .post(`/api/v1/tickets/${ticketId}/messages`)
      .set('Authorization', auth.awa!)
      .send({ body: 'Note interne pirate', isInternal: true })
      .expect(403);
    const detail = await request(app)
      .get(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', auth.awa!);
    expect(detail.body.data.messages.map((m: { body: string }) => m.body)).not.toContain(
      'Note : cartouche à commander',
    );
    expect(detail.body.data.firstResponseAt).not.toBeNull();
    const staffView = await request(app)
      .get(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', auth.koffi!);
    expect(staffView.body.data.messages).toHaveLength(3);

    const notified = await Notification.find({ user: ids.awa, type: 'ticket_message' }).lean();
    expect(notified).toHaveLength(1);
  });

  it('laisse le technicien résoudre, le client noter, puis ferme', async () => {
    await request(app)
      .patch(`/api/v1/admin/tickets/${ticketId}`)
      .set('Authorization', auth.koffi!)
      .send({ priority: 'critique' })
      .expect(403);
    await request(app)
      .patch(`/api/v1/admin/tickets/${ticketId}`)
      .set('Authorization', auth.koffi!)
      .send({ status: 'resolu' })
      .expect(200);
    await request(app)
      .post(`/api/v1/tickets/${ticketId}/rate`)
      .set('Authorization', auth.awa!)
      .send({ rating: 6 })
      .expect(400);
    const rated = await request(app)
      .post(`/api/v1/tickets/${ticketId}/rate`)
      .set('Authorization', auth.awa!)
      .send({ rating: 5, comment: 'Rapide et efficace' });
    expect(rated.body.data).toMatchObject({ status: 'ferme', satisfaction: { rating: 5 } });
    await request(app)
      .post(`/api/v1/tickets/${ticketId}/messages`)
      .set('Authorization', auth.awa!)
      .send({ body: 'Encore une question' })
      .expect(409);
  });

  it('ferme automatiquement un ticket résolu depuis 7 jours', async () => {
    const res = await request(app).post('/api/v1/tickets').set('Authorization', auth.autre!).send({
      subject: 'Mot de passe oublié',
      category: 'acces_comptes',
      body: 'Je n’arrive plus à me connecter.',
    });
    await request(app)
      .post(`/api/v1/tickets/${res.body.data.id}/resolve`)
      .set('Authorization', auth.autre!)
      .expect(200);
    await Ticket.updateOne(
      { _id: res.body.data.id },
      { resolvedAt: new Date(Date.now() - 8 * 24 * 3600_000) },
    );
    expect(await closeStaleTickets()).toBe(1);
  });
});

describe('notifications', () => {
  it('liste, compte et marque les notifications de l’utilisateur seulement', async () => {
    const list = await request(app).get('/api/v1/notifications').set('Authorization', auth.awa!);
    expect(list.body.data.unread).toBeGreaterThanOrEqual(2);
    const first = list.body.data.items[0].id as string;
    await request(app)
      .patch(`/api/v1/notifications/${first}/read`)
      .set('Authorization', auth.autre!)
      .expect(200);
    expect((await Notification.findById(first).lean())?.readAt).toBeNull();
    await request(app)
      .post('/api/v1/notifications/read-all')
      .set('Authorization', auth.awa!)
      .expect(200);
    const after = await request(app).get('/api/v1/notifications').set('Authorization', auth.awa!);
    expect(after.body.data.unread).toBe(0);
  });
});
