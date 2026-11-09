import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase, disconnectDatabase } from '../config/db.js';

let mongo: MongoMemoryServer | undefined;

export async function startTestDatabase() {
  // Le premier démarrage de mongod peut être lent (antivirus Windows, CI).
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  await connectDatabase(mongo.getUri('kodav-test'));
}

export async function stopTestDatabase() {
  await disconnectDatabase();
  await mongo?.stop();
}
