import { z } from 'zod';
import { CLIENT_PROFILES } from './enums.js';
import { ciPhoneSchema } from './schemas/contact.js';

/**
 * Bilan de santé informatique : 12 questions, 100 points au total. Chaque point faible est relié
 * au service du catalogue qui y répond (par slug). Le barème est indicatif, il ne remplace pas
 * un audit sur place.
 */
export type AssessmentQuestion = {
  key: string;
  theme: string;
  label: string;
  help?: string;
  options: { value: string; label: string; points: number }[];
  weakness: string;
  recommendation: string;
  serviceSlug: string;
};

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    key: 'backup',
    theme: 'Sauvegardes',
    label: 'À quelle fréquence vos données importantes sont-elles sauvegardées ?',
    options: [
      { value: 'daily', label: 'Automatiquement, chaque jour', points: 10 },
      { value: 'weekly', label: 'Chaque semaine', points: 6 },
      { value: 'manual', label: 'De temps en temps, à la main', points: 2 },
      { value: 'none', label: 'Jamais, ou je ne sais pas', points: 0 },
    ],
    weakness: 'Une panne de disque, un vol ou un rançongiciel peut faire perdre des données.',
    recommendation:
      'Mettre en place une sauvegarde automatique quotidienne, avec une copie hors des locaux.',
    serviceSlug: 'sauvegarde-plan-de-reprise',
  },
  {
    key: 'restore',
    theme: 'Restauration',
    label: 'Avez-vous déjà vérifié qu’une sauvegarde peut être restaurée ?',
    options: [
      { value: 'regular', label: 'Oui, régulièrement', points: 6 },
      { value: 'once', label: 'Une fois', points: 3 },
      { value: 'never', label: 'Jamais', points: 0 },
    ],
    weakness: 'Une sauvegarde jamais testée peut se révéler inutilisable le jour où il le faut.',
    recommendation: 'Tester une restauration chaque trimestre et noter le temps nécessaire.',
    serviceSlug: 'sauvegarde-plan-de-reprise',
  },
  {
    key: 'antivirus',
    theme: 'Antivirus',
    label: 'Vos postes sont-ils protégés par un antivirus à jour ?',
    options: [
      { value: 'all', label: 'Tous, avec une licence professionnelle suivie', points: 10 },
      { value: 'most', label: 'La plupart', points: 5 },
      { value: 'free', label: 'Antivirus gratuit ou licence expirée', points: 2 },
      { value: 'none', label: 'Aucun, ou je ne sais pas', points: 0 },
    ],
    weakness: 'Des postes mal protégés exposent tout le réseau aux virus et aux arnaques.',
    recommendation: 'Équiper chaque poste d’un antivirus authentique dont la licence est suivie.',
    serviceSlug: 'antivirus',
  },
  {
    key: 'updates',
    theme: 'Mises à jour',
    label: 'Windows et vos logiciels sont-ils mis à jour ?',
    options: [
      { value: 'auto', label: 'Automatiquement, et nous le contrôlons', points: 8 },
      { value: 'sometimes', label: 'Quand nous y pensons', points: 3 },
      { value: 'never', label: 'Rarement, ou versions plus maintenues (Windows 7…)', points: 0 },
    ],
    weakness: 'Les failles connues et non corrigées sont la première porte d’entrée des attaques.',
    recommendation: 'Planifier les mises à jour et remplacer les systèmes qui ne sont plus suivis.',
    serviceSlug: 'maintenance-preventive',
  },
  {
    key: 'licenses',
    theme: 'Licences',
    label: 'Vos logiciels (Windows, Office…) sont-ils sous licence officielle ?',
    options: [
      { value: 'all', label: 'Tous', points: 8 },
      { value: 'some', label: 'En partie', points: 3 },
      { value: 'none', label: 'Non, ou je ne sais pas', points: 0 },
    ],
    weakness: 'Les versions sans licence ne reçoivent pas toutes les mises à jour de sécurité.',
    recommendation: 'Régulariser les licences Windows et Office, ou passer à Microsoft 365.',
    serviceSlug: 'microsoft-365-office-windows',
  },
  {
    key: 'passwords',
    theme: 'Mots de passe',
    label: 'Comment les mots de passe sont-ils gérés ?',
    options: [
      {
        value: 'strong',
        label: 'Personnels, robustes, double authentification sur la messagerie',
        points: 10,
      },
      { value: 'weak', label: 'Personnels, mais simples ou réutilisés', points: 4 },
      { value: 'shared', label: 'Partagés entre collègues, ou notés sur papier', points: 0 },
    ],
    weakness: 'Un mot de passe deviné ou partagé suffit pour accéder à vos emails et fichiers.',
    recommendation:
      'Former les utilisateurs aux bons réflexes et activer la double authentification.',
    serviceSlug: 'formation-utilisateurs',
  },
  {
    key: 'accounts',
    theme: 'Comptes utilisateurs',
    label: 'Chaque utilisateur a-t-il son propre compte, sans droits d’administrateur ?',
    options: [
      { value: 'central', label: 'Oui, avec des comptes gérés de façon centrale', points: 6 },
      { value: 'local', label: 'Un compte par personne, créé sur chaque poste', points: 3 },
      { value: 'shared', label: 'Un compte commun pour tout le monde', points: 0 },
    ],
    weakness:
      'Avec un compte commun, impossible de savoir qui a fait quoi ni de limiter les accès.',
    recommendation: 'Centraliser les comptes et les droits d’accès sur un serveur.',
    serviceSlug: 'windows-server-active-directory',
  },
  {
    key: 'wifi',
    theme: 'Wi-Fi',
    label: 'Comment votre Wi-Fi est-il protégé ?',
    options: [
      {
        value: 'separate',
        label: 'Un réseau séparé pour les visiteurs ou les élèves, mot de passe robuste',
        points: 8,
      },
      { value: 'single', label: 'Un seul réseau, mot de passe changé récemment', points: 4 },
      { value: 'default', label: 'Mot de passe d’origine, ou connu de tous', points: 0 },
    ],
    weakness: 'Un visiteur connecté au même réseau que vos postes peut atteindre vos données.',
    recommendation: 'Séparer le réseau interne du réseau invités et sécuriser les bornes.',
    serviceSlug: 'wifi-professionnel',
  },
  {
    key: 'firewall',
    theme: 'Pare-feu',
    label: 'Votre connexion internet est-elle protégée par un pare-feu configuré ?',
    options: [
      { value: 'dedicated', label: 'Oui, un pare-feu dédié', points: 6 },
      { value: 'box', label: 'Seulement la box de l’opérateur', points: 3 },
      { value: 'unknown', label: 'Je ne sais pas', points: 0 },
    ],
    weakness: 'Sans filtrage, le réseau est exposé et l’accès à distance n’est pas sécurisé.',
    recommendation: 'Installer un pare-feu et un accès VPN pour le travail à distance.',
    serviceSlug: 'securite-pare-feu-vpn',
  },
  {
    key: 'power',
    theme: 'Alimentation électrique',
    label: 'Vos équipements sont-ils protégés contre les coupures et les surtensions ?',
    options: [
      { value: 'ups', label: 'Onduleurs sur le serveur et les postes importants', points: 10 },
      { value: 'surge', label: 'Multiprises parafoudres seulement', points: 4 },
      { value: 'none', label: 'Aucune protection', points: 0 },
    ],
    weakness: 'Coupures et surtensions endommagent le matériel et corrompent les fichiers ouverts.',
    recommendation: 'Installer des onduleurs adaptés et contrôler leurs batteries chaque année.',
    serviceSlug: 'maintenance-preventive',
  },
  {
    key: 'upkeep',
    theme: 'Entretien du matériel',
    label: 'Votre matériel est-il entretenu régulièrement (nettoyage, contrôle) ?',
    options: [
      { value: 'contract', label: 'Oui, dans le cadre d’un contrat de maintenance', points: 8 },
      { value: 'sometimes', label: 'De temps en temps', points: 4 },
      { value: 'breakdown', label: 'Seulement en cas de panne', points: 0 },
    ],
    weakness:
      'Poussière, chaleur et usure raccourcissent la vie du matériel et provoquent des pannes.',
    recommendation: 'Prévoir un entretien préventif régulier de chaque poste.',
    serviceSlug: 'contrat-de-maintenance',
  },
  {
    key: 'support',
    theme: 'Assistance',
    label: 'Que se passe-t-il quand un utilisateur rencontre un problème informatique ?',
    options: [
      {
        value: 'sameday',
        label: 'Un prestataire ou un référent répond dans la journée',
        points: 10,
      },
      { value: 'days', label: 'Nous nous débrouillons, cela prend plusieurs jours', points: 3 },
      { value: 'nobody', label: 'Personne n’en est vraiment chargé', points: 0 },
    ],
    weakness: 'Chaque panne immobilise un collaborateur ou une classe, parfois plusieurs jours.',
    recommendation: 'Disposer d’un interlocuteur unique avec des délais d’intervention garantis.',
    serviceSlug: 'contrat-de-maintenance',
  },
];

export const ASSESSMENT_MAX_SCORE = ASSESSMENT_QUESTIONS.reduce(
  (sum, q) => sum + Math.max(...q.options.map((o) => o.points)),
  0,
);

export const ASSESSMENT_SEATS = ['1-5', '6-20', '21-50', '50+'] as const;
export const ASSESSMENT_SEAT_LABELS: Record<(typeof ASSESSMENT_SEATS)[number], string> = {
  '1-5': '1 à 5 postes',
  '6-20': '6 à 20 postes',
  '21-50': '21 à 50 postes',
  '50+': 'Plus de 50 postes',
};

export type AssessmentLevel = 'bon' | 'moyen' | 'faible';
export const ASSESSMENT_LEVELS: Record<AssessmentLevel, { label: string; summary: string }> = {
  bon: {
    label: 'Bon niveau',
    summary: 'Les bases sont en place. Quelques points restent à consolider.',
  },
  moyen: {
    label: 'À renforcer',
    summary: 'Plusieurs risques réels, que des actions simples peuvent réduire nettement.',
  },
  faible: {
    label: 'Risque élevé',
    summary: 'Votre activité est exposée à une perte de données ou à un arrêt prolongé.',
  },
};

export type AssessmentAnswers = Record<string, string>;

export type AssessmentWeakness = {
  key: string;
  theme: string;
  answer: string;
  pointsLost: number;
  weakness: string;
  recommendation: string;
  serviceSlug: string;
};

export type AssessmentResult = {
  score: number;
  level: AssessmentLevel;
  weaknesses: AssessmentWeakness[];
};

/** Score sur 100 et points faibles, du plus coûteux au moins coûteux. */
export function scoreAssessment(answers: AssessmentAnswers): AssessmentResult {
  let earned = 0;
  const weaknesses: AssessmentWeakness[] = [];
  for (const q of ASSESSMENT_QUESTIONS) {
    const max = Math.max(...q.options.map((o) => o.points));
    const option = q.options.find((o) => o.value === answers[q.key]);
    const points = option?.points ?? 0;
    earned += points;
    if (points < max) {
      weaknesses.push({
        key: q.key,
        theme: q.theme,
        answer: option?.label ?? 'Sans réponse',
        pointsLost: max - points,
        weakness: q.weakness,
        recommendation: q.recommendation,
        serviceSlug: q.serviceSlug,
      });
    }
  }
  const score = Math.round((earned / ASSESSMENT_MAX_SCORE) * 100);
  weaknesses.sort((a, b) => b.pointsLost - a.pointsLost);
  return { score, level: score >= 80 ? 'bon' : score >= 50 ? 'moyen' : 'faible', weaknesses };
}

const answersSchema = z
  .record(z.string(), z.string().max(40))
  .refine(
    (answers) =>
      ASSESSMENT_QUESTIONS.every((q) => q.options.some((o) => o.value === answers[q.key])),
    { message: 'Répondez à toutes les questions' },
  );

export const assessmentInputSchema = z.object({
  profile: z.enum(CLIENT_PROFILES),
  seats: z.enum(ASSESSMENT_SEATS),
  answers: answersSchema,
  name: z.string().trim().min(2, 'Indiquez votre nom').max(120),
  email: z.email('Adresse email invalide').trim().toLowerCase().max(200),
  phone: ciPhoneSchema,
  company: z.string().trim().max(160).optional().default(''),
  consent: z.literal(true, { error: 'Votre accord est nécessaire pour recevoir le rapport' }),
  website: z.string().max(500).optional().default(''),
});
export type AssessmentInput = z.input<typeof assessmentInputSchema>;
