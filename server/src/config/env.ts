import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Le fichier .env est à la racine du monorepo (src/config ou dist/config → ../../..).
loadDotenv({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });

const booleanString = z
  .enum(['true', 'false', ''])
  .optional()
  .transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    API_URL: z.url().default('http://localhost:4000'),
    CLIENT_URL: z.url().default('http://localhost:5173'),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    MONGODB_URI: z.string().optional(),
    JWT_ACCESS_SECRET: z.string().optional(),
    JWT_REFRESH_SECRET: z.string().optional(),
    TURNSTILE_ENABLED: booleanString,
    TURNSTILE_SECRET_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'test') return;
    if (!env.MONGODB_URI?.match(/^mongodb(\+srv)?:\/\//)) {
      ctx.addIssue({
        code: 'custom',
        path: ['MONGODB_URI'],
        message: 'MONGODB_URI manquante ou invalide (mongodb:// ou mongodb+srv://)',
      });
    }
    if (env.TURNSTILE_ENABLED && !env.TURNSTILE_SECRET_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['TURNSTILE_SECRET_KEY'],
        message: 'TURNSTILE_SECRET_KEY requise quand TURNSTILE_ENABLED=true',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // Le logger dépend de env : on écrit directement sur stderr, sans afficher de valeur.
  process.stderr.write(`Configuration invalide (.env) :\n${issues}\n`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
