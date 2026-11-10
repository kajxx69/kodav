import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';

let mongo: MongoMemoryServer | undefined;

export async function startTestDatabase() {
  // Le premier démarrage de mongod peut être lent (antivirus Windows, CI).
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  await connectDatabase(mongo.getUri('kodav-test'));
  // Index uniques et texte construits avant les tests (sinon créés en arrière-plan).
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

export async function stopTestDatabase() {
  await disconnectDatabase();
  await mongo?.stop();
}
