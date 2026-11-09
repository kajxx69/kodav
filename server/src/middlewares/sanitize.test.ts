import { describe, expect, it } from 'vitest';
import { sanitizeValue } from './sanitize.js';

describe('sanitizeValue', () => {
  it('retire les opérateurs Mongo et les clés pointées, récursivement', () => {
    const input = {
      email: { $ne: null },
      name: 'Awa',
      nested: { 'a.b': 1, ok: [{ $where: 'x' }, 2] },
    };
    expect(sanitizeValue(input)).toEqual({ email: {}, name: 'Awa', nested: { ok: [{}, 2] } });
  });
});
