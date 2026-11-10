import { z } from 'zod';
import type { INTERVENTION_MODES } from './enums.js';
import { CLIENT_PROFILES } from './enums.js';
import { communeSchema } from './schemas/quote.js';

/**
 * Diagnostic Express : besoins proposés et services correspondants (par slug, dans l'ordre
 * de préférence). L'explication est affichée sous chaque recommandation.
 */
export type DiagnosticNeed = {
  key: string;
  label: string;
  /** Profils pour lesquels le besoin est proposé (tous si absent). */
  profiles?: (typeof CLIENT_PROFILES)[number][];
  services: { slug: string; reason: string }[];
};

export const DIAGNOSTIC_NEEDS: DiagnosticNeed[] = [
  {
    key: 'pc_lent',
    label: 'Un ordinateur lent, bloqué ou en panne',
    services: [
      {
        slug: 'depannage',
        reason: 'Nous identifions la cause et réparons, sur place ou en atelier.',
      },
      {
        slug: 'optimisation-pc',
        reason: 'Nettoyage, mises à jour et réglages pour retrouver un poste réactif.',
      },
      {
        slug: 'assistance-a-distance',
        reason: 'Pour un souci logiciel, une prise en main à distance suffit souvent.',
      },
    ],
  },
  {
    key: 'donnees',
    label: 'Des données perdues ou un disque endommagé',
    services: [
      {
        slug: 'recuperation-de-donnees',
        reason: 'Diagnostic du support puis récupération de vos fichiers quand c’est possible.',
      },
      {
        slug: 'sauvegarde-plan-de-reprise',
        reason: 'Pour ne plus jamais perdre de données : sauvegardes automatiques et vérifiées.',
      },
    ],
  },
  {
    key: 'securite',
    label: 'Des virus, des arnaques ou un besoin de sécurité',
    services: [
      {
        slug: 'antivirus',
        reason: 'Une protection authentique, installée et suivie sur chaque poste.',
      },
      {
        slug: 'securite-pare-feu-vpn',
        reason: 'Pare-feu et accès à distance sécurisé pour protéger tout le réseau.',
      },
    ],
  },
  {
    key: 'wifi',
    label: 'Un Wi-Fi lent, instable ou qui ne couvre pas tout',
    services: [
      {
        slug: 'wifi-professionnel',
        reason: 'Des bornes professionnelles bien placées pour couvrir tous vos espaces.',
      },
      {
        slug: 'installation-reseau-cablage',
        reason: 'Un câblage propre fiabilise les postes fixes et soulage le Wi-Fi.',
      },
    ],
  },
  {
    key: 'reseau',
    label: 'Installer ou refaire le réseau de nos locaux',
    profiles: ['pme', 'ecole', 'grande_entreprise'],
    services: [
      {
        slug: 'installation-reseau-cablage',
        reason: 'Câblage, baie de brassage et switchs, documentés et étiquetés.',
      },
      { slug: 'wifi-professionnel', reason: 'Le Wi-Fi professionnel complète le réseau filaire.' },
      {
        slug: 'windows-server-active-directory',
        reason: 'Comptes utilisateurs, partages et droits centralisés sur un serveur.',
      },
    ],
  },
  {
    key: 'serveur',
    label: 'Centraliser comptes, fichiers et droits sur un serveur',
    profiles: ['pme', 'ecole', 'grande_entreprise'],
    services: [
      {
        slug: 'windows-server-active-directory',
        reason: 'Un serveur pour gérer les comptes, les partages et les imprimantes.',
      },
      {
        slug: 'virtualisation-hyper-v',
        reason: 'Plusieurs serveurs sur une seule machine, plus simples à sauvegarder.',
      },
      {
        slug: 'sauvegarde-plan-de-reprise',
        reason: 'Un serveur sans sauvegarde est un risque : nous mettons en place la reprise.',
      },
    ],
  },
  {
    key: 'salle_info',
    label: 'Équiper une salle informatique',
    profiles: ['ecole', 'pme', 'grande_entreprise'],
    services: [
      {
        slug: 'salle-informatique',
        reason:
          'Étude, fourniture et installation de la salle, prête pour les cours ou les formations.',
      },
      {
        slug: 'installation-reseau-cablage',
        reason: 'Le câblage de chaque poste, raccordé à une baie propre.',
      },
      { slug: 'multimedia', reason: 'Les logiciels pédagogiques et multimédia sur chaque poste.' },
    ],
  },
  {
    key: 'logiciels',
    label: 'Installer des logiciels ou régulariser des licences',
    services: [
      {
        slug: 'microsoft-365-office-windows',
        reason: 'Windows, Office ou Microsoft 365 avec des licences authentiques.',
      },
      {
        slug: 'comptabilite-gestion',
        reason: 'Installation et prise en main de votre logiciel de comptabilité ou de gestion.',
      },
      {
        slug: 'infographie-pao',
        reason: 'Logiciels de création graphique installés et configurés.',
      },
    ],
  },
  {
    key: 'site_web',
    label: 'Un site internet pour présenter mon activité',
    services: [
      {
        slug: 'site-vitrine',
        reason: 'Un site rapide sur mobile, bien référencé à Abidjan, avec WhatsApp.',
      },
    ],
  },
  {
    key: 'vente_en_ligne',
    label: 'Vendre en ligne',
    services: [
      {
        slug: 'site-e-commerce',
        reason: 'Une boutique en ligne avec catalogue, commandes et paiements.',
      },
      {
        slug: 'site-vitrine',
        reason: 'Pour démarrer plus simplement, un site vitrine avec catalogue.',
      },
    ],
  },
  {
    key: 'application',
    label: 'Une application ou un logiciel sur mesure',
    services: [
      {
        slug: 'logiciel-de-gestion',
        reason: 'Un outil de gestion adapté à vos méthodes de travail.',
      },
      {
        slug: 'application-web-mobile',
        reason: 'Une application web ou mobile pour vos clients ou vos équipes.',
      },
    ],
  },
  {
    key: 'excel',
    label: 'Gagner du temps sur Excel et les tableaux de bord',
    services: [
      {
        slug: 'automatisation-excel-vba',
        reason: 'Les tâches répétitives automatisées : moins d’erreurs, plus de temps.',
      },
      {
        slug: 'tableaux-de-bord',
        reason: 'Vos chiffres clés lisibles d’un coup d’œil, mis à jour automatiquement.',
      },
    ],
  },
  {
    key: 'maintenance',
    label: 'Un suivi régulier de notre parc informatique',
    profiles: ['pme', 'ecole', 'grande_entreprise'],
    services: [
      {
        slug: 'contrat-de-maintenance',
        reason: 'Un interlocuteur unique, des délais garantis et des visites planifiées.',
      },
      {
        slug: 'maintenance-preventive',
        reason: 'Des visites régulières pour éviter les pannes plutôt que les subir.',
      },
    ],
  },
  {
    key: 'formation',
    label: 'Former le personnel aux outils informatiques',
    services: [
      {
        slug: 'formation-utilisateurs',
        reason: 'Des sessions pratiques, adaptées au niveau de chacun.',
      },
    ],
  },
];

export const DIAGNOSTIC_URGENCIES = [
  { key: 'tres_urgent', label: 'C’est bloquant, il faut agir vite', urgency: '24h' },
  { key: 'rapide', label: 'Dans les prochains jours', urgency: '48h' },
  { key: 'planifie', label: 'Je planifie, sans urgence', urgency: 'standard' },
] as const;

export const DIAGNOSTIC_MODES = [
  { key: 'sur_site', label: 'Sur place, dans nos locaux ou à domicile' },
  { key: 'distance', label: 'À distance si c’est possible' },
  { key: 'indifferent', label: 'Peu importe, conseillez-moi' },
] as const;

export const diagnosticInputSchema = z.object({
  profile: z.enum(CLIENT_PROFILES, { error: 'Choisissez votre profil' }),
  need: z.string().refine((v) => DIAGNOSTIC_NEEDS.some((n) => n.key === v), 'Choisissez un besoin'),
  urgency: z.enum(['tres_urgent', 'rapide', 'planifie'], { error: 'Choisissez un délai' }),
  mode: z.enum(['sur_site', 'distance', 'indifferent'], { error: 'Choisissez un mode' }),
  commune: communeSchema.optional(),
});
export type DiagnosticInput = z.input<typeof diagnosticInputSchema>;

export type DiagnosticResult = {
  recommendations: { serviceId: string; reason: string }[];
  prefill: {
    profile: (typeof CLIENT_PROFILES)[number];
    urgency: string;
    mode: (typeof INTERVENTION_MODES)[number];
    commune: string | null;
  };
};
