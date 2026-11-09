# Phase 0 — Cadrage technique KODAV

Document à valider avant tout code. Les points marqués **[À trancher]** sont regroupés en fin de document.

---

## 1. Choix techniques (versions stables au 09/11/2026)

| Domaine              | Choix                                                                                                                                                                                                                                                                                    | Justification                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo             | **npm workspaces** (`client`, `server`, `shared`) + `concurrently`                                                                                                                                                                                                                       | npm 10 est déjà installé, pas d'outil supplémentaire (pnpm/Turborepo inutiles à cette taille).                                                                                                                                                                                                                                                                 |
| Runtime              | Node 22 LTS (installé : 22.23)                                                                                                                                                                                                                                                           | LTS active.                                                                                                                                                                                                                                                                                                                                                    |
| Langage              | TypeScript strict partout, `shared` compilé en ESM et consommé via références de projet                                                                                                                                                                                                  | Une seule source pour les schémas Zod.                                                                                                                                                                                                                                                                                                                         |
| Front                | React 19 + Vite 8 + React Router 8                                                                                                                                                                                                                                                       | Stack imposée.                                                                                                                                                                                                                                                                                                                                                 |
| Pré-rendu SEO        | **React Router 8 en mode « framework » avec `ssr: false` + `prerender: [liste des routes publiques]`**                                                                                                                                                                                   | Solution la plus simple compatible Vite : au build, chaque page publique est générée en HTML statique, le reste reste une SPA. Pas de serveur Node côté front, déploiement statique sur Vercel/Netlify. Les pages de services (`/services/:pole/:service`) sont listées au build via un appel à l'API (ou au seed).                                            |
| Styles               | **Tailwind CSS 4** (configuration en CSS via `@theme`)                                                                                                                                                                                                                                   | Un script `brand:tokens` lit `client/src/brand/tokens.json` et génère `tokens.css` (variables `--surface`, `--gold`, `--space-4`… en `:root` et `[data-theme="dark"]`) ainsi que le bloc `@theme` qui expose ces mêmes noms à Tailwind (`bg-surface`, `text-on-gold`, `rounded-md`…). Le script tourne avant `dev` et `build` : modifier `tokens.json` suffit. |
| Composants           | Radix Primitives + composants maison façon shadcn/ui (copiés dans `components/ui`, pas de dépendance shadcn)                                                                                                                                                                             | Accessibilité (ARIA, clavier) sans verrou.                                                                                                                                                                                                                                                                                                                     |
| Données serveur      | TanStack Query 5 ; état UI léger avec Zustand 5                                                                                                                                                                                                                                          | Imposé.                                                                                                                                                                                                                                                                                                                                                        |
| Formulaires          | React Hook Form + `@hookform/resolvers/zod` avec les schémas de `shared`                                                                                                                                                                                                                 | Mêmes règles de validation côté front et côté back.                                                                                                                                                                                                                                                                                                            |
| Validation           | **Zod 4**                                                                                                                                                                                                                                                                                | Version stable actuelle.                                                                                                                                                                                                                                                                                                                                       |
| Back                 | **Express 5.3**                                                                                                                                                                                                                                                                          | Version stable ; gère nativement les erreurs des handlers `async`.                                                                                                                                                                                                                                                                                             |
| Anti-injection NoSQL | **Validé :** `express-mongo-sanitize` ne fonctionne pas avec Express 5 (`req.query` y est en lecture seule), d'où Express 5 + middleware maison qui retire les clés `$` et `.` de `body`/`params`/`query` (même logique que la lib), + option Mongoose `sanitizeFilter: true` en global. |
| ODM                  | Mongoose 9, plugin commun (timestamps, `toJSON` sans `_id`/`__v` → `id`)                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                                |
| Auth                 | JWT HS256 : access 15 min (en mémoire côté front, header `Authorization`), refresh 7 j en cookie `httpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` avec rotation et détection de réutilisation (famille de tokens révoquée)                                                         | Conforme au §11. Refresh tokens stockés **hachés** en base.                                                                                                                                                                                                                                                                                                    |
| Temps réel           | Socket.io 4, authentification par access token au handshake, salles `user:<id>`, `org:<id>`, `ticket:<id>`, `appointment:<id>`, `staff`                                                                                                                                                  |                                                                                                                                                                                                                                                                                                                                                                |
| PDF                  | pdfkit + polices de la marque intégrées                                                                                                                                                                                                                                                  |                                                                                                                                                                                                                                                                                                                                                                |
| Emails               | Nodemailer (SMTP) ; modèles stockés en base (éditables dans l'admin), rendus avec un mini-moteur `{{variable}}` + gabarit HTML commun                                                                                                                                                    | En dev : transport Ethereal ou log console.                                                                                                                                                                                                                                                                                                                    |
| Fichiers             | Multer (mémoire) → vérification du type réel par magic bytes (`file-type`) → Cloudinary (dossiers privés pour les pièces jointes, URL signées)                                                                                                                                           |                                                                                                                                                                                                                                                                                                                                                                |
| Tâches planifiées    | node-cron, fuseau `Africa/Abidjan` (rappels 24 h, expiration des devis, alertes de licences, purge des tokens)                                                                                                                                                                           |                                                                                                                                                                                                                                                                                                                                                                |
| Logs                 | pino + pino-http, masquage (`redact`) des champs sensibles (password, token, cookie, authorization)                                                                                                                                                                                      |                                                                                                                                                                                                                                                                                                                                                                |
| Docs API             | `zod-to-openapi` (génération OpenAPI depuis les schémas Zod) + swagger-ui-express sur `/api/docs`                                                                                                                                                                                        | Pas de double déclaration.                                                                                                                                                                                                                                                                                                                                     |
| Tests                | Vitest partout (front : RTL + jsdom ; back : Supertest + mongodb-memory-server) ; Playwright pour les parcours e2e en phase 7                                                                                                                                                            | Un seul runner.                                                                                                                                                                                                                                                                                                                                                |
| Qualité              | ESLint 9 (flat config) + typescript-eslint + Prettier ; Husky + lint-staged                                                                                                                                                                                                              |                                                                                                                                                                                                                                                                                                                                                                |
| i18n                 | i18next + react-i18next, `fr` par défaut, fichiers `locales/fr/*.json` par espace de noms                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                                |
| Monnaie              | Montants stockés en **entiers FCFA** (XOF n'a pas de centimes), formatés par `Intl.NumberFormat('fr-FR')` + « FCFA »                                                                                                                                                                     | Pas d'erreurs d'arrondi.                                                                                                                                                                                                                                                                                                                                       |
| Dates                | Stockées en UTC, affichées en `Africa/Abidjan` (UTC+0 sans heure d'été, donc simple), date-fns + `date-fns-tz`                                                                                                                                                                           |                                                                                                                                                                                                                                                                                                                                                                |

---

## 2. Arborescence

```
projet-marketplace/
├─ package.json              # workspaces + scripts dev/build/test/lint/seed
├─ .env.example  .gitignore  .editorconfig  .prettierrc  eslint.config.js
├─ docs/                     # cadrage, déploiement, décisions
├─ shared/
│  └─ src/
│     ├─ schemas/            # zod : auth, quote, appointment, ticket, asset, lead, settings…
│     ├─ enums.ts            # rôles, profils, statuts, communes…
│     ├─ pricing/            # types des règles tarifaires (le calcul reste côté serveur)
│     ├─ format.ts           # formatFcfa, formatPhoneCI, références
│     └─ index.ts
├─ server/
│  └─ src/
│     ├─ app.ts  server.ts   # Express + Socket.io
│     ├─ config/             # env.ts (validé par zod), brand.ts, db.ts, logger.ts
│     ├─ middlewares/        # auth, requireRole, validate, rateLimit, sanitize, honeypot, turnstile, upload, error
│     ├─ modules/            # un dossier par domaine : routes / controller / service / model / tests
│     │  ├─ auth/ users/ organizations/ catalog/ pricing/ quotes/ appointments/
│     │  ├─ availability/ reports/ tickets/ assets/ invoices/ plans/ leads/
│     │  ├─ assessments/ content/ settings/ notifications/ dashboard/ audit/ uploads/
│     ├─ lib/                # pdf/, mailer/, cloudinary.ts, counter.ts, crypto.ts, socket.ts, cron/
│     ├─ payments/           # interface PaymentProvider (vide)
│     ├─ seed/
│     └─ openapi/
└─ client/
   ├─ public/                # robots.txt, manifest, icônes copiées du kit
   ├─ scripts/build-tokens.ts
   └─ src/
      ├─ brand/              # kit de marque (copié tel quel) + tokens.css généré
      ├─ app/                # routes.ts, root.tsx, providers, layouts (public, client, technicien, admin)
      ├─ components/ui/      # design system
      ├─ components/         # header, footer, WhatsAppButton, CommandPalette…
      ├─ features/           # profile-selector, diagnostic, quote-configurator, tracking, assessment, tickets…
      ├─ routes/             # pages (public/, auth/, espace-client/, technicien/, admin/)
      ├─ lib/                # api client (fetch + refresh auto), socket, queryClient, i18n, storage
      ├─ stores/             # zustand : ui, profile, quote-draft
      └─ locales/fr/
```

---

## 3. Modèle de données

Conventions : toutes les collections ont `createdAt`/`updatedAt`. `ObjectId → X` = référence. Les montants sont en FCFA entiers. Les statuts ont un `statusHistory: [{ status, at, by, note }]` lorsqu'il est indiqué.

### Identité et comptes

**User**

| Champ               | Type                                                    | Notes                     |
| ------------------- | ------------------------------------------------------- | ------------------------- |
| email               | string, unique, minuscules                              | index unique              |
| passwordHash        | string                                                  | argon2id, `select: false` |
| firstName, lastName | string                                                  |                           |
| phone               | string                                                  | format `+225XXXXXXXXXX`   |
| role                | enum `client \| technicien \| admin`                    | index                     |
| profile             | enum `particulier \| pme \| ecole \| grande_entreprise` | client uniquement         |
| organization        | ObjectId → Organization, optionnel                      | index                     |
| orgRole             | enum `owner \| member`                                  | rôle dans l'organisation  |
| emailVerifiedAt     | Date \| null                                            |                           |
| isActive            | boolean                                                 | désactivation par l'admin |
| lastLoginAt         | Date                                                    |                           |
| notificationPrefs   | `{ email: boolean, … }`                                 |                           |

**AuthToken** (ajouté, nécessaire au §11)

| Champ             | Type                                                             | Notes                                        |
| ----------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| user              | ObjectId → User                                                  | index                                        |
| type              | enum `refresh \| email_verify \| password_reset \| quote_action` |                                              |
| tokenHash         | string                                                           | SHA-256 du jeton, index unique               |
| family            | string                                                           | rotation des refresh tokens                  |
| expiresAt         | Date                                                             | **index TTL** (suppression automatique)      |
| usedAt, revokedAt | Date                                                             | usage unique                                 |
| meta              | objet                                                            | ex. `{ quoteId }` pour le lien d'acceptation |

**Organization**
`name`, `type` (pme | ecole | grande_entreprise), `taxId` (n° de compte contribuable, optionnel), `rccm` (optionnel), `address { street, commune, city }`, `phone`, `email`, `owner → User`, `activeSubscription → Subscription`, `notes` (internes). Index : `name` (texte).

### Catalogue et tarification

**ServiceCategory** (les 4 pôles)
`slug` (unique), `name`, `shortDescription`, `description`, `icon` (nom lucide), `order`, `isActive`, `seo { title, description }`.

**Service**

| Champ                                   | Type                                                                                                                                                                                          | Notes                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| category                                | ObjectId → ServiceCategory                                                                                                                                                                    | index                                        |
| slug                                    | string                                                                                                                                                                                        | unique par catégorie (index composé)         |
| name, shortDescription, longDescription | string                                                                                                                                                                                        | longDescription en Markdown                  |
| targetProfiles                          | enum[]                                                                                                                                                                                        | index                                        |
| estimatedDuration                       | `{ min, max, unit: 'heure' \| 'jour' \| 'semaine' }`                                                                                                                                          |                                              |
| pricingMode                             | enum `forfait \| par_unite \| sur_devis`                                                                                                                                                      |                                              |
| unitLabel                               | string                                                                                                                                                                                        | « poste », « page », « heure »…              |
| priceMin, priceMax                      | number                                                                                                                                                                                        | fourchette (par unité si `par_unite`)        |
| isPlaceholderPrice                      | boolean                                                                                                                                                                                       | `true` au seed ; bandeau admin tant que vrai |
| options                                 | `[{ key, label, type: 'boolean' \| 'select' \| 'number', choices?: [{ value, label, impact }], impact?: { kind: 'fixed' \| 'percent', min, max }, perUnit?: boolean, min?, max?, default? }]` |                                              |
| modes                                   | enum[] `sur_site \| distance \| atelier`                                                                                                                                                      |                                              |
| featured, order, isActive               |                                                                                                                                                                                               |                                              |
| image                                   | `{ url, publicId, alt }`                                                                                                                                                                      |                                              |
| seo                                     | `{ title, description, keywords[] }`                                                                                                                                                          |                                              |

**PricingRule** (un document par type de règle, éditable dans l'admin)
`type` (enum `urgency \| travel \| volume_discount`), `isActive`, et selon le type :

- `urgency` : `levels: [{ key: 'standard' \| '48h' \| '24h', label, percent }]`
- `travel` : `zones: [{ commune, fee, isAbidjan }]`, `outsideAbidjan: 'sur_devis'`
- `volume_discount` : `tiers: [{ minQuantity, percent }]`

### Devis

**Quote**

| Champ                              | Type                                                                                                                                                                    | Notes                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| reference                          | string, unique                                                                                                                                                          | `DEV-AAAA-NNNN` via Counter          |
| client                             | ObjectId → User, optionnel                                                                                                                                              | null pour un visiteur sans compte    |
| organization                       | ObjectId → Organization, optionnel                                                                                                                                      |                                      |
| contact                            | `{ name, email, phone, profile, company? }`                                                                                                                             | toujours renseigné                   |
| items                              | `[{ service?, label, description, quantity, unitLabel, unitPriceMin, unitPriceMax, options: [{ key, label, value }], lineMin, lineMax, finalUnitPrice?, finalTotal? }]` | instantané au moment de la demande   |
| urgency, mode, commune, address    |                                                                                                                                                                         |                                      |
| estimate                           | `{ min, max, travelFee, urgencyAmount, discountAmount, durationLabel }`                                                                                                 | calculé par le serveur               |
| finalTotals                        | `{ subtotal, discount, travelFee, total }`                                                                                                                              | renseigné par l'admin                |
| status                             | enum `brouillon \| soumis \| en_revue \| envoye \| accepte \| refuse \| expire`                                                                                         | index                                |
| statusHistory                      | voir conventions                                                                                                                                                        |                                      |
| validUntil                         | Date                                                                                                                                                                    | défaut : envoi + 30 j (paramétrable) |
| adminNotes (internes), clientNotes | string                                                                                                                                                                  |                                      |
| pdf                                | `{ url, publicId, version }`                                                                                                                                            |                                      |
| source                             | enum `configurateur \| diagnostic \| admin`                                                                                                                             |                                      |
| lead                               | ObjectId → Lead, optionnel                                                                                                                                              |                                      |
| decidedAt, decisionReason          |                                                                                                                                                                         |                                      |

Index : `{ client, createdAt }`, `{ organization }`, `{ status, createdAt }`, `contact.email`.

Le **brouillon** du configurateur est gardé dans le navigateur (localStorage) tant que l'utilisateur n'est pas connecté, et dans un Quote `brouillon` lorsqu'il l'est.

### Rendez-vous et interventions

**AvailabilitySettings** (document unique)
`weekly: [{ day: 0-6, open: boolean, ranges: [{ start: '08:00', end: '18:00' }] }]`, `slotDuration` (min), `bufferMinutes`, `capacityPerSlot`, `technicianCount`, `closedDates: [{ date, reason }]`, `minNoticeHours`, `maxAdvanceDays`, `cancelCutoffHours` (défaut 24).

**Appointment**

| Champ                                      | Type                                                                                        | Notes                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------- |
| reference                                  | `INT-AAAA-NNNN`                                                                             | utilisé par `/suivi`          |
| client, organization                       | refs                                                                                        |                               |
| contact                                    | `{ name, email, phone }`                                                                    |                               |
| quote                                      | ObjectId → Quote, optionnel                                                                 |                               |
| service                                    | ObjectId → Service, optionnel                                                               |                               |
| mode                                       | enum `sur_site \| distance \| atelier`                                                      |                               |
| address                                    | `{ street, commune, landmark, lat?, lng? }`                                                 | « repère » utile à Abidjan    |
| start, end                                 | Date                                                                                        | index                         |
| technician                                 | ObjectId → User                                                                             | index `{ technician, start }` |
| status                                     | enum `demande_recue \| planifiee \| en_route \| en_cours \| terminee \| validee \| annulee` | timeline de suivi             |
| statusHistory                              |                                                                                             |                               |
| description, internalNotes                 |                                                                                             |                               |
| report                                     | ObjectId → InterventionReport                                                               |                               |
| reminderSentAt                             | Date                                                                                        | évite les doubles rappels     |
| cancelledAt, cancelReason, rescheduledFrom |                                                                                             |                               |

**InterventionReport**
`appointment` (unique), `technician`, `workDone`, `timeSpentMinutes`, `materials: [{ label, quantity, unitPrice? }]`, `photos: [{ url, publicId }]`, `signature: { imageUrl, signerName, signedAt }`, `clientComment`, `pdf`, `status` (brouillon | signé).

### Support et parc

**Ticket**
`reference` (`TCK-AAAA-NNNN`), `client`, `organization`, `subject`, `category` (materiel | logiciel | reseau | acces_comptes | site_web | autre), `priority` (basse | normale | haute | critique), `asset → Asset`, `status` (ouvert | en_cours | attente_client | resolu | ferme), `statusHistory`, `assignee → User`, `slaDueAt` (calculé à la création), `firstResponseAt`, `resolvedAt`, `satisfaction { rating 1-5, comment, at }`, `lastMessageAt`.
Index : `{ organization, status }`, `{ client, status }`, `{ assignee, status }`, `{ status, priority, slaDueAt }`.

**TicketMessage** (collection séparée dès le départ : plus simple à paginer et à diffuser en temps réel)
`ticket` (index), `author → User`, `body` (HTML nettoyé), `attachments: [{ url, publicId, name, mime, size }]`, `isInternal` (notes d'équipe), `readBy: [userId]`.

**Asset** (parc informatique)
`organization` ou `owner` (particulier), `type` (poste | portable | serveur | imprimante | reseau | licence | autre), `name`, `brand`, `model`, `serialNumber`, `location`, `assignedTo` (texte), `purchaseDate`, `warrantyUntil`, `status` (actif | en_panne | retire), `notes`.
Pour une licence : `license { product, seats, expiresAt, keyLast5, keyEncrypted? }` (`keyEncrypted` en AES-256-GCM, `select: false`, déchiffrable par l'admin uniquement), `alertSentAt[]`.
Index : `{ organization, type }`, `license.expiresAt`.

### Facturation et contrats

**Invoice**
`reference` (`FAC-AAAA-NNNN`), `quote` (unique), `client`, `organization`, `billingSnapshot` (coordonnées figées), `items` (copie des lignes finales), `subtotal`, `discount`, `taxRate`, `taxAmount`, `total`, `issuedAt`, `dueAt`, `paymentStatus` (impayee | partielle | payee | annulee), `payments: [{ amount, method: 'especes' \| 'virement' \| 'mobile_money' \| 'cheque', reference, paidAt, recordedBy }]`, `pdf`.

**MaintenancePlan**
`slug`, `name` (Essentiel / Pro / Établissement), `targetProfiles`, `pricePerSeatMonthly`, `basePriceMonthly`, `annualDiscountPercent`, `minSeats`, `maxSeats`, `features: [{ key, label, value: boolean \| string }]` (alimente le comparateur), `sla: { basse, normale, haute, critique }` (heures), `includedVisitsPerMonth`, `remoteSupport`, `order`, `isActive`, `isPlaceholderPrice`.

**Subscription**
`organization` ou `client`, `plan`, `seats`, `billingCycle` (mensuel | annuel), `startDate`, `endDate`, `status` (active | suspendue | resiliee), `priceSnapshot`.

### Prospection et contenu

**Lead**
`source` (diagnostic | bilan | contact | devis_visiteur), `name`, `email`, `phone`, `company`, `profile`, `commune`, `message`, `payload` (réponses du diagnostic), `assessment → ItAssessment`, `status` (nouveau | contacte | converti | perdu), `assignee`, `convertedTo { user?, quote? }`, `consentAt`. Index `{ status, createdAt }`, `email`.

**ItAssessment**
`answers: [{ questionKey, value }]`, `score` (0-100), `categoryScores`, `weaknesses: [{ key, label, severity, recommendedServices: [serviceId] }]`, `lead`, `reportSentAt`. Les questions et la pondération vivent dans `shared` (versionnées : `version`).

**Testimonial** : `authorName`, `role`, `company`, `profile`, `content`, `rating`, `status` (en_attente | publie | rejete), `consentAt`, `order`.
**Project** (réalisations) : `slug`, `title`, `category`, `client` (texte, avec accord), `summary`, `content`, `images[]`, `tags`, `status` (brouillon | publie), `publishedAt`, `seo`.
**Faq** : `question`, `answer`, `category`, `order`, `isPublished`.
**Settings** (document unique) : `brand` (§0 : noms, slogan, téléphones, email, zone, horaires, réseaux sociaux), `stats` (chiffres clés, vides par défaut), `quote { validityDays }`, `invoice { taxRate, legalMentions, bankDetails }`, `emailTemplates: [{ key, subject, body }]`, `pages` (textes éditables), `features { turnstile }`.
**Notification** : `user` (index), `type`, `title`, `body`, `link`, `readAt`, TTL de 90 jours.
**Counter** : `_id: 'DEV-2026'`, `seq` — incrément atomique `findOneAndUpdate({ $inc }, { upsert: true })`.
**AuditLog** : `actor`, `action`, `entity`, `entityId`, `before`, `after` (diff), `ip`, `userAgent`, `at`. Index `{ entity, entityId }`, `{ actor, at }`.

### Relations principales

```
Organization 1─n User ── 1─n Quote ── 0..1 Invoice
                    │        └─ 0..n Appointment 1─0..1 InterventionReport
                    ├─ 1─n Ticket 1─n TicketMessage
                    ├─ 1─n Asset
                    └─ 0..1 Subscription ─ MaintenancePlan
ServiceCategory 1─n Service ;  Lead ─ 0..1 ItAssessment
```

---

## 4. Endpoints (`/api/v1`)

Légende : **P** public, **C** client connecté (propriété vérifiée), **T** technicien, **A** admin. Toutes les listes acceptent `page`, `limit`, `sort`, et des filtres propres.

**Santé et paramètres**

- `GET /health` P — état de l'API et de la base
- `GET /settings/public` P · `GET|PATCH /admin/settings` A

**Authentification**

- `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` P
- `POST /auth/verify-email` · `POST /auth/resend-verification` P
- `POST /auth/forgot-password` · `POST /auth/reset-password` P
- `GET /auth/me` · `PATCH /auth/me` · `PATCH /auth/me/password` C

**Catalogue et prix**

- `GET /catalog/categories` · `GET /catalog/categories/:slug` · `GET /catalog/services` (filtres : profil, pôle, mis en avant) · `GET /catalog/services/:categorySlug/:slug` P
- `POST /pricing/estimate` P — calcul de la fourchette (source de vérité)
- `GET /plans` P · `POST /plans/simulate` P
- CRUD `/admin/categories`, `/admin/services`, `/admin/pricing-rules`, `/admin/plans` A · `POST /admin/pricing/preview` A

**Diagnostic, bilan, prospects, contact**

- `POST /diagnostic/recommend` P — renvoie 1 à 3 services
- `POST /assessments` P (score) · `POST /assessments/:id/report` P (coordonnées → email du rapport)
- `POST /contact` P
- `GET /admin/leads` · `PATCH /admin/leads/:id` A

**Devis**

- `POST /quotes` P/C — soumission (avec ou sans compte)
- `GET /quotes` · `GET /quotes/:id` · `PUT /quotes/draft` C
- `POST /quotes/:id/accept` · `POST /quotes/:id/decline` C
- `GET /quotes/action/:token` · `POST /quotes/action/:token` P — lien sécurisé à usage unique
- `GET /quotes/:id/pdf` C/A
- `GET /admin/quotes` · `PATCH /admin/quotes/:id` · `POST /admin/quotes/:id/send` · `POST /admin/quotes/:id/invoice` A

**Rendez-vous et suivi**

- `GET /availability/slots?from&to&mode` P · `GET /availability/next` P (badge « prochain créneau »)
- `POST /appointments` P/C · `GET /appointments` · `GET /appointments/:id` C
- `POST /appointments/:id/reschedule` · `POST /appointments/:id/cancel` C
- `POST /tracking/lookup` P — référence + téléphone ou email, renvoie la timeline et un jeton de suivi en lecture seule pour la salle Socket.io
- `GET|PUT /admin/availability` A · `GET /admin/appointments` (vue planning) · `PATCH /admin/appointments/:id` (déplacer, réassigner) A

**Espace technicien**

- `GET /technician/appointments?range=day|week` T
- `PATCH /technician/appointments/:id/status` T
- `PUT /technician/appointments/:id/report` · `POST /technician/appointments/:id/report/sign` T
- `GET /reports/:id/pdf` C/T/A

**Tickets**

- `POST /tickets` · `GET /tickets` · `GET /tickets/:id` C
- `GET /tickets/:id/messages` · `POST /tickets/:id/messages` C/T/A (`isInternal` réservé à T/A)
- `POST /tickets/:id/rate` C
- `GET /admin/tickets` (kanban ou liste) · `PATCH /admin/tickets/:id` A/T

**Parc informatique**

- CRUD `/assets` C (organisation de l'utilisateur) · `GET /assets/licenses/expiring` C
- `POST /admin/assets/:id/reveal-key` A (journalisé)

**Organisation et utilisateurs**

- `GET|PATCH /organizations/me` · `GET /organizations/me/members` · `POST /organizations/me/invitations` · `DELETE /organizations/me/members/:userId` C (owner)
- `GET /admin/clients` · `GET /admin/clients/:id` (fiche 360°) · `GET /admin/organizations/:id` A
- CRUD `/admin/users` (rôles, activation) A

**Factures**

- `GET /invoices` · `GET /invoices/:id/pdf` C
- `GET /admin/invoices` · `PATCH /admin/invoices/:id` · `POST /admin/invoices/:id/payments` A

**Contenu public**

- `GET /content/testimonials` · `GET /content/projects` · `GET /content/projects/:slug` · `GET /content/faqs` · `GET /content/search?q=` (palette Ctrl+K) P
- `POST /content/testimonials` C (soumis en attente de validation)
- CRUD `/admin/testimonials`, `/admin/projects`, `/admin/faqs` A

**Notifications, fichiers, tableau de bord, audit**

- `GET /notifications` · `PATCH /notifications/:id/read` · `POST /notifications/read-all` C
- `POST /uploads` C/T/A (images et PDF, 5 Mo max)
- `GET /admin/dashboard?period=30|90|365` A
- `GET /admin/audit-logs` A · `GET /admin/export/:entity.csv` A

**Événements Socket.io**

- Client → serveur : `ticket:join`, `ticket:typing`, `appointment:join` (ou jeton de suivi public)
- Serveur → client : `notification:new`, `ticket:message`, `ticket:typing`, `ticket:updated`, `appointment:status`, `quote:status`

---

## 5. Décisions (validées le 09/11/2026 : propositions retenues)

1. **Anti-injection NoSQL et Express** : Express 5 + middleware maison équivalent à `express-mongo-sanitize` (recommandé) ou Express 4 + la lib d'origine ?
2. **TVA sur les factures** : appliquer la TVA à 18 % (taux normal en Côte d'Ivoire), ne pas en appliquer (régime simplifié, pas d'assujettissement), ou laisser un taux paramétrable fixé à 0 par défaut ? Je propose le taux paramétrable dans l'admin, à 0 par défaut, avec la mention adaptée sur la facture.
3. **Délais SLA d'exemple** par priorité et par formule : je propose des valeurs d'exemple marquées comme telles (ex. Essentiel : critique 8 h ouvrées, haute 24 h ; Pro : 4 h / 8 h ; Établissement : 4 h / 8 h + visite mensuelle), modifiables dans l'admin.
4. **Kit de marque** : je copie `C:\Users\PIT\Desktop\kodav-brand` dans `client/src/brand/` tel quel au scaffolding. D'accord ?
5. **Dépôt Git** : le dossier n'est pas encore un dépôt. Je fais `git init` avec une branche `main` et un commit par phase, sans dépôt distant pour l'instant ?

Une fois ces points validés : scaffolding du monorepo, configuration (ESLint, Prettier, Vitest, `.env.example`), connexion à Atlas et `GET /api/v1/health`. Je vous demanderai l'URI `MONGODB_URI` au moment du test de connexion.
