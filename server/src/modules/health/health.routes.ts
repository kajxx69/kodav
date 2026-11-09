import { Router } from 'express';
import type { Health } from '@kodav/shared';
import { getDatabaseState } from '../../config/db.js';
import { sendOk } from '../../lib/http.js';

const version = process.env.npm_package_version ?? '0.1.0';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const database = getDatabaseState();
  const health: Health = {
    status: database === 'connected' ? 'ok' : 'degraded',
    database,
    uptime: Math.round(process.uptime()),
    version,
    timestamp: new Date().toISOString(),
  };
  res.setHeader('Cache-Control', 'no-store');
  sendOk(res, health, database === 'connected' ? 200 : 503);
});
