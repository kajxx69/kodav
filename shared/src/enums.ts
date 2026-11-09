export const USER_ROLES = ['client', 'technicien', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CLIENT_PROFILES = ['particulier', 'pme', 'ecole', 'grande_entreprise'] as const;
export type ClientProfile = (typeof CLIENT_PROFILES)[number];

export const INTERVENTION_MODES = ['sur_site', 'distance', 'atelier'] as const;
export type InterventionMode = (typeof INTERVENTION_MODES)[number];

export const ABIDJAN_COMMUNES = [
  'Abobo',
  'Adjamé',
  'Anyama',
  'Attécoubé',
  'Bingerville',
  'Cocody',
  'Koumassi',
  'Marcory',
  'Plateau',
  'Port-Bouët',
  'Songon',
  'Treichville',
  'Yopougon',
] as const;
export type AbidjanCommune = (typeof ABIDJAN_COMMUNES)[number];
