import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { hashPassword, hashToken } from '../../lib/crypto.js';
import { testOutbox } from '../../lib/mailer.js';
import { startTestDatabase, stopTestDatabase } from '../../test/db.js';
import { Organization } from '../organizations/organization.model.js';
import { User } from '../users/user.model.js';
import { AuthToken } from './authToken.model.js';

const app = createApp();
const APP_HEADER = { 'X-Requested-With': 'kodav' };

const registration = {
  firstName: 'Awa',
  lastName: 'Koné',
  email: 'Awa@Example.ci',
  phone: '07 07 12 34 56',
  password: 'motdepasse2026',
  profile: 'pme',
  organizationName: 'Boutique Awa',
  consent: true,
};

/** Cookie du refresh token renvoyé par l'API (valeur seule). */
function refreshCookie(res: request.Response) {
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = raw.find((c) => c.startsWith('kodav_rt='));
  return cookie?.split(';')[0];
}

function linkToken(kind: 'verifier-email' | 'reinitialiser-mot-de-passe') {
  const mail = testOutbox.findLast((m) => m.text.includes(kind));
  return mail?.text.match(/token=([\w-]+)/)?.[1];
}

async function createUser(email: string, role: 'client' | 'technicien' | 'admin') {
  return User.create({
    email,
    firstName: 'Test',
    lastName: role,
    role,
    passwordHash: await hashPassword('motdepasse2026'),
    emailVerifiedAt: new Date(),
  });
}

async function login(email: string, password = 'motdepasse2026') {
  return request(app).post('/api/v1/auth/login').send({ email, password });
}

beforeAll(startTestDatabase);
afterAll(stopTestDatabase);
beforeEach(() => {
  testOutbox.length = 0;
});

describe('inscription et vérification de l’email', () => {
  it('crée le compte, l’organisation et ouvre une session', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(registration);
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({
      email: 'awa@example.ci',
      phone: '+2250707123456',
      role: 'client',
      profile: 'pme',
      orgRole: 'owner',
      emailVerified: false,
      organization: { name: 'Boutique Awa', type: 'pme' },
    });
    expect(res.body.data.user.passwordHash).toBeUndefined();

    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);

    const stored = await User.findOne({ email: 'awa@example.ci' }).select('+passwordHash').lean();
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await Organization.countDocuments({ owner: stored?._id })).toBe(1);
  });

  it('refuse un email déjà utilisé, un rôle imposé et une structure sans nom', async () => {
    const dup = await request(app).post('/api/v1/auth/register').send(registration);
    expect(dup.status).toBe(409);
    expect(dup.body.error.details[0].path).toBe('email');

    const noOrg = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registration, email: 'autre@example.ci', organizationName: '', role: 'admin' });
    expect(noOrg.status).toBe(400);
    expect(noOrg.body.error.details.map((d: { path: string }) => d.path)).toContain(
      'organizationName',
    );
  });

  it('ne donne jamais le rôle admin à une inscription', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registration, email: 'role@example.ci', profile: 'particulier', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('client');
    expect(res.body.data.user.organization).toBeNull();
  });

  it('confirme l’email avec le lien reçu, une seule fois', async () => {
    await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'awa@example.ci' })
      .expect(200);
    const token = linkToken('verifier-email');
    expect(token).toBeDefined();

    await request(app).post('/api/v1/auth/verify-email').send({ token }).expect(200);
    const again = await request(app).post('/api/v1/auth/verify-email').send({ token });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('INVALID_TOKEN');

    const user = await User.findOne({ email: 'awa@example.ci' }).lean();
    expect(user?.emailVerifiedAt).toBeInstanceOf(Date);
  });
});

describe('connexion et sessions', () => {
  it('refuse de mauvais identifiants avec un message générique', async () => {
    const wrong = await login('awa@example.ci', 'mauvais-mot-2026');
    const unknown = await login('inconnu@example.ci');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('fait tourner le refresh token et détecte sa réutilisation', async () => {
    const first = await login('awa@example.ci');
    expect(first.status).toBe(200);
    const cookie1 = refreshCookie(first)!;

    // Sans l'en-tête applicatif (protection CSRF) : refusé.
    await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie1).expect(403);

    const second = await request(app)
      .post('/api/v1/auth/refresh')
      .set(APP_HEADER)
      .set('Cookie', cookie1);
    expect(second.status).toBe(200);
    const cookie2 = refreshCookie(second)!;
    expect(cookie2).not.toBe(cookie1);

    // Réutilisation de l'ancien jeton après le délai de grâce : toute la famille est révoquée.
    await AuthToken.updateOne(
      { tokenHash: hashToken(cookie1.replace('kodav_rt=', '')) },
      { usedAt: new Date(Date.now() - 60_000) },
    );
    await request(app)
      .post('/api/v1/auth/refresh')
      .set(APP_HEADER)
      .set('Cookie', cookie1)
      .expect(401);
    const stolen = await request(app)
      .post('/api/v1/auth/refresh')
      .set(APP_HEADER)
      .set('Cookie', cookie2);
    expect(stolen.status).toBe(401);
    expect(stolen.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('invalide la session à la déconnexion', async () => {
    const res = await login('awa@example.ci');
    const cookie = refreshCookie(res)!;
    await request(app)
      .post('/api/v1/auth/logout')
      .set(APP_HEADER)
      .set('Cookie', cookie)
      .expect(200);
    await request(app)
      .post('/api/v1/auth/refresh')
      .set(APP_HEADER)
      .set('Cookie', cookie)
      .expect(401);
  });

  it('bloque un compte désactivé, même avec un jeton valide', async () => {
    const user = await createUser('desactive@example.ci', 'client');
    const res = await login('desactive@example.ci');
    const token = res.body.data.accessToken as string;
    await User.updateOne({ _id: user._id }, { isActive: false });

    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    const again = await login('desactive@example.ci');
    expect(again.status).toBe(403);
    expect(again.body.error.code).toBe('ACCOUNT_DISABLED');
  });
});

describe('mot de passe oublié', () => {
  it('répond pareil pour un email inconnu et n’envoie rien', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'personne@example.ci' });
    expect(res.status).toBe(200);
    expect(testOutbox).toHaveLength(0);
  });

  it('réinitialise le mot de passe et ferme les sessions ouvertes', async () => {
    const session = await login('awa@example.ci');
    const cookie = refreshCookie(session)!;

    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'awa@example.ci' })
      .expect(200);
    const token = linkToken('reinitialiser-mot-de-passe');

    const mismatch = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'nouveau-mot-2026', confirmPassword: 'autre' });
    expect(mismatch.status).toBe(400);

    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'nouveau-mot-2026', confirmPassword: 'nouveau-mot-2026' })
      .expect(200);

    await request(app)
      .post('/api/v1/auth/refresh')
      .set(APP_HEADER)
      .set('Cookie', cookie)
      .expect(401);
    expect((await login('awa@example.ci')).status).toBe(401);
    expect((await login('awa@example.ci', 'nouveau-mot-2026')).status).toBe(200);
    expect(testOutbox.at(-1)?.subject).toBe('Votre mot de passe a été modifié');
  });
});

describe('profil et rôles', () => {
  it('met à jour le profil et change le mot de passe', async () => {
    const res = await login('awa@example.ci', 'nouveau-mot-2026');
    const auth = { Authorization: `Bearer ${res.body.data.accessToken}` };

    const patched = await request(app)
      .patch('/api/v1/auth/me')
      .set(auth)
      .send({ firstName: 'Awa', lastName: 'Koné-Traoré', phone: '0505050505', role: 'admin' });
    expect(patched.status).toBe(200);
    expect(patched.body.data).toMatchObject({
      lastName: 'Koné-Traoré',
      phone: '+2250505050505',
      role: 'client',
    });

    const wrong = await request(app).patch('/api/v1/auth/me/password').set(auth).send({
      currentPassword: 'faux',
      newPassword: 'encore-un-2026',
      confirmPassword: 'encore-un-2026',
    });
    expect(wrong.status).toBe(400);

    const changed = await request(app).patch('/api/v1/auth/me/password').set(auth).send({
      currentPassword: 'nouveau-mot-2026',
      newPassword: 'encore-un-2026',
      confirmPassword: 'encore-un-2026',
    });
    expect(changed.status).toBe(200);
    expect(changed.body.data.accessToken).toEqual(expect.any(String));
  });

  it('réserve l’espace admin aux administrateurs', async () => {
    await createUser('admin@example.ci', 'admin');
    await createUser('tech@example.ci', 'technicien');
    const admin = (await login('admin@example.ci')).body.data.accessToken as string;
    const tech = (await login('tech@example.ci')).body.data.accessToken as string;

    await request(app).get('/api/v1/admin/overview').expect(401);
    await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${tech}`)
      .expect(403);
    await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', 'Bearer jeton-invalide')
      .expect(401);

    const overview = await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${admin}`);
    expect(overview.status).toBe(200);
    expect(overview.body.data.users).toMatchObject({ admin: 1, technicien: 1 });

    const list = await request(app)
      .get('/api/v1/admin/users?role=client&q=awa')
      .set('Authorization', `Bearer ${admin}`);
    expect(list.status).toBe(200);
    const found = list.body.data.items as { email: string; role: string }[];
    expect(found.map((u) => u.email)).toContain('awa@example.ci');
    expect(found.every((u) => u.role === 'client')).toBe(true);
    expect(list.body.data.total).toBe(found.length);
  });

  it('limite l’organisation à ses membres, la modification à son responsable', async () => {
    const owner = (await login('awa@example.ci', 'encore-un-2026')).body.data.accessToken;
    const org = await Organization.findOne({ name: 'Boutique Awa' }).lean();
    const member = await createUser('membre@example.ci', 'client');
    await User.updateOne({ _id: member._id }, { organization: org!._id, orgRole: 'member' });
    const memberToken = (await login('membre@example.ci')).body.data.accessToken;
    const loner = (await login('desactive@example.ci')).status; // compte désactivé plus haut
    expect(loner).toBe(403);

    const read = await request(app)
      .get('/api/v1/organizations/me')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(read.body.data.name).toBe('Boutique Awa');

    const body = { name: 'Boutique Awa SARL', phone: '0707070707' };
    await request(app)
      .patch('/api/v1/organizations/me')
      .set('Authorization', `Bearer ${memberToken}`)
      .send(body)
      .expect(403);
    const updated = await request(app)
      .patch('/api/v1/organizations/me')
      .set('Authorization', `Bearer ${owner}`)
      .send(body);
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ name: 'Boutique Awa SARL', phone: '+2250707070707' });
  });
});
