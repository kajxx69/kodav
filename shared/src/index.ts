import { z } from 'zod';

// Messages d'erreur par défaut de Zod en français (front et back).
z.config(z.locales.fr());

export * from './diagnostic.js';
export * from './enums.js';
export * from './format.js';
export * from './schemas/api.js';
export * from './schemas/appointment.js';
export * from './schemas/auth.js';
export * from './schemas/backoffice.js';
export * from './schemas/catalog.js';
export * from './schemas/contact.js';
export * from './schemas/content.js';
export * from './schemas/plans.js';
export * from './schemas/quote.js';
export * from './schemas/settings.js';
export * from './schemas/support.js';
