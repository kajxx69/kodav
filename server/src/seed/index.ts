import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { seedDatabase } from './seed.js';

// Comptes de test (admin, technicien, clients) : ajoutés en phase 2 avec l'authentification.
try {
  await connectDatabase(env.MONGODB_URI!);
  const counts = await seedDatabase();
  logger.info({ ajoutés: counts }, 'Seed terminé');
} catch (err) {
  logger.fatal({ err }, 'Seed impossible');
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
