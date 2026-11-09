import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { healthSchema } from '@kodav/shared';
import { createApp } from '../../app.js';
import { startTestDatabase, stopTestDatabase } from '../../test/db.js';

const app = createApp();

describe('GET /api/v1/health', () => {
  it('répond 503 « degraded » sans base de données', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('degraded');
  });

  describe('avec base de données', () => {
    beforeAll(startTestDatabase);
    afterAll(stopTestDatabase);

    it('répond 200 « ok » au format uniforme', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = healthSchema.parse(res.body.data);
      expect(data).toMatchObject({ status: 'ok', database: 'connected' });
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });
});

describe('gestion des erreurs', () => {
  it('renvoie une 404 au format { success: false, error }', async () => {
    const res = await request(app).get('/api/v1/inexistant');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('rejette un JSON mal formé en 400', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"a":');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('refuse une origine CORS hors liste blanche', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'https://pirate.example');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CORS_FORBIDDEN');
  });
});
