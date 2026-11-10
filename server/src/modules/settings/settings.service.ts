import type { PublicSettings } from '@kodav/shared';
import { defaultBrand } from '../../config/brand.js';
import { SETTINGS_KEY, Settings } from './settings.model.js';

/** Paramètres publics ; valeurs par défaut de brand.ts tant que le seed n'a pas tourné. */
export async function getPublicSettings(): Promise<PublicSettings> {
  const doc = await Settings.findOne({ key: SETTINGS_KEY }).lean();
  if (!doc) return { brand: defaultBrand, stats: [] };
  return {
    brand: {
      ...defaultBrand,
      ...doc.brand,
      social: { ...defaultBrand.social, ...doc.brand.social },
    },
    stats: (doc.stats ?? []).filter((s) => s.label && Number.isFinite(s.value)),
  };
}
