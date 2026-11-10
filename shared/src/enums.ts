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

/** Libellés et slugs des pages « Solutions » par profil. */
export const PROFILE_META: Record<
  ClientProfile,
  { label: string; plural: string; solutionSlug: string }
> = {
  particulier: { label: 'Particulier', plural: 'Particuliers', solutionSlug: 'particuliers' },
  pme: { label: 'PME / commerce', plural: 'PME et commerces', solutionSlug: 'pme' },
  ecole: { label: 'École', plural: 'Écoles et centres de formation', solutionSlug: 'ecoles' },
  grande_entreprise: {
    label: 'Grande entreprise',
    plural: 'Grandes entreprises et administrations',
    solutionSlug: 'entreprises',
  },
};

export const INTERVENTION_MODE_LABELS: Record<InterventionMode, string> = {
  sur_site: 'Sur site',
  distance: 'À distance',
  atelier: 'En atelier',
};

export const PRICING_MODES = ['forfait', 'par_unite', 'sur_devis'] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

export const DURATION_UNITS = ['heure', 'jour', 'semaine'] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];

export const LEAD_SOURCES = ['diagnostic', 'bilan', 'contact', 'devis_visiteur'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STATUSES = ['nouveau', 'contacte', 'converti', 'perdu'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const TICKET_PRIORITIES = ['basse', 'normale', 'haute', 'critique'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const ORG_ROLES = ['owner', 'member'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  client: 'Client',
  technicien: 'Technicien',
  admin: 'Administrateur',
};

/** Page d'accueil de chaque rôle après connexion. */
export const ROLE_HOME: Record<UserRole, string> = {
  client: '/espace-client',
  technicien: '/technicien',
  admin: '/admin',
};
