# Mission : construire la plateforme web de KODAV Technologies

Tu es un développeur full-stack senior doublé d'un designer produit. Tu vas construire, phase par phase, la plateforme web complète d'une entreprise de services informatiques basée à Abidjan (Côte d'Ivoire).

Objectif : une plateforme dynamique, interactive et haut de gamme, qui se distingue nettement des sites d'informatique classiques, et qui transforme les visiteurs en demandes de devis, rendez-vous et contrats de maintenance.

**Lis tout ce document avant d'écrire la moindre ligne de code.**

---

## 0. Informations de l'entreprise (placeholders)

Centralise ces valeurs dans une configuration unique : valeurs par défaut dans `server/src/config/brand.ts`, stockées ensuite dans la collection `Settings` (modifiable depuis l'admin) et exposées au front par `GET /api/v1/settings/public`. Ne les écris jamais en dur dans les composants : changer le nom de l'entreprise doit se faire à un seul endroit.

- Nom officiel (devis, factures, mentions légales, pied de page) : **KODAV Technologies**
- Nom de marque court (logo, header, titres d'onglet, réseaux sociaux) : **KODAV**
- Slogan : « L'informatique qui fait avancer votre activité » (provisoire)
- Téléphone : +225 XX XX XX XX XX
- WhatsApp : +225 XX XX XX XX XX
- Email : contact@kodav.ci (à confirmer selon le domaine réservé)
- Zone d'intervention : Abidjan et environs ; hors Abidjan sur devis
- Horaires : lundi–vendredi 8h–18h, samedi 9h–13h (modifiable)
- Logo : fichiers définitifs fournis dans le kit de marque (`client/src/brand/logos/`). Utilise-les tels quels, ne les redessine jamais : `kodav-logo-horizontal.svg` dans le header (fond clair), `kodav-logo-horizontal-dark.svg` dans le pied de page (fond bleu nuit), `kodav-favicon.svg` + `png/kodav-favicon-32.png` en favicon, `png/kodav-icon-512.png` et `png/kodav-apple-touch-icon-180.png` pour la PWA.
- Réseaux sociaux : Facebook, LinkedIn, Instagram, TikTok (un lien vide = icône masquée)

---

## 1. Contexte de l'entreprise

Entreprise fondée par un administrateur réseaux et systèmes / développeur. L'offre est organisée en **4 pôles** :

1. **Développement** — sites vitrines, e-commerce, applications web et mobiles, logiciels de gestion sur mesure, automatisation Excel/VBA et tableaux de bord.
2. **Réseaux & Systèmes** — installation LAN / Wi-Fi professionnel, câblage et baies de brassage, Windows Server / Active Directory, virtualisation Hyper-V, sauvegarde et plan de reprise, sécurité (pare-feu, VPN), équipement de salles informatiques.
3. **Logiciels professionnels** — installation, configuration et prise en main : comptabilité / gestion (Sage, EBP, Odoo…), infographie / PAO (Adobe, CorelDRAW…), multimédia (montage vidéo, audio), Microsoft 365 / Office / Windows, antivirus. Argument de confiance à mettre en avant : **licences authentiques uniquement**.
4. **Maintenance & Support** — dépannage sur site, à distance ou en atelier, maintenance préventive, contrats mensuels (formules), récupération de données, formation des utilisateurs.

**4 profils de clients**, chacun avec son propre parcours :

- **Particuliers / étudiants** : dépannage, PC lent, installation de logiciels, conseil d'achat.
- **PME et commerces** : réseau, logiciels de gestion, site web, maintenance mensuelle.
- **Écoles et centres de formation** : salles informatiques, Active Directory, parc de postes, contrats annuels.
- **Grandes entreprises / administrations** : projets d'infrastructure, développement sur mesure, renfort technique ; besoin de documents formels (devis PDF, rapports d'intervention, références).

---

## 2. Stack technique imposée

Utilise les dernières versions stables.

**Front** : React + Vite + TypeScript, React Router, TanStack Query (données serveur), Zustand (état UI léger), Tailwind CSS + composants accessibles de type shadcn/ui (Radix), Framer Motion, React Hook Form + Zod, react-helmet-async, Recharts (graphiques admin), socket.io-client, date-fns (locale fr), lucide-react, i18next (français par défaut, structure prête pour l'anglais).

**Back** : Node.js LTS + Express + TypeScript, Mongoose, Zod, JWT (access token court + refresh token en cookie httpOnly), argon2, helmet, cors (liste blanche), express-rate-limit, express-mongo-sanitize, Socket.io, Nodemailer (SMTP), Multer + Cloudinary (pièces jointes et images), pdfkit (PDF de devis, rapports, factures), node-cron (rappels), pino (logs), Swagger / OpenAPI.

**Base de données** : **MongoDB Atlas**. L'URI est lue depuis `MONGODB_URI` dans `.env` (jamais commité). Demande-moi l'URI au moment de tester la connexion. Fournis un `.env.example` complet et commenté.

**Qualité** : ESLint + Prettier, Vitest + React Testing Library (front), Vitest ou Jest + Supertest + mongodb-memory-server (back).

**Structure monorepo** :

```
/client   → application React
/server   → API Express
/shared   → schémas Zod et types partagés entre front et back
```

Scripts à la racine : `dev` (lance front + back), `build`, `test`, `lint`, `seed`.

---

## 3. Identité visuelle : corporate premium

Ressenti recherché : sérieux, maîtrisé, rassurant, haut de gamme. Plus proche d'un cabinet de conseil que d'une boutique de dépannage. Sobre, mais vivant grâce à des micro-interactions soignées.

**Source de vérité : le kit de marque dans `client/src/brand/`** (logos, polices, `tokens.json`). Génère les variables CSS (thèmes clair et sombre via `data-theme`) et le thème Tailwind à partir de `tokens.json`, en gardant les mêmes noms (`--surface`, `--band`, `--gold`, `--on-gold`, `--space-4`, `--radius-md`…). Si une valeur ci-dessous diffère de `tokens.json`, c'est `tokens.json` qui gagne. Règles clés de la charte : l'or (`gold`) uniquement pour le bouton principal (une fois par écran), le V du logo et de petits détails ; le texte posé sur l'or est toujours bleu nuit (`on-gold`), jamais blanc ; les sections sombres utilisent `band` ; vouvoiement, casse de phrase, aucun emoji.

- **Palette** (tokens CSS, thème clair et thème sombre) :
  - Bleu nuit `#0B1B33` (primaire), bleu ardoise `#1E3A5F` (secondaire)
  - Or sable `#C9A45C` (accent, avec parcimonie : CTA principaux, détails, soulignements)
  - Fond `#F7F8FA`, surfaces blanches, texte `#0F172A`, gris neutres
  - Couleurs d'état (succès, alerte, erreur, info) avec contraste AA minimum
- **Typographie** : « Plus Jakarta Sans » pour les titres, « Inter » pour le texte, chargées depuis les fichiers locaux du kit (`client/src/brand/fonts/`, `font-display: swap`), pas depuis Google Fonts. Échelle : reprends les styles `display`, `h1`–`h4`, `lead`, `body`, `body-sm`, `label`, `caption`, `overline`, `ref` de `tokens.json`.
- Grille aérée, beaucoup d'espace blanc, coins arrondis 12–16 px, bordures fines, ombres douces, alternance de sections claires et bleu nuit.
- Icônes lucide, illustrations sobres (traits fins, schémas réseau abstraits). **Pas de logos d'éditeurs** (Microsoft, Adobe, Sage…) : leurs noms en texte et des icônes génériques.
- Photos : emplacements prévus avec placeholders élégants, remplaçables depuis l'admin.
- Animations Framer Motion : transitions de page fluides, apparition au scroll, compteurs animés, hover subtil sur les cartes. Toujours respecter `prefers-reduced-motion`.
- Commence par un mini design system dans `client/src/components/ui` : Button, Input, Select, Card, Badge, Modal, Drawer, Tabs, Stepper, Toast, Skeleton, EmptyState, DataTable, StatusTimeline, avec une page `/design-system` visible uniquement en développement. Button (primary / secondary / outline / ghost), Badge (neutral / gold / success / warning / danger / info), TextField (libellé, aide, erreur, préfixe +225), le sélecteur « Je suis… », ServiceCard et StatusTimeline (étape en cours = anneau or autour d'un cœur sombre, comme le nœud du logo) suivent exactement les variantes et états de la charte.

---

## 4. Expérience « signature » (ce qui rend la plateforme unique)

1. **Accueil adaptatif « Je suis… »** : dans le hero, un sélecteur de profil (Particulier / PME / École / Grande entreprise). Au choix, la page se réorganise avec animation : services mis en avant, cas d'usage, formules, CTA. Le choix est mémorisé (localStorage dans un try/catch) et réutilisé pour pré-remplir les formulaires.
2. **Diagnostic Express** : assistant de 4 à 6 questions (profil → problème ou projet → urgence → sur site ou à distance → commune). Il recommande 1 à 3 services avec une courte explication, puis propose « Obtenir mon devis » ou « Réserver une intervention » avec les champs **déjà remplis**.
3. **Configurateur de devis en direct** : parcours par étapes ; le client choisit services, options, quantités (postes, pages, heures…), urgence et lieu. Un récapitulatif fixe (en bas d'écran sur mobile, en colonne à droite sur desktop) affiche une **fourchette de prix estimée** animée, le délai estimé et le détail des lignes. Brouillon sauvegardé automatiquement. À la soumission : référence `DEV-AAAA-NNNN`, PDF et email de confirmation.
4. **Suivi d'intervention en temps réel** : timeline façon suivi de colis (Demande reçue → Planifiée → Technicien en route → En cours → Terminée → Validée), mise à jour en direct via Socket.io. Disponible dans l'espace client et sur une page publique `/suivi` (référence + téléphone ou email pour vérifier l'identité).
5. **Bilan de santé informatique** (PME et écoles) : questionnaire de 10 à 12 questions (sauvegardes, antivirus, licences, mots de passe, Wi-Fi, onduleurs, mises à jour…). Résultat : score sur 100 avec jauge animée, points faibles et recommandations reliées aux services. Le rapport détaillé est envoyé par email en échange des coordonnées (génération de prospects).
6. **Comparateur de contrats de maintenance** : 3 formules (ex. Essentiel / Pro / Établissement) dans un tableau comparatif interactif, bascule mensuel / annuel, simulateur selon le nombre de postes.
7. **Palette de commandes (Ctrl/Cmd + K)** : recherche instantanée dans les services, pages, FAQ et actions (« Réserver », « Suivre ma demande »).
8. **Disponibilité visible** : badge « Prochain créneau disponible : demain 9h » calculé à partir du planning réel.
9. **Contact immédiat** : bouton WhatsApp flottant (message pré-rempli selon la page visitée) et bouton d'appel sur mobile.

---

## 5. Pages publiques

- `/` Accueil : hero adaptatif, 4 pôles, accroche Diagnostic Express, méthode en 4 étapes, réalisations, témoignages, chiffres clés, FAQ, CTA final.
- `/services`, `/services/:pole`, `/services/:pole/:service` : contenu chargé depuis la base, prix « à partir de » ou « sur devis », CTA devis / rendez-vous.
- `/solutions/particuliers`, `/solutions/pme`, `/solutions/ecoles`, `/solutions/entreprises` : une page dédiée par profil.
- `/contrats-maintenance`, `/diagnostic`, `/bilan-informatique`, `/devis`, `/rendez-vous`, `/suivi`
- `/realisations` (+ page détail), `/a-propos`, `/contact`, `/faq`
- `/mentions-legales`, `/confidentialite`, `/cgv` : gabarits à compléter, avec mention de la loi ivoirienne n° 2013-450 relative à la protection des données à caractère personnel (texte à faire relire par un juriste).
- Authentification : `/connexion`, `/inscription`, `/mot-de-passe-oublie`, `/reinitialiser/:token`, `/verifier-email/:token`
- Page 404 soignée.

**Honnêteté du contenu** : aucun faux témoignage, faux logo client, faux chiffre ou fausse certification. Les sections « Témoignages », « Ils nous font confiance » et « Chiffres clés » sont alimentées depuis l'admin et **masquées automatiquement tant qu'elles sont vides**.

---

## 6. Modules métier

### 6.1 Catalogue et tarification

- Chaque service est rattaché à un pôle, cible un ou plusieurs profils, et a : description courte et longue, durée estimée, mise en avant, champs SEO.
- Mode de tarification par service : `forfait`, `par_unite` (par poste, par page, par heure…) ou `sur_devis` ; prix min / max ; options (booléen, liste, nombre) avec impact fixe ou en pourcentage.
- Règles globales modifiables dans l'admin : majoration d'urgence (24 h / 48 h), frais de déplacement par commune d'Abidjan (Cocody, Plateau, Yopougon, Abobo, Adjamé, Marcory, Treichville, Koumassi, Port-Bouët, Attécoubé, Bingerville, Anyama, Songon…), hors Abidjan sur devis, remise volume.
- **Le calcul de prix se fait côté serveur** (source de vérité). Le front appelle un endpoint de calcul pour afficher l'estimation en direct.

### 6.2 Devis

- Statuts : brouillon → soumis → en revue → envoyé → accepté / refusé / expiré.
- L'admin ajuste les lignes, ajoute remise et notes, puis envoie le devis final (PDF à l'en-tête de l'entreprise, durée de validité paramétrable, 30 jours par défaut).
- Le client accepte ou refuse en ligne depuis son espace, ou via un lien sécurisé à usage unique reçu par email. Une acceptation propose directement la prise de rendez-vous.
- Un visiteur peut demander un devis sans compte (nom, téléphone, email) ; on lui propose ensuite de créer un compte pour suivre sa demande.
- Historique horodaté de chaque changement de statut.

### 6.3 Rendez-vous et interventions

- Modes : sur site, à distance, en atelier.
- Disponibilités définies dans l'admin : horaires par jour, durée des créneaux, temps tampon, jours fermés, capacité par créneau, nombre de techniciens.
- Le client voit les créneaux libres en temps réel, réserve, et peut reporter ou annuler jusqu'à X heures avant (paramétrable).
- Emails : confirmation, rappel automatique 24 h avant (node-cron), changements de statut.
- **Rapport d'intervention** rempli par le technicien : travaux effectués, temps passé, matériel utilisé, photos, **signature du client à l'écran** (canvas). PDF généré et disponible dans l'espace client.

### 6.4 Espace client (`/espace-client`)

- Tableau de bord : demandes en cours, prochain rendez-vous, tickets ouverts, actions rapides.
- Mes devis, mes rendez-vous (avec la timeline de suivi), mes tickets, mes documents (devis, rapports, factures en PDF).
- **Mon parc informatique** (surtout PME et écoles) : postes, serveurs, imprimantes, équipements réseau, licences avec date d'expiration et alertes avant échéance. Ne stocke jamais une clé de licence en clair : uniquement les 5 derniers caractères, ou chiffrement AES côté serveur si l'admin doit la conserver.
- Profil, organisation (entreprise ou établissement) et utilisateurs rattachés : une PME ou une école peut avoir plusieurs comptes sous la même organisation.
- Notifications en temps réel (cloche + toasts).

### 6.5 Tickets de support

- Création : sujet, catégorie (matériel, logiciel, réseau, accès / comptes, site web, autre), priorité, équipement concerné (choisi dans le parc), pièces jointes (images / PDF, 5 Mo max).
- Statuts : ouvert → en cours → en attente client → résolu → fermé.
- Fil de discussion en temps réel (Socket.io), indicateur « en train d'écrire », notes internes visibles uniquement par l'équipe.
- Délai cible (SLA) selon la priorité et la formule de maintenance du client, avec indicateur visuel.
- À la résolution : note de satisfaction de 1 à 5 + commentaire.

### 6.6 Factures (simples, sans paiement en ligne pour l'instant)

- Génération d'une facture à partir d'un devis accepté, numérotation `FAC-AAAA-NNNN`, PDF.
- Statut de paiement saisi par l'admin (espèces, virement, Mobile Money hors plateforme).
- Prévois une interface `PaymentProvider` vide pour brancher plus tard un paiement Mobile Money, sans l'implémenter maintenant.

---

## 7. Espace technicien (`/technicien`)

Pensé d'abord pour le téléphone : interventions du jour et de la semaine, lien d'itinéraire Google Maps vers l'adresse, changement de statut en un geste (en route, en cours, terminé), rapport d'intervention avec photos et signature, tickets assignés.

---

## 8. Back-office admin (`/admin`)

- **Tableau de bord** : devis en attente, rendez-vous du jour, tickets ouverts par priorité, nouveaux prospects, chiffre d'affaires facturé, taux d'acceptation des devis, graphiques sur 30 / 90 / 365 jours.
- **Devis** : liste filtrable, éditeur, envoi.
- **Planning** : vue jour / semaine, glisser-déposer pour déplacer ou réassigner une intervention.
- **Tickets** : vue kanban + vue liste, assignation, notes internes.
- **Clients et organisations** : fiche 360° (coordonnées, devis, rendez-vous, tickets, parc, factures, formule de maintenance).
- **Prospects** : leads issus du Diagnostic, du Bilan et du formulaire de contact, avec statut (nouveau, contacté, converti, perdu).
- **Catalogue** : CRUD des pôles, services et options avec **aperçu du calcul de prix**.
- **Contenu** : réalisations, témoignages (publiés seulement après validation), FAQ, textes des pages clés.
- **Paramètres** : identité de l'entreprise (§0), horaires et disponibilités, zones et frais de déplacement, règles tarifaires, formules de maintenance, modèles d'emails.
- Utilisateurs et rôles, journal d'audit des actions admin, export CSV.

---

## 9. Modèle de données (MongoDB / Mongoose)

Collections minimales, avec index et timestamps :

`User` (rôle : client | technicien | admin ; profil : particulier | pme | ecole | grande_entreprise), `Organization`, `ServiceCategory`, `Service`, `PricingRule`, `Quote`, `Appointment`, `AvailabilitySettings`, `InterventionReport`, `Ticket` (+ `TicketMessage` si les fils deviennent longs), `Asset` (parc), `Invoice`, `MaintenancePlan`, `Subscription` (formule souscrite par un client), `Lead`, `ItAssessment` (résultats du Bilan), `Testimonial`, `Project` (réalisations), `Faq`, `Settings`, `Notification`, `Counter` (références séquentielles atomiques), `AuditLog`.

En phase 0, présente-moi le schéma détaillé (champs, types, index, relations) **avant** de l'implémenter.

---

## 10. API

- REST sous `/api/v1`, documentée avec Swagger sur `/api/docs`.
- Format uniforme : `{ success, data }` en cas de succès, `{ success: false, error: { code, message, details } }` en cas d'erreur.
- Pagination, tri et filtres sur toutes les listes.
- Événements Socket.io authentifiés, avec des salles par utilisateur, par ticket et par intervention.

---

## 11. Sécurité (non négociable)

- Validation Zod de toutes les entrées, obligatoirement côté serveur.
- Contrôle d'accès par rôle **et** vérification de propriété : un client n'accède qu'à ses propres données (ou à celles de son organisation).
- Mots de passe hachés avec argon2, vérification de l'email, réinitialisation par jeton haché, à usage unique et à durée limitée.
- Access token de 15 min, refresh token de 7 jours en cookie `httpOnly`, `secure`, `sameSite`, avec rotation et invalidation à la déconnexion.
- helmet, CORS en liste blanche, rate limiting (authentification et formulaires publics), mongo-sanitize, nettoyage du HTML dans les messages, honeypot sur les formulaires publics + Cloudflare Turnstile activable par variable d'environnement.
- Uploads : type MIME vérifié, taille maximale, noms de fichiers aléatoires.
- Aucun secret dans le code ni dans les logs. `.env.example` complet, `.gitignore` correct.
- Bandeau de consentement uniquement si des cookies non essentiels sont utilisés.

---

## 12. Performance, SEO, accessibilité

- **Mobile d'abord** : la majorité des visiteurs viendront d'un smartphone, parfois avec une 4G irrégulière. Code splitting par route, images WebP/AVIF responsives en lazy-loading, polices préchargées, skeletons plutôt que spinners. Objectif Lighthouse mobile ≥ 90 sur les pages publiques.
- **SEO** : balises par page (react-helmet-async), pré-rendu des pages publiques (propose la solution la plus simple compatible avec Vite), `sitemap.xml`, `robots.txt`, données structurées schema.org `LocalBusiness` et `Service`, Open Graph. Contenus pensés pour la recherche locale (ex. « maintenance informatique Abidjan », « installation réseau entreprise Abidjan »).
- **Accessibilité** : navigation au clavier, focus visibles, labels, contrastes AA, ARIA via Radix.
- PWA installable (manifest + service worker léger pour les pages publiques).

---

## 13. Localisation

Interface en français. Montants en FCFA au format « 150 000 FCFA ». Numéros ivoiriens au format +225 suivi de 10 chiffres. Fuseau horaire Africa/Abidjan. Dates au format français.

---

## 14. Données de démarrage (`npm run seed`)

- Un compte admin (identifiants lus dans `.env`), un technicien et deux clients de test.
- Les 4 pôles et 5 à 7 services par pôle (liste du §1), avec des **prix d'exemple marqués comme tels** (`isPlaceholderPrice: true`) et un bandeau d'avertissement dans l'admin tant qu'ils n'ont pas été modifiés.
- 3 formules de maintenance d'exemple, règles tarifaires, communes d'Abidjan, horaires, FAQ de base.
- Aucun témoignage ni aucune réalisation fictifs.

---

## 15. Plan de travail par phases

Travaille **phase par phase**. À la fin de chaque phase : lance lint, tests et build, corrige ce qui échoue, fais un commit (Conventional Commits), résume ce qui est fait et ce qui reste, puis **attends mon accord** avant de passer à la suivante.

- **Phase 0 — Cadrage** : arborescence, schéma de données détaillé, liste des endpoints, choix techniques justifiés. Tu me présentes tout cela avant d'écrire du code. Ensuite : scaffolding du monorepo, configuration, connexion à Atlas, endpoint `GET /api/v1/health`.
- **Phase 1 — Design system & site vitrine** : tokens, composants UI, layout (header, menu mobile, footer), pages publiques avec le contenu seed, accueil adaptatif « Je suis… ».
- **Phase 2 — Authentification & espaces** : inscription, connexion, vérification email, mot de passe oublié, rôles, squelettes des espaces client, technicien et admin.
- **Phase 3 — Catalogue, Diagnostic Express & devis** : catalogue dynamique, moteur de prix serveur, configurateur, PDF, emails, gestion des devis dans l'admin.
- **Phase 4 — Rendez-vous & interventions** : disponibilités, réservation, rappels, suivi en temps réel, espace technicien, rapport avec signature.
- **Phase 5 — Tickets, parc & notifications** : tickets en temps réel, parc informatique, alertes de licences, notifications.
- **Phase 6 — Back-office complet & factures** : tableau de bord, planning, kanban, fiches clients, contenus, paramètres, factures, audit, exports.
- **Phase 7 — Finitions** : Bilan de santé informatique, comparateur de formules, palette Ctrl+K, peaufinage des animations, SEO et pré-rendu, PWA, accessibilité, performances, tests de bout en bout des parcours clés, README et guide de déploiement (front sur Vercel ou Netlify, API sur Render ou Railway, base sur Atlas : variables d'environnement, accès réseau Atlas, nom de domaine).

---

## 16. Règles de travail

- Code en anglais (variables, fichiers, fonctions) ; interface et contenus en français ; commentaires uniquement quand ils sont utiles.
- Composants petits et réutilisables ; aucune duplication de logique entre front et back (schémas Zod dans `/shared`).
- Gère systématiquement les états chargement / vide / erreur.
- Si une exigence est ambiguë ou en contradiction avec une autre, pose-moi la question au lieu de deviner.
- N'invente aucun contenu présenté comme réel (avis, clients, chiffres, certifications) : utilise des placeholders clairement identifiés.
- Tout secret passe par `.env`, jamais par le code.

---

## 17. Définition de « terminé »

Une fonctionnalité est terminée quand :

- elle fonctionne sur mobile et sur desktop, en thème clair et en thème sombre ;
- ses entrées sont validées côté serveur et ses droits d'accès vérifiés ;
- ses états chargement / vide / erreur sont gérés ;
- son parcours principal est couvert par au moins un test ;
- lint et build passent sans erreur.

**Commence maintenant par la phase 0.**
