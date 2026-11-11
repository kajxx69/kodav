import { randomBytes } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * API des tests de bout en bout : base MongoDB en mémoire, catalogue et comptes de test créés au
 * démarrage, aucun email envoyé (mode test). Ne touche jamais la base configurée dans .env.
 */
const mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
const secret = () => randomBytes(48).toString('base64url');

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: process.env.E2E_API_PORT ?? '4100',
  API_URL: `http://localhost:${process.env.E2E_API_PORT ?? '4100'}`,
  CLIENT_URL: `http://localhost:${process.env.E2E_WEB_PORT ?? '5180'}`,
  CORS_ORIGINS: `http://localhost:${process.env.E2E_WEB_PORT ?? '5180'}`,
  MONGODB_URI: mongo.getUri('kodav-e2e'),
  JWT_ACCESS_SECRET: secret(),
  JWT_REFRESH_SECRET: secret(),
  ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  SMTP_HOST: '',
  CLOUDINARY_CLOUD_NAME: '',
  TURNSTILE_ENABLED: 'false',
  UPLOAD_DIR: await mkdtemp(path.join(tmpdir(), 'kodav-e2e-')),
  SEED_ADMIN_EMAIL: 'admin@kodav.test',
  SEED_ADMIN_PASSWORD: process.env.E2E_PASSWORD,
  SEED_TEST_PASSWORD: process.env.E2E_PASSWORD,
});

const { connectDatabase, disconnectDatabase } = await import('../config/db.js');
const { seedDatabase } = await import('../seed/seed.js');
const { seedAccounts } = await import('../seed/accounts.js');
await connectDatabase(process.env.MONGODB_URI!);
await seedDatabase();
await seedAccounts();
await disconnectDatabase();

process.on('exit', () => void mongo.stop());
await import('../server.js');
