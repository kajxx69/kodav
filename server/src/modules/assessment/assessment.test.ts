import { ASSESSMENT_QUESTIONS, scoreAssessment } from '@kodav/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { testOutbox } from '../../lib/mailer.js';
import { startTestDatabase, stopTestDatabase, waitUntil } from '../../test/db.js';
import { Lead } from '../leads/lead.model.js';
import { ItAssessment } from './assessment.model.js';

const app = createApp();

const best = Object.fromEntries(ASSESSMENT_QUESTIONS.map((q) => [q.key, q.options[0]!.value]));
const worst = Object.fromEntries(
  ASSESSMENT_QUESTIONS.map((q) => [q.key, q.options[q.options.length - 1]!.value]),
);

const valid = {
  profile: 'pme',
  seats: '6-20',
  answers: { ...best, backup: 'none', wifi: 'single' },
  name: 'Awa Koné',
  email: 'awa@example.ci',
  phone: '07 07 12 34 56',
  company: 'Koné & Fils',
  consent: true,
};

beforeAll(startTestDatabase);
afterAll(stopTestDatabase);

describe('scoreAssessment', () => {
  it('donne 100 aux meilleures réponses et 0 aux pires', () => {
    expect(scoreAssessment(best)).toMatchObject({ score: 100, level: 'bon', weaknesses: [] });
    const low = scoreAssessment(worst);
    expect(low.score).toBe(0);
    expect(low.level).toBe('faible');
    expect(low.weaknesses).toHaveLength(ASSESSMENT_QUESTIONS.length);
  });

  it('classe les points faibles du plus coûteux au moins coûteux', () => {
    const r = scoreAssessment(valid.answers);
    expect(r.score).toBe(86);
    expect(r.weaknesses.map((w) => w.key)).toEqual(['backup', 'wifi']);
  });
});

describe('POST /api/v1/assessments', () => {
  it('refuse un questionnaire incomplet', async () => {
    const { backup: _b, ...answers } = valid.answers;
    const res = await request(app)
      .post('/api/v1/assessments')
      .send({ ...valid, answers });
    expect(res.status).toBe(400);
  });

  it('recalcule le score, enregistre le prospect et envoie le rapport PDF', async () => {
    testOutbox.length = 0;
    const res = await request(app)
      .post('/api/v1/assessments')
      .send({ ...valid, score: 100 });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ received: true, score: 86 });

    const lead = await Lead.findOne({ source: 'bilan' }).lean();
    expect(lead).toMatchObject({ phone: '+2250707123456', profile: 'pme' });
    const assessment = await ItAssessment.findOne().lean();
    expect(assessment).toMatchObject({ score: 86, weakThemes: ['Sauvegardes', 'Wi-Fi'] });
    expect(String(assessment!.lead)).toBe(String(lead!._id));

    await waitUntil(() => testOutbox.length > 0);
    const mail = testOutbox[0]!;
    expect(mail.to).toBe('awa@example.ci');
    expect(mail.subject).toContain('86/100');
    const pdf = mail.attachments![0]!.content as Buffer;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
