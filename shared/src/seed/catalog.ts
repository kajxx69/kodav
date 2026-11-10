import type { ClientProfile, DurationUnit, InterventionMode, PricingMode } from '../enums.js';
import type { ServiceOption } from '../schemas/catalog.js';

/**
 * Catalogue de démarrage (npm run seed). Les prix sont des EXEMPLES
 * (isPlaceholderPrice: true) à remplacer depuis l'admin.
 * Sert aussi de liste de secours pour le pré-rendu quand l'API est injoignable au build.
 */

export type SeedCategory = {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  icon: string;
  order: number;
  seo: { title: string; description: string };
};

export type SeedService = {
  category: string;
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  targetProfiles: ClientProfile[];
  estimatedDuration: { min: number; max: number; unit: DurationUnit };
  pricingMode: PricingMode;
  unitLabel?: string;
  priceMin?: number;
  priceMax?: number;
  options?: ServiceOption[];
  modes: InterventionMode[];
  featured?: boolean;
  seo: { title: string; description: string; keywords: string[] };
};

const ALL: ClientProfile[] = ['particulier', 'pme', 'ecole', 'grande_entreprise'];
const PROS: ClientProfile[] = ['pme', 'ecole', 'grande_entreprise'];

export const seedCategories: SeedCategory[] = [
  {
    slug: 'developpement',
    name: 'Développement',
    shortDescription:
      'Sites, applications et outils sur mesure qui simplifient votre gestion au quotidien.',
    description:
      'Nous concevons des sites vitrines et e-commerce, des applications web et mobiles, des logiciels de gestion sur mesure ainsi que des automatisations Excel/VBA et des tableaux de bord. Chaque projet commence par un cadrage de vos besoins réels, avant la moindre ligne de code.',
    icon: 'code',
    order: 1,
    seo: {
      title: 'Développement web et logiciel à Abidjan',
      description:
        'Sites vitrines, e-commerce, applications web et mobiles, logiciels de gestion et automatisation Excel à Abidjan.',
    },
  },
  {
    slug: 'reseaux-systemes',
    name: 'Réseaux & Systèmes',
    shortDescription:
      'Réseau, Wi-Fi, serveurs et sécurité : une infrastructure fiable, documentée et sauvegardée.',
    description:
      'Installation de réseaux LAN et Wi-Fi professionnels, câblage et baies de brassage, Windows Server et Active Directory, virtualisation Hyper-V, sauvegarde et plan de reprise, pare-feu et VPN, équipement de salles informatiques.',
    icon: 'network',
    order: 2,
    seo: {
      title: 'Installation réseau et systèmes en entreprise à Abidjan',
      description:
        'Réseau LAN, Wi-Fi professionnel, Active Directory, virtualisation, sauvegarde et sécurité pour entreprises et écoles à Abidjan.',
    },
  },
  {
    slug: 'logiciels',
    name: 'Logiciels professionnels',
    shortDescription:
      'Installation, configuration et prise en main de vos logiciels, avec des licences authentiques.',
    description:
      'Comptabilité et gestion, infographie et PAO, multimédia, Microsoft 365, Office et Windows, antivirus : nous installons, configurons et vous accompagnons dans la prise en main. Nous travaillons uniquement avec des licences authentiques.',
    icon: 'app-window',
    order: 3,
    seo: {
      title: 'Installation de logiciels professionnels à Abidjan',
      description:
        'Installation et configuration de logiciels de gestion, PAO, multimédia, Microsoft 365 et antivirus. Licences authentiques uniquement.',
    },
  },
  {
    slug: 'maintenance-support',
    name: 'Maintenance & Support',
    shortDescription:
      'Dépannage sur site, à distance ou en atelier, maintenance préventive et contrats mensuels.',
    description:
      'Dépannage rapide, maintenance préventive, contrats mensuels adaptés à la taille de votre parc, récupération de données et formation de vos utilisateurs.',
    icon: 'wrench',
    order: 4,
    seo: {
      title: 'Maintenance et dépannage informatique à Abidjan',
      description:
        'Dépannage informatique sur site, à distance ou en atelier, maintenance préventive et contrats de maintenance à Abidjan.',
    },
  },
];

export const seedServices: SeedService[] = [
  // --- Développement -------------------------------------------------------
  {
    category: 'developpement',
    slug: 'site-vitrine',
    name: 'Site vitrine',
    shortDescription: 'Un site professionnel, rapide sur mobile et bien référencé localement.',
    longDescription:
      'Un site de quelques pages pour présenter votre activité, rassurer vos prospects et être trouvé sur Google.\n\n- Design sur mesure aux couleurs de votre marque\n- Optimisé pour le mobile et les connexions lentes\n- Formulaire de contact et bouton WhatsApp\n- Référencement local de base et statistiques de visite\n- Prise en main pour modifier vos textes',
    targetProfiles: ALL,
    estimatedDuration: { min: 1, max: 3, unit: 'semaine' },
    pricingMode: 'forfait',
    priceMin: 250000,
    priceMax: 600000,
    options: [
      {
        key: 'pages',
        label: 'Pages supplémentaires',
        type: 'number',
        min: 0,
        max: 20,
        default: 0,
        perUnit: true,
        impact: { kind: 'fixed', min: 25000, max: 40000 },
      },
      {
        key: 'multilingue',
        label: 'Version anglaise',
        type: 'boolean',
        default: false,
        impact: { kind: 'percent', min: 20, max: 30 },
      },
    ],
    modes: ['distance'],
    featured: true,
    seo: {
      title: 'Création de site vitrine à Abidjan',
      description:
        'Création de site vitrine professionnel à Abidjan : rapide sur mobile, bien référencé, avec WhatsApp et formulaire de contact.',
      keywords: ['création site web Abidjan', 'site vitrine Côte d’Ivoire'],
    },
  },
  {
    category: 'developpement',
    slug: 'site-e-commerce',
    name: 'Site e-commerce',
    shortDescription: 'Une boutique en ligne avec catalogue, commandes et suivi des ventes.',
    longDescription:
      'Vendez en ligne avec une boutique pensée pour vos clients ivoiriens.\n\n- Catalogue produits, variantes et stocks\n- Commandes, livraisons et notifications\n- Tableau de bord des ventes\n- Paiement à la livraison ou intégration Mobile Money selon votre prestataire',
    targetProfiles: ['particulier', 'pme', 'grande_entreprise'],
    estimatedDuration: { min: 3, max: 8, unit: 'semaine' },
    pricingMode: 'forfait',
    priceMin: 900000,
    priceMax: 2500000,
    modes: ['distance'],
    seo: {
      title: 'Création de site e-commerce à Abidjan',
      description:
        'Boutique en ligne sur mesure : catalogue, commandes, livraison et tableau de bord.',
      keywords: ['site e-commerce Abidjan', 'boutique en ligne Côte d’Ivoire'],
    },
  },
  {
    category: 'developpement',
    slug: 'application-web-mobile',
    name: 'Application web et mobile',
    shortDescription:
      'Une application sur mesure pour vos clients, vos équipes ou vos partenaires.',
    longDescription:
      'Réservation, suivi de livraisons, portail client, application interne : nous cadrons le besoin, proposons des maquettes, puis livrons par étapes.\n\n- Atelier de cadrage et maquettes\n- Développement itératif avec démonstrations régulières\n- Hébergement, sauvegardes et maintenance évolutive',
    targetProfiles: PROS,
    estimatedDuration: { min: 1, max: 6, unit: 'semaine' },
    pricingMode: 'sur_devis',
    modes: ['distance', 'sur_site'],
    seo: {
      title: 'Développement d’applications web et mobiles à Abidjan',
      description: 'Applications web et mobiles sur mesure, du cadrage à la mise en production.',
      keywords: ['développement application Abidjan'],
    },
  },
  {
    category: 'developpement',
    slug: 'logiciel-de-gestion',
    name: 'Logiciel de gestion sur mesure',
    shortDescription:
      'Stocks, facturation, scolarité, RH : un outil qui colle à votre organisation.',
    longDescription:
      "Quand les logiciels du marché ne correspondent pas à votre façon de travailler, nous développons l'outil adapté.\n\n- Gestion de stocks, facturation, caisse\n- Gestion de scolarité pour les écoles\n- Droits d'accès par profil, exports Excel et PDF\n- Formation des utilisateurs",
    targetProfiles: PROS,
    estimatedDuration: { min: 3, max: 12, unit: 'semaine' },
    pricingMode: 'sur_devis',
    modes: ['distance', 'sur_site'],
    seo: {
      title: 'Logiciel de gestion sur mesure à Abidjan',
      description:
        'Développement de logiciels de gestion sur mesure pour PME, écoles et administrations.',
      keywords: ['logiciel de gestion Abidjan'],
    },
  },
  {
    category: 'developpement',
    slug: 'automatisation-excel-vba',
    name: 'Automatisation Excel / VBA',
    shortDescription: 'Fini les copier-coller : vos fichiers Excel travaillent pour vous.',
    longDescription:
      'Macros, formulaires de saisie, consolidation automatique de fichiers, génération de rapports : nous automatisons vos tâches répétitives sous Excel.',
    targetProfiles: ALL,
    estimatedDuration: { min: 1, max: 5, unit: 'jour' },
    pricingMode: 'par_unite',
    unitLabel: 'heure',
    priceMin: 15000,
    priceMax: 25000,
    modes: ['distance', 'sur_site'],
    seo: {
      title: 'Automatisation Excel et VBA à Abidjan',
      description: 'Macros VBA, formulaires et rapports automatiques sous Excel.',
      keywords: ['formation Excel VBA Abidjan', 'macro Excel'],
    },
  },
  {
    category: 'developpement',
    slug: 'tableaux-de-bord',
    name: 'Tableaux de bord',
    shortDescription: 'Vos chiffres clés réunis et à jour, sur un seul écran.',
    longDescription:
      'Nous connectons vos sources (Excel, logiciel de gestion, base de données) pour construire des tableaux de bord clairs : ventes, trésorerie, effectifs, stocks.',
    targetProfiles: PROS,
    estimatedDuration: { min: 1, max: 3, unit: 'semaine' },
    pricingMode: 'forfait',
    priceMin: 150000,
    priceMax: 500000,
    modes: ['distance'],
    seo: {
      title: 'Tableaux de bord et reporting à Abidjan',
      description: 'Tableaux de bord Excel ou web pour piloter votre activité.',
      keywords: ['tableau de bord entreprise'],
    },
  },

  // --- Réseaux & Systèmes ----------------------------------------------------
  {
    category: 'reseaux-systemes',
    slug: 'installation-reseau-cablage',
    name: 'Installation réseau et câblage',
    shortDescription: 'Un réseau filaire propre, étiqueté et documenté, de la prise à la baie.',
    longDescription:
      'Étude des locaux, câblage structuré, baies de brassage, switchs et étiquetage. Vous recevez un plan du réseau à jour.\n\n- Câblage catégorie 6 et prises RJ45\n- Baie de brassage rangée et étiquetée\n- Tests de chaque prise\n- Documentation remise en fin de chantier',
    targetProfiles: PROS,
    estimatedDuration: { min: 1, max: 5, unit: 'jour' },
    pricingMode: 'par_unite',
    unitLabel: 'poste',
    priceMin: 20000,
    priceMax: 35000,
    options: [
      {
        key: 'baie',
        label: 'Fourniture et installation d’une baie de brassage',
        type: 'boolean',
        default: false,
        impact: { kind: 'fixed', min: 150000, max: 350000 },
      },
    ],
    modes: ['sur_site'],
    featured: true,
    seo: {
      title: 'Installation réseau entreprise à Abidjan',
      description:
        'Câblage réseau, baies de brassage et switchs pour entreprises et écoles à Abidjan.',
      keywords: ['installation réseau entreprise Abidjan', 'câblage réseau'],
    },
  },
  {
    category: 'reseaux-systemes',
    slug: 'wifi-professionnel',
    name: 'Wi-Fi professionnel',
    shortDescription:
      'Une couverture Wi-Fi stable dans tous vos locaux, avec un accès invités séparé.',
    longDescription:
      'Étude de couverture, bornes professionnelles gérées de façon centralisée, réseau invités isolé et contrôle des accès.',
    targetProfiles: PROS,
    estimatedDuration: { min: 1, max: 3, unit: 'jour' },
    pricingMode: 'par_unite',
    unitLabel: 'borne',
    priceMin: 45000,
    priceMax: 80000,
    modes: ['sur_site'],
    seo: {
      title: 'Installation Wi-Fi professionnel à Abidjan',
      description:
        'Wi-Fi professionnel pour bureaux, écoles et commerces : couverture, sécurité, accès invités.',
      keywords: ['wifi professionnel Abidjan'],
    },
  },
  {
    category: 'reseaux-systemes',
    slug: 'windows-server-active-directory',
    name: 'Windows Server et Active Directory',
    shortDescription: 'Comptes centralisés, partages de fichiers et stratégies de sécurité.',
    longDescription:
      "Mise en place d'un domaine Active Directory : comptes utilisateurs, groupes, partages de fichiers avec droits, stratégies de groupe (GPO) et impression centralisée. Idéal pour les salles informatiques des écoles.",
    targetProfiles: PROS,
    estimatedDuration: { min: 2, max: 5, unit: 'jour' },
    pricingMode: 'forfait',
    priceMin: 350000,
    priceMax: 900000,
    modes: ['sur_site', 'distance'],
    seo: {
      title: 'Active Directory et Windows Server à Abidjan',
      description: 'Installation de Windows Server, Active Directory, GPO et partages de fichiers.',
      keywords: ['Active Directory Abidjan', 'Windows Server'],
    },
  },
  {
    category: 'reseaux-systemes',
    slug: 'virtualisation-hyper-v',
    name: 'Virtualisation Hyper-V',
    shortDescription: 'Plusieurs serveurs sur une seule machine, plus simples à sauvegarder.',
    longDescription:
      'Consolidation de vos serveurs sur un hôte Hyper-V, migration des services existants, supervision et sauvegarde des machines virtuelles.',
    targetProfiles: ['pme', 'grande_entreprise'],
    estimatedDuration: { min: 2, max: 10, unit: 'jour' },
    pricingMode: 'sur_devis',
    modes: ['sur_site', 'distance'],
    seo: {
      title: 'Virtualisation Hyper-V à Abidjan',
      description:
        'Virtualisation de serveurs avec Hyper-V : consolidation, migration et sauvegarde.',
      keywords: ['virtualisation Hyper-V'],
    },
  },
  {
    category: 'reseaux-systemes',
    slug: 'sauvegarde-plan-de-reprise',
    name: 'Sauvegarde et plan de reprise',
    shortDescription: 'Vos données sauvegardées automatiquement, et une restauration testée.',
    longDescription:
      'Sauvegardes automatiques sur site et hors site, rétention adaptée, tests de restauration réguliers et procédure écrite en cas de sinistre (panne, vol, rançongiciel).',
    targetProfiles: PROS,
    estimatedDuration: { min: 1, max: 4, unit: 'jour' },
    pricingMode: 'forfait',
    priceMin: 200000,
    priceMax: 600000,
    modes: ['sur_site', 'distance'],
    featured: true,
    seo: {
      title: 'Sauvegarde informatique et plan de reprise à Abidjan',
      description: 'Mise en place de sauvegardes automatiques et d’un plan de reprise d’activité.',
      keywords: ['sauvegarde données entreprise Abidjan'],
    },
  },
  {
    category: 'reseaux-systemes',
    slug: 'securite-pare-feu-vpn',
    name: 'Sécurité : pare-feu et VPN',
    shortDescription: 'Filtrage, accès distant sécurisé et réseau segmenté.',
    longDescription:
      "Installation et configuration d'un pare-feu, VPN pour le télétravail ou les sites distants, segmentation du réseau et journalisation.",
    targetProfiles: PROS,
    estimatedDuration: { min: 1, max: 4, unit: 'jour' },
    pricingMode: 'forfait',
    priceMin: 250000,
    priceMax: 750000,
    modes: ['sur_site', 'distance'],
    seo: {
      title: 'Pare-feu et VPN pour entreprises à Abidjan',
      description: 'Sécurisation du réseau : pare-feu, VPN, segmentation et journalisation.',
      keywords: ['pare-feu entreprise Abidjan', 'VPN'],
    },
  },
  {
    category: 'reseaux-systemes',
    slug: 'salle-informatique',
    name: 'Équipement de salle informatique',
    shortDescription: 'Une salle prête pour les cours ou la formation, du câblage aux postes.',
    longDescription:
      'Conseil sur le matériel, installation des postes, réseau, comptes élèves via Active Directory, logiciels pédagogiques et protection des postes.',
    targetProfiles: ['ecole', 'grande_entreprise'],
    estimatedDuration: { min: 1, max: 3, unit: 'semaine' },
    pricingMode: 'sur_devis',
    modes: ['sur_site'],
    seo: {
      title: 'Équipement de salle informatique pour écoles à Abidjan',
      description:
        'Installation complète de salles informatiques pour écoles et centres de formation.',
      keywords: ['salle informatique école Abidjan'],
    },
  },

  // --- Logiciels professionnels ----------------------------------------------
  {
    category: 'logiciels',
    slug: 'comptabilite-gestion',
    name: 'Logiciels de comptabilité et de gestion',
    shortDescription: 'Sage, EBP, Odoo… installés, paramétrés et pris en main par vos équipes.',
    longDescription:
      'Installation, paramétrage (plan comptable, dossiers, utilisateurs), import de vos données et formation à la prise en main. Licences authentiques uniquement.',
    targetProfiles: ['pme', 'ecole', 'grande_entreprise'],
    estimatedDuration: { min: 1, max: 3, unit: 'jour' },
    pricingMode: 'forfait',
    priceMin: 50000,
    priceMax: 200000,
    modes: ['sur_site', 'distance'],
    featured: true,
    seo: {
      title: 'Installation Sage, EBP et Odoo à Abidjan',
      description:
        'Installation et paramétrage de logiciels de comptabilité et de gestion, licences authentiques.',
      keywords: ['installation Sage Abidjan', 'EBP', 'Odoo'],
    },
  },
  {
    category: 'logiciels',
    slug: 'infographie-pao',
    name: 'Infographie et PAO',
    shortDescription: 'Suites Adobe, CorelDRAW et outils de mise en page prêts à l’emploi.',
    longDescription:
      "Installation et configuration des logiciels de création (Adobe, CorelDRAW…), polices, profils couleur et périphériques d'impression.",
    targetProfiles: ALL,
    estimatedDuration: { min: 1, max: 4, unit: 'heure' },
    pricingMode: 'par_unite',
    unitLabel: 'poste',
    priceMin: 25000,
    priceMax: 60000,
    modes: ['sur_site', 'distance', 'atelier'],
    seo: {
      title: 'Installation de logiciels d’infographie à Abidjan',
      description: 'Installation de logiciels de PAO et d’infographie avec licences authentiques.',
      keywords: ['installation Adobe Abidjan'],
    },
  },
  {
    category: 'logiciels',
    slug: 'multimedia',
    name: 'Logiciels multimédia',
    shortDescription: 'Montage vidéo et audio configurés pour tirer le meilleur de votre machine.',
    longDescription:
      'Installation de logiciels de montage vidéo et audio, codecs, réglages de performance et conseils matériels.',
    targetProfiles: ['particulier', 'pme', 'ecole'],
    estimatedDuration: { min: 1, max: 3, unit: 'heure' },
    pricingMode: 'par_unite',
    unitLabel: 'poste',
    priceMin: 20000,
    priceMax: 50000,
    modes: ['sur_site', 'distance', 'atelier'],
    seo: {
      title: 'Installation de logiciels de montage vidéo à Abidjan',
      description: 'Installation et optimisation de logiciels de montage vidéo et audio.',
      keywords: ['logiciel montage vidéo'],
    },
  },
  {
    category: 'logiciels',
    slug: 'microsoft-365-office-windows',
    name: 'Microsoft 365, Office et Windows',
    shortDescription: 'Messagerie professionnelle, Office et Windows installés proprement.',
    longDescription:
      "Création de vos adresses email professionnelles sur votre nom de domaine, installation d'Office, migration de messagerie, installation ou réinstallation de Windows.",
    targetProfiles: ALL,
    estimatedDuration: { min: 1, max: 3, unit: 'heure' },
    pricingMode: 'par_unite',
    unitLabel: 'poste',
    priceMin: 15000,
    priceMax: 35000,
    modes: ['sur_site', 'distance', 'atelier'],
    featured: true,
    seo: {
      title: 'Installation Microsoft 365 et Windows à Abidjan',
      description:
        'Microsoft 365, messagerie professionnelle, Office et Windows avec licences authentiques.',
      keywords: ['Microsoft 365 Abidjan', 'installation Windows'],
    },
  },
  {
    category: 'logiciels',
    slug: 'antivirus',
    name: 'Antivirus et protection des postes',
    shortDescription: 'Une protection à jour sur chaque poste, gérée de façon centralisée.',
    longDescription:
      'Choix de la solution adaptée, déploiement sur tous les postes, console centralisée pour les entreprises et vérification régulière des mises à jour.',
    targetProfiles: ALL,
    estimatedDuration: { min: 1, max: 2, unit: 'heure' },
    pricingMode: 'par_unite',
    unitLabel: 'poste',
    priceMin: 10000,
    priceMax: 25000,
    modes: ['sur_site', 'distance', 'atelier'],
    seo: {
      title: 'Installation d’antivirus à Abidjan',
      description: 'Installation et gestion d’antivirus pour particuliers et entreprises.',
      keywords: ['antivirus entreprise Abidjan'],
    },
  },

  // --- Maintenance & Support -------------------------------------------------
  {
    category: 'maintenance-support',
    slug: 'depannage',
    name: 'Dépannage informatique',
    shortDescription: 'Panne, écran bleu, imprimante bloquée : on intervient rapidement.',
    longDescription:
      'Diagnostic et réparation sur site, à distance ou dans notre atelier. Le diagnostic vous est expliqué avant toute intervention payante.',
    targetProfiles: ALL,
    estimatedDuration: { min: 1, max: 4, unit: 'heure' },
    pricingMode: 'forfait',
    priceMin: 15000,
    priceMax: 40000,
    modes: ['sur_site', 'distance', 'atelier'],
    featured: true,
    seo: {
      title: 'Dépannage informatique à Abidjan',
      description: 'Dépannage informatique sur site, à distance ou en atelier à Abidjan.',
      keywords: ['dépannage informatique Abidjan', 'réparation ordinateur Abidjan'],
    },
  },
  {
    category: 'maintenance-support',
    slug: 'optimisation-pc',
    name: 'Nettoyage et optimisation de PC',
    shortDescription: 'Un ordinateur lent retrouve sa rapidité, sans perdre vos fichiers.',
    longDescription:
      "Nettoyage logiciel et physique, suppression des programmes inutiles, vérification du disque et de la mémoire, conseils d'évolution (SSD, RAM).",
    targetProfiles: ['particulier', 'pme'],
    estimatedDuration: { min: 1, max: 3, unit: 'heure' },
    pricingMode: 'forfait',
    priceMin: 15000,
    priceMax: 30000,
    modes: ['sur_site', 'atelier', 'distance'],
    seo: {
      title: 'Optimisation de PC lent à Abidjan',
      description: 'Nettoyage et optimisation d’ordinateur lent à Abidjan.',
      keywords: ['PC lent Abidjan'],
    },
  },
  {
    category: 'maintenance-support',
    slug: 'assistance-a-distance',
    name: 'Assistance à distance',
    shortDescription: 'Une aide immédiate par prise en main à distance, sans déplacement.',
    longDescription:
      "Avec votre accord, un technicien prend la main sur votre ordinateur pour résoudre le problème pendant que vous suivez à l'écran.",
    targetProfiles: ALL,
    estimatedDuration: { min: 1, max: 2, unit: 'heure' },
    pricingMode: 'par_unite',
    unitLabel: 'heure',
    priceMin: 10000,
    priceMax: 20000,
    modes: ['distance'],
    seo: {
      title: 'Assistance informatique à distance',
      description: 'Assistance informatique à distance pour particuliers et entreprises.',
      keywords: ['assistance informatique à distance'],
    },
  },
  {
    category: 'maintenance-support',
    slug: 'maintenance-preventive',
    name: 'Maintenance préventive',
    shortDescription: 'Mises à jour, contrôles et nettoyage planifiés avant que la panne arrive.',
    longDescription:
      "Visite planifiée : mises à jour, vérification des sauvegardes et de l'antivirus, nettoyage du matériel, contrôle des onduleurs et rapport écrit.",
    targetProfiles: PROS,
    estimatedDuration: { min: 1, max: 2, unit: 'jour' },
    pricingMode: 'par_unite',
    unitLabel: 'poste',
    priceMin: 8000,
    priceMax: 15000,
    modes: ['sur_site'],
    seo: {
      title: 'Maintenance informatique préventive à Abidjan',
      description: 'Maintenance préventive de parc informatique pour entreprises et écoles.',
      keywords: ['maintenance informatique Abidjan'],
    },
  },
  {
    category: 'maintenance-support',
    slug: 'contrat-de-maintenance',
    name: 'Contrat de maintenance',
    shortDescription:
      'Un forfait mensuel, des délais d’intervention garantis et un interlocuteur unique.',
    longDescription:
      'Trois formules selon la taille de votre parc, avec support à distance, interventions sur site et visites préventives. Comparez-les sur la page des contrats.',
    targetProfiles: PROS,
    estimatedDuration: { min: 1, max: 12, unit: 'semaine' },
    pricingMode: 'sur_devis',
    modes: ['sur_site', 'distance'],
    featured: true,
    seo: {
      title: 'Contrat de maintenance informatique à Abidjan',
      description: 'Contrats de maintenance informatique mensuels pour PME, écoles et entreprises.',
      keywords: ['contrat maintenance informatique Abidjan'],
    },
  },
  {
    category: 'maintenance-support',
    slug: 'recuperation-de-donnees',
    name: 'Récupération de données',
    shortDescription: 'Disque endommagé, fichiers supprimés : nous tentons de les récupérer.',
    longDescription:
      'Diagnostic du support (disque, clé USB, carte mémoire), estimation des chances de récupération, puis récupération uniquement avec votre accord.',
    targetProfiles: ALL,
    estimatedDuration: { min: 1, max: 5, unit: 'jour' },
    pricingMode: 'forfait',
    priceMin: 30000,
    priceMax: 200000,
    modes: ['atelier'],
    seo: {
      title: 'Récupération de données à Abidjan',
      description: 'Récupération de données sur disque dur, clé USB et carte mémoire à Abidjan.',
      keywords: ['récupération de données Abidjan'],
    },
  },
  {
    category: 'maintenance-support',
    slug: 'formation-utilisateurs',
    name: 'Formation des utilisateurs',
    shortDescription: 'Des sessions pratiques adaptées au niveau de vos équipes.',
    longDescription:
      'Bureautique, messagerie, bonnes pratiques de sécurité, logiciels métiers : sessions en petits groupes, dans vos locaux ou à distance, avec un support écrit.',
    targetProfiles: ALL,
    estimatedDuration: { min: 2, max: 8, unit: 'heure' },
    pricingMode: 'par_unite',
    unitLabel: 'heure',
    priceMin: 15000,
    priceMax: 30000,
    modes: ['sur_site', 'distance'],
    seo: {
      title: 'Formation informatique à Abidjan',
      description: 'Formation des utilisateurs : bureautique, sécurité et logiciels métiers.',
      keywords: ['formation informatique Abidjan'],
    },
  },
];

export type SeedPlan = {
  slug: string;
  name: string;
  tagline: string;
  targetProfiles: ClientProfile[];
  basePriceMonthly: number;
  pricePerSeatMonthly: number;
  annualDiscountPercent: number;
  minSeats: number;
  maxSeats: number | null;
  features: { key: string; label: string; value: boolean | string }[];
  sla: { basse: number; normale: number; haute: number; critique: number };
  includedVisitsPerMonth: number;
  remoteSupport: boolean;
  highlighted: boolean;
  order: number;
};

/** Formules d'exemple : prix et délais (SLA, en heures ouvrées) à valider dans l'admin. */
export const seedPlans: SeedPlan[] = [
  {
    slug: 'essentiel',
    name: 'Essentiel',
    tagline: 'Pour les petites structures qui veulent un support fiable.',
    targetProfiles: ['particulier', 'pme'],
    basePriceMonthly: 25000,
    pricePerSeatMonthly: 5000,
    annualDiscountPercent: 10,
    minSeats: 1,
    maxSeats: 10,
    features: [
      { key: 'remote', label: 'Support à distance', value: 'Heures ouvrées' },
      { key: 'onsite', label: 'Interventions sur site', value: 'Facturées à tarif préférentiel' },
      { key: 'preventive', label: 'Visite préventive', value: 'Trimestrielle' },
      { key: 'backup', label: 'Suivi des sauvegardes', value: false },
      { key: 'antivirus', label: 'Suivi antivirus et mises à jour', value: true },
      { key: 'report', label: 'Rapport mensuel', value: false },
    ],
    sla: { basse: 72, normale: 48, haute: 24, critique: 8 },
    includedVisitsPerMonth: 0,
    remoteSupport: true,
    highlighted: false,
    order: 1,
  },
  {
    slug: 'pro',
    name: 'Pro',
    tagline: 'Pour les PME qui dépendent de leur informatique au quotidien.',
    targetProfiles: ['pme', 'grande_entreprise'],
    basePriceMonthly: 50000,
    pricePerSeatMonthly: 7500,
    annualDiscountPercent: 10,
    minSeats: 5,
    maxSeats: 50,
    features: [
      { key: 'remote', label: 'Support à distance', value: 'Heures ouvrées, prioritaire' },
      { key: 'onsite', label: 'Interventions sur site', value: 'Incluses' },
      { key: 'preventive', label: 'Visite préventive', value: 'Mensuelle' },
      { key: 'backup', label: 'Suivi des sauvegardes', value: true },
      { key: 'antivirus', label: 'Suivi antivirus et mises à jour', value: true },
      { key: 'report', label: 'Rapport mensuel', value: true },
    ],
    sla: { basse: 48, normale: 24, haute: 8, critique: 4 },
    includedVisitsPerMonth: 1,
    remoteSupport: true,
    highlighted: true,
    order: 2,
  },
  {
    slug: 'etablissement',
    name: 'Établissement',
    tagline: 'Pour les écoles et centres de formation avec salles informatiques.',
    targetProfiles: ['ecole', 'grande_entreprise'],
    basePriceMonthly: 75000,
    pricePerSeatMonthly: 4000,
    annualDiscountPercent: 15,
    minSeats: 15,
    maxSeats: null,
    features: [
      { key: 'remote', label: 'Support à distance', value: 'Heures ouvrées, prioritaire' },
      { key: 'onsite', label: 'Interventions sur site', value: 'Incluses' },
      { key: 'preventive', label: 'Visite préventive', value: 'Mensuelle' },
      { key: 'backup', label: 'Suivi des sauvegardes', value: true },
      { key: 'antivirus', label: 'Suivi antivirus et mises à jour', value: true },
      { key: 'report', label: 'Rapport mensuel', value: true },
      { key: 'ad', label: 'Gestion des comptes élèves (Active Directory)', value: true },
    ],
    sla: { basse: 48, normale: 24, haute: 8, critique: 4 },
    includedVisitsPerMonth: 1,
    remoteSupport: true,
    highlighted: false,
    order: 3,
  },
];

export const seedFaqs: { question: string; answer: string; category: string }[] = [
  {
    category: 'general',
    question: 'Où intervenez-vous ?',
    answer:
      "Nous intervenons à Abidjan et dans ses environs (Bingerville, Anyama, Songon…). Hors Abidjan, l'intervention est possible sur devis. Une grande partie des problèmes logiciels se règle aussi à distance.",
  },
  {
    category: 'general',
    question: 'Travaillez-vous avec les particuliers ?',
    answer:
      'Oui. Dépannage, ordinateur lent, installation de logiciels ou conseil avant un achat : nous accompagnons aussi les particuliers et les étudiants, sur site, à distance ou dans notre atelier.',
  },
  {
    category: 'devis',
    question: 'Combien coûte une estimation ?',
    answer:
      "L'estimation en ligne est gratuite et sans engagement. Pour les projets plus complexes, nous échangeons avec vous avant de vous envoyer un devis détaillé.",
  },
  {
    category: 'devis',
    question: 'Comment puis-je payer ?',
    answer:
      'Le paiement se fait en espèces, par virement ou par Mobile Money, selon les modalités indiquées sur le devis ou la facture.',
  },
  {
    category: 'logiciels',
    question: 'Installez-vous des logiciels piratés ?',
    answer:
      'Non. Nous installons uniquement des licences authentiques. Elles garantissent les mises à jour de sécurité et vous protègent en cas de contrôle.',
  },
  {
    category: 'support',
    question: "Comment fonctionne l'assistance à distance ?",
    answer:
      "Vous installez un petit logiciel de prise en main à distance, vous nous communiquez le code affiché, et le technicien intervient pendant que vous suivez à l'écran. Vous pouvez interrompre la session à tout moment.",
  },
  {
    category: 'support',
    question: 'Mes données restent-elles confidentielles ?',
    answer:
      "Oui. Nos techniciens n'accèdent qu'aux éléments nécessaires à l'intervention, et vos données personnelles sont traitées conformément à la loi ivoirienne n° 2013-450 relative à la protection des données à caractère personnel.",
  },
  {
    category: 'contrats',
    question: "Un contrat de maintenance m'engage-t-il sur une longue durée ?",
    answer:
      "Les formules sont proposées au mois ou à l'année (avec une remise). Les conditions de résiliation figurent dans le contrat ; nous vous les présentons avant toute signature.",
  },
];

/** Règles tarifaires d'exemple (utilisées par le moteur de prix en phase 3). */
export const seedPricingRules = {
  urgency: [
    { key: 'standard', label: 'Standard', percent: 0 },
    { key: '48h', label: 'Sous 48 h', percent: 25 },
    { key: '24h', label: 'Sous 24 h', percent: 50 },
  ],
  travel: [
    { commune: 'Plateau', fee: 5000 },
    { commune: 'Cocody', fee: 5000 },
    { commune: 'Marcory', fee: 5000 },
    { commune: 'Treichville', fee: 5000 },
    { commune: 'Adjamé', fee: 5000 },
    { commune: 'Attécoubé', fee: 5000 },
    { commune: 'Koumassi', fee: 7500 },
    { commune: 'Yopougon', fee: 7500 },
    { commune: 'Abobo', fee: 7500 },
    { commune: 'Port-Bouët', fee: 7500 },
    { commune: 'Bingerville', fee: 10000 },
    { commune: 'Anyama', fee: 10000 },
    { commune: 'Songon', fee: 12500 },
  ],
  volumeDiscount: [
    { minQuantity: 10, percent: 5 },
    { minQuantity: 25, percent: 10 },
    { minQuantity: 50, percent: 15 },
  ],
};
