import http from 'node:http';
import cron from 'node-cron';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { initSocket } from './lib/socket.js';
import { canJoinAppointment, sendReminders } from './modules/appointments/appointment.service.js';
import { expireQuotes } from './modules/quotes/quote.service.js';

async function main() {
  // env.ts garantit la présence de MONGODB_URI hors environnement de test.
  await connectDatabase(env.MONGODB_URI!);

  // Tâches planifiées (heure d'Abidjan) : expiration des devis chaque nuit, et au démarrage.
  const runExpiry = () =>
    expireQuotes().catch((err: unknown) => logger.error({ err }, 'Expiration des devis'));
  void runExpiry();
  cron.schedule('15 2 * * *', runExpiry, { timezone: 'Africa/Abidjan' });
  // Rappels la veille : vérification toutes les 15 minutes.
  cron.schedule('*/15 * * * *', () => {
    sendReminders().catch((err: unknown) => logger.error({ err }, 'Rappels d’intervention'));
  });

  const server = http.createServer(createApp());
  initSocket(server, canJoinAppointment);
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
