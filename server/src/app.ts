import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { AppError } from './lib/http.js';
import { errorHandler, notFoundHandler } from './middlewares/error.js';
import { mongoSanitize } from './middlewares/sanitize.js';
import { adminCatalogRouter } from './modules/admin/admin.catalog.routes.js';
import { adminQuotesRouter } from './modules/admin/admin.quotes.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { diagnosticRouter } from './modules/diagnostic/diagnostic.routes.js';
import { contentRouter } from './modules/content/content.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { contactRouter } from './modules/leads/contact.routes.js';
import { organizationsRouter } from './modules/organizations/organization.routes.js';
import { pricingRouter } from './modules/pricing/pricing.routes.js';
import { quotesRouter } from './modules/quotes/quote.routes.js';
import { plansRouter } from './modules/plans/plans.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';

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
  app.use(cookieParser());
  app.use(mongoSanitize);

  const api = express.Router();
  api.use('/health', healthRouter);
  api.use('/settings', settingsRouter);
  api.use('/catalog', catalogRouter);
  api.use('/plans', plansRouter);
  api.use('/content', contentRouter);
  api.use('/contact', contactRouter);
  api.use('/auth', authRouter);
  api.use('/organizations', organizationsRouter);
  api.use('/pricing', pricingRouter);
  api.use('/diagnostic', diagnosticRouter);
  api.use('/quotes', quotesRouter);
  api.use('/admin/quotes', adminQuotesRouter);
  api.use('/admin', adminCatalogRouter);
  api.use('/admin', adminRouter);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
