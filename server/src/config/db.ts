import mongoose from 'mongoose';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);
// Neutralise les opérateurs ($gt, $ne…) injectés dans les filtres de requête.
mongoose.set('sanitizeFilter', true);

export type DatabaseState = 'connected' | 'connecting' | 'disconnected';

export function getDatabaseState(): DatabaseState {
  switch (mongoose.connection.readyState) {
    case mongoose.ConnectionStates.connected:
      return 'connected';
    case mongoose.ConnectionStates.connecting:
      return 'connecting';
    default:
      return 'disconnected';
  }
}

export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB déconnecté'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnecté'));
  const connection = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  // Le nom d'hôte seul : jamais l'URI complète (elle contient le mot de passe).
  logger.info(
    { host: connection.connection.host, db: connection.connection.name },
    'MongoDB connecté',
  );
  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
