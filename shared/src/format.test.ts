import { describe, expect, it } from 'vitest';
import { formatCiPhone, formatFcfa, formatReference, normalizeCiPhone } from './format.js';

describe('formatFcfa', () => {
  it('formate les montants avec des espaces', () => {
    expect(formatFcfa(150000)).toBe('150 000 FCFA');
    expect(formatFcfa(0)).toBe('0 FCFA');
  });
});

describe('numéros ivoiriens', () => {
  it('normalise les saisies courantes', () => {
    expect(normalizeCiPhone('07 07 12 34 56')).toBe('+2250707123456');
    expect(normalizeCiPhone('00225 0707123456')).toBe('+2250707123456');
    expect(normalizeCiPhone('+225 07 07 12 34 56')).toBe('+2250707123456');
    expect(normalizeCiPhone('12345')).toBeNull();
  });
  it('affiche par paires', () => {
    expect(formatCiPhone('+2250707123456')).toBe('+225 07 07 12 34 56');
  });
});

describe('formatReference', () => {
  it('complète sur 4 chiffres', () => {
    expect(formatReference('DEV', 2026, 7)).toBe('DEV-2026-0007');
  });
});
