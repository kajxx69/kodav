import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { seedAccounts } from './accounts.js';
import { seedDatabase } from './seed.js';

try {
  await connectDatabase(env.MONGODB_URI!);
  const counts = { ...(await seedDatabase()), accounts: await seedAccounts() };
  logger.info({ ajoutés: counts }, 'Seed terminé');
} catch (err) {
  logger.fatal({ err }, 'Seed impossible');
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
