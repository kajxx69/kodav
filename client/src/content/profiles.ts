import type { ClientProfile } from '@kodav/shared';

/**
 * Textes du parcours adaptatif « Je suis… » et des pages Solutions.
 * Contenu éditorial versionné avec le code ; les textes clés deviendront éditables
 * depuis l'admin (Settings.pages) en phase 6.
 */

export type ProfileContent = {
  heroLead: string;
  highlights: string[];
  useCases: { title: string; description: string }[];
  primaryCta: { label: string; to: string };
  secondaryCta: { label: string; to: string };
  /** Afficher l'aperçu des contrats de maintenance sur l'accueil. */
  showPlans: boolean;
};

export const genericContent: ProfileContent = {
  heroLead:
    'Développement, réseaux, logiciels et maintenance : un seul interlocuteur pour une informatique fiable, à Abidjan et alentour.',
  highlights: [
    'Sur site, à distance ou en atelier',
    'Licences authentiques uniquement',
    'Estimation en ligne, sans engagement',
  ],
  useCases: [
    {
      title: 'Un poste ou un réseau qui flanche',
      description: 'Diagnostic rapide, explication claire, réparation sur site ou à distance.',
    },
    {
      title: 'Un projet à lancer',
      description:
        'Site web, application, réseau ou salle informatique : cadrage, devis, livraison.',
    },
    {
      title: 'Un parc à entretenir',
      description: 'Contrats de maintenance avec délais d’intervention et visites préventives.',
    },
  ],
  primaryCta: { label: 'Demander un devis', to: '/devis' },
  secondaryCta: { label: 'Lancer le diagnostic', to: '/diagnostic' },
  showPlans: true,
};

export const profileContent: Record<ClientProfile, ProfileContent> = {
  particulier: {
    heroLead:
      'Ordinateur lent, panne, installation de logiciels ou conseil avant un achat : nous intervenons chez vous, à distance ou dans notre atelier.',
    highlights: [
      'Diagnostic expliqué avant toute réparation',
      'Assistance à distance immédiate',
      'Licences authentiques uniquement',
    ],
    useCases: [
      {
        title: 'Mon PC est devenu très lent',
        description:
          'Nettoyage, optimisation et conseils d’évolution (SSD, mémoire) sans perdre vos fichiers.',
      },
      {
        title: 'J’ai perdu des fichiers importants',
        description:
          'Diagnostic du disque ou de la clé, puis récupération uniquement avec votre accord.',
      },
      {
        title: 'Je dois installer un logiciel pour mes études',
        description:
          'Installation et prise en main d’Office, de logiciels de création ou de montage.',
      },
    ],
    primaryCta: { label: 'Réserver une intervention', to: '/rendez-vous' },
    secondaryCta: { label: 'Lancer le diagnostic', to: '/diagnostic' },
    showPlans: false,
  },
  pme: {
    heroLead:
      'Réseau, logiciels de gestion, site web et maintenance mensuelle : votre informatique tient la route pendant que vous développez votre activité.',
    highlights: [
      'Contrats mensuels avec délais garantis',
      'Réseau et sauvegardes documentés',
      'Un interlocuteur unique pour tout le parc',
    ],
    useCases: [
      {
        title: 'Équiper de nouveaux bureaux',
        description:
          'Câblage, Wi-Fi professionnel, imprimantes partagées et sauvegardes dès le premier jour.',
      },
      {
        title: 'Passer à un logiciel de gestion',
        description:
          'Installation, paramétrage et formation sur Sage, EBP ou Odoo, avec licences authentiques.',
      },
      {
        title: 'Être visible en ligne',
        description: 'Site vitrine rapide sur mobile, référencé localement, avec WhatsApp intégré.',
      },
    ],
    primaryCta: { label: 'Demander un devis', to: '/devis' },
    secondaryCta: { label: 'Comparer les contrats', to: '/contrats-maintenance' },
    showPlans: true,
  },
  ecole: {
    heroLead:
      'Salles informatiques, comptes élèves, réseau et contrats annuels : des équipements prêts pour chaque rentrée.',
    highlights: [
      'Salles informatiques clés en main',
      'Comptes élèves centralisés (Active Directory)',
      'Contrats annuels adaptés au calendrier scolaire',
    ],
    useCases: [
      {
        title: 'Ouvrir ou rénover une salle informatique',
        description:
          'Conseil matériel, installation des postes, réseau et protection des machines.',
      },
      {
        title: 'Gérer les comptes des élèves',
        description:
          'Comptes centralisés, droits par classe et postes réinitialisés après chaque session.',
      },
      {
        title: 'Préparer la rentrée',
        description:
          'Visite préventive, mises à jour et vérification de tout le parc avant l’arrivée des élèves.',
      },
    ],
    primaryCta: { label: 'Demander un devis', to: '/devis' },
    secondaryCta: { label: 'Voir la formule Établissement', to: '/contrats-maintenance' },
    showPlans: true,
  },
  grande_entreprise: {
    heroLead:
      'Projets d’infrastructure, développement sur mesure et renfort technique, avec des documents formels à chaque étape.',
    highlights: [
      'Devis PDF détaillés et rapports d’intervention',
      'Infrastructure documentée et sécurisée',
      'Renfort ponctuel de vos équipes',
    ],
    useCases: [
      {
        title: 'Moderniser une infrastructure',
        description:
          'Virtualisation, Active Directory, sauvegarde et plan de reprise, pare-feu et VPN.',
      },
      {
        title: 'Développer un outil métier',
        description:
          'Application web ou logiciel de gestion sur mesure, livré par étapes avec démonstrations.',
      },
      {
        title: 'Renforcer votre équipe IT',
        description:
          'Intervention d’un technicien pour un déploiement, un pic d’activité ou un remplacement.',
      },
    ],
    primaryCta: { label: 'Demander un devis', to: '/devis' },
    secondaryCta: { label: 'Nous contacter', to: '/contact' },
    showPlans: false,
  },
};

/** Contenu des pages /solutions/:profil. */
export const solutionPages: Record<
  ClientProfile,
  { title: string; seoTitle: string; description: string; intro: string; pains: string[] }
> = {
  particulier: {
    title: 'Une aide informatique simple, pour vous et votre famille',
    seoTitle: 'Dépannage informatique pour particuliers à Abidjan',
    description:
      'Dépannage, optimisation de PC lent, installation de logiciels et conseil d’achat pour les particuliers et étudiants à Abidjan.',
    intro:
      'Nous expliquons ce qui ne va pas avant d’intervenir, et vous indiquons le coût avant toute réparation.',
    pains: [
      'Un ordinateur lent ou qui plante',
      'Un virus ou des fenêtres publicitaires',
      'Un logiciel à installer pour les cours ou le travail',
      'Un conseil avant d’acheter un ordinateur',
    ],
  },
  pme: {
    title: 'L’informatique d’une PME, sans service informatique',
    seoTitle: 'Informatique pour PME et commerces à Abidjan',
    description:
      'Réseau, logiciels de gestion, site web et maintenance mensuelle pour les PME et commerces d’Abidjan.',
    intro:
      'Nous prenons en charge votre parc comme le ferait un service informatique interne, à la carte ou au mois.',
    pains: [
      'Un réseau qui coupe aux pires moments',
      'Des sauvegardes jamais vérifiées',
      'Des logiciels sans licence ni mise à jour',
      'Personne à appeler quand tout s’arrête',
    ],
  },
  ecole: {
    title: 'Des salles informatiques prêtes pour chaque cours',
    seoTitle: 'Informatique pour écoles et centres de formation à Abidjan',
    description:
      'Équipement de salles informatiques, Active Directory, réseau et contrats annuels pour écoles et centres de formation à Abidjan.',
    intro:
      'Nous équipons et maintenons vos salles pour que chaque séance commence à l’heure, sur des postes propres.',
    pains: [
      'Des postes déréglés après chaque cours',
      'Des comptes élèves partagés et des mots de passe affichés',
      'Un Wi-Fi saturé aux heures de pointe',
      'Une rentrée qui arrive avant les réparations',
    ],
  },
  grande_entreprise: {
    title: 'Un partenaire technique pour vos projets d’envergure',
    seoTitle: 'Infrastructure et développement pour grandes entreprises à Abidjan',
    description:
      'Projets d’infrastructure, développement sur mesure et renfort technique pour grandes entreprises et administrations à Abidjan.',
    intro:
      'Nous travaillons avec vos équipes et vos processus : cadrage écrit, devis formels, rapports d’intervention et documentation.',
    pains: [
      'Une infrastructure qui a grandi sans plan d’ensemble',
      'Un projet logiciel qui manque de bras',
      'Des exigences de traçabilité et de documents formels',
      'Un besoin de renfort ponctuel et qualifié',
    ],
  },
};

/** Méthode en 4 étapes (accueil). */
export const methodSteps = [
  {
    title: 'Vous nous décrivez le besoin',
    description:
      'En ligne, par WhatsApp ou par téléphone. Le diagnostic express vous guide en quelques questions.',
  },
  {
    title: 'Nous vous proposons une solution chiffrée',
    description: 'Une estimation immédiate, puis un devis détaillé, valable 30 jours.',
  },
  {
    title: 'Nous intervenons',
    description:
      'Sur site, à distance ou en atelier, avec un suivi en temps réel de l’intervention.',
  },
  {
    title: 'Vous validez, nous restons disponibles',
    description:
      'Rapport d’intervention signé, documents dans votre espace client et support après livraison.',
  },
];
