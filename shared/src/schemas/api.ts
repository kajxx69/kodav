import { z } from 'zod';

export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export type ApiSuccess<T> = { success: true; data: T };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export const healthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  database: z.enum(['connected', 'connecting', 'disconnected']),
  uptime: z.number(),
  version: z.string(),
  timestamp: z.string(),
});
export type Health = z.infer<typeof healthSchema>;
