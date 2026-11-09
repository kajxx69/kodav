/**
 * Valeurs par défaut de l'identité de l'entreprise (§0).
 * Elles initialisent la collection Settings au seed ; ensuite, la source de vérité
 * est la base (modifiable dans l'admin), exposée par GET /api/v1/settings/public.
 */
export const defaultBrand = {
  legalName: 'KODAV Technologies',
  shortName: 'KODAV',
  tagline: "L'informatique qui fait avancer votre activité",
  phone: '+225XXXXXXXXXX',
  whatsapp: '+225XXXXXXXXXX',
  email: 'contact@kodav.ci',
  serviceArea: 'Abidjan et environs ; hors Abidjan sur devis',
  openingHours: [
    { days: 'Lundi – vendredi', hours: '8h – 18h' },
    { days: 'Samedi', hours: '9h – 13h' },
  ],
  social: { facebook: '', linkedin: '', instagram: '', tiktok: '' },
} as const;

export type Brand = typeof defaultBrand;
