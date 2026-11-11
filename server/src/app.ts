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
import { adminAppointmentsRouter } from './modules/admin/admin.appointments.routes.js';
import { backofficeRouter } from './modules/admin/admin.backoffice.routes.js';
import {
  adminContentRouter,
  clientTestimonialsRouter,
} from './modules/admin/admin.content.routes.js';
import {
  adminInvoicesRouter,
  documentsRouter,
  invoicesRouter,
  subscriptionsRouter,
} from './modules/billing/billing.routes.js';
import { adminCatalogRouter } from './modules/admin/admin.catalog.routes.js';
import { adminQuotesRouter } from './modules/admin/admin.quotes.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import {
  appointmentsRouter,
  availabilityRouter,
  trackingRouter,
} from './modules/appointments/appointment.routes.js';
import {
  adminAssetsRouter,
  assetsRouter,
  notificationsRouter,
} from './modules/support/asset.routes.js';
import { staffTicketsRouter, ticketsRouter } from './modules/support/ticket.routes.js';
import { technicianRouter } from './modules/appointments/technician.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { assessmentRouter } from './modules/assessment/assessment.routes.js';
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
      // Nom des fichiers téléchargés (exports CSV) lisible par le front.
      exposedHeaders: ['Content-Disposition'],
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
  // Avant le routeur public (mis en cache) : dépôt d'un avis par un client connecté.
  api.use('/content/testimonials', clientTestimonialsRouter);
  api.use('/content', contentRouter);
  api.use('/contact', contactRouter);
  api.use('/auth', authRouter);
  api.use('/organizations', organizationsRouter);
  api.use('/pricing', pricingRouter);
  api.use('/diagnostic', diagnosticRouter);
  api.use('/assessments', assessmentRouter);
  api.use('/quotes', quotesRouter);
  api.use('/availability', availabilityRouter);
  api.use('/appointments', appointmentsRouter);
  api.use('/tracking', trackingRouter);
  api.use('/technician', technicianRouter);
  api.use('/tickets', ticketsRouter);
  api.use('/assets', assetsRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/admin/tickets', staffTicketsRouter);
  api.use('/admin/assets', adminAssetsRouter);
  api.use('/invoices', invoicesRouter);
  api.use('/documents', documentsRouter);
  api.use('/subscriptions', subscriptionsRouter);
  api.use('/admin/invoices', adminInvoicesRouter);
  api.use('/admin/content', adminContentRouter);
  api.use('/admin', backofficeRouter);
  api.use('/admin/quotes', adminQuotesRouter);
  api.use('/admin', adminAppointmentsRouter);
  api.use('/admin', adminCatalogRouter);
  api.use('/admin', adminRouter);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
