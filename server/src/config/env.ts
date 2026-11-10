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
    JWT_ACCESS_TTL: z
      .string()
      .regex(/^\d+[smhd]$/)
      .default('15m'),
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    /** `none` si le front et l'API sont sur deux domaines différents (ex. vercel.app / onrender.com). */
    COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: booleanString,
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().default('KODAV Technologies <contact@kodav.ci>'),
    /** Clé AES-256 (32 octets en base64) des clés de licence confiées. */
    ENCRYPTION_KEY: z.string().optional(),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    /** Dossier des fichiers envoyés quand Cloudinary n'est pas configuré (développement). */
    UPLOAD_DIR: z.string().default('uploads'),
    SEED_ADMIN_EMAIL: z.string().optional(),
    SEED_ADMIN_PASSWORD: z.string().optional(),
    SEED_TEST_PASSWORD: z.string().optional(),
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
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if ((env[key]?.length ?? 0) < 32) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Secret manquant ou trop court (32 caractères minimum)',
        });
      }
    }
    if (Buffer.from(env.ENCRYPTION_KEY ?? '', 'base64').length !== 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['ENCRYPTION_KEY'],
        message: 'Clé manquante ou invalide (32 octets encodés en base64)',
      });
    }
    if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'Doit être différent de JWT_ACCESS_SECRET',
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

// Secrets fixes en test uniquement (jamais utilisés hors de Vitest).
export const env = {
  ...parsed.data,
  JWT_ACCESS_SECRET: parsed.data.JWT_ACCESS_SECRET ?? 'test-access-secret-0123456789abcdefghij',
  JWT_REFRESH_SECRET: parsed.data.JWT_REFRESH_SECRET ?? 'test-refresh-secret-0123456789abcdefghi',
  ENCRYPTION_KEY: parsed.data.ENCRYPTION_KEY ?? Buffer.alloc(32, 7).toString('base64'),
};
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
