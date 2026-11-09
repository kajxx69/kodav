import http from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

async function main() {
  // env.ts garantit la présence de MONGODB_URI hors environnement de test.
  await connectDatabase(env.MONGODB_URI!);

  const server = http.createServer(createApp());
  server.listen(env.PORT, () => {
    logger.info(`API KODAV prête sur ${env.API_URL}/api/v1 (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} reçu, arrêt en cours`);
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'Démarrage impossible');
  process.exit(1);
});
