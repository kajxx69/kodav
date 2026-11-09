import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { AppError } from './lib/http.js';
import { errorHandler, notFoundHandler } from './middlewares/error.js';
import { mongoSanitize } from './middlewares/sanitize.js';
import { healthRouter } from './modules/health/health.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Derrière le proxy de Render/Railway : IP réelle (rate limiting) et cookies Secure.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Sans origine (curl, sondes de santé) : accepté ; sinon, liste blanche.
        if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
        callback(new AppError(403, 'CORS_FORBIDDEN', 'Origine non autorisée'));
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/v1/health' } }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(mongoSanitize);

  const api = express.Router();
  api.use('/health', healthRouter);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
