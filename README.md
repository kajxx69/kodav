# Plateforme KODAV Technologies

Monorepo npm workspaces : `client` (React + React Router 8, pré-rendu des pages publiques), `server` (API Express 5 + MongoDB), `shared` (schémas Zod et utilitaires communs).

## Démarrage

Prérequis : Node.js 22 LTS ou plus récent.

```bash
npm install
cp .env.example .env   # puis renseigner MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
npm run seed           # catalogue, formules, FAQ, compte admin et comptes de test
npm run dev            # API sur http://localhost:4000, front sur http://localhost:5173
```

Vérification : `GET http://localhost:4000/api/v1/health`.

## Scripts (à la racine)

| Script              | Rôle                                                                            |
| ------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`       | `shared` en mode watch, API et front en parallèle                               |
| `npm run build`     | build de `shared`, de l'API (`server/dist`) et du front (`client/build/client`) |
| `npm test`          | tests Vitest des trois paquets (MongoDB en mémoire côté API)                    |
| `npm run lint`      | ESLint + vérification Prettier                                                  |
| `npm run typecheck` | vérification TypeScript                                                         |
| `npm run seed`      | données de démarrage                                                            |

## Comptes et authentification

`npm run seed` crée, s'ils n'existent pas encore :

- le compte **admin** défini par `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` ;
- si `SEED_TEST_PASSWORD` est renseigné, trois comptes de test (même mot de passe) : `technicien@kodav.test`, `client.particulier@kodav.test`, `client.pme@kodav.test` (avec une organisation de démonstration). Laissez cette variable vide en production.

Le seed ne modifie jamais un compte existant : changer ces variables après coup n'a aucun effet sur les mots de passe déjà créés.

Sans `SMTP_HOST`, les emails (confirmation d'adresse, mot de passe oublié) ne sont pas envoyés : en développement, leur contenu et leurs liens s'affichent dans la console de l'API.

Sessions : jeton d'accès de 15 min gardé en mémoire côté navigateur, refresh token de 7 jours en cookie `httpOnly` limité à `/api/v1/auth`, avec rotation à chaque usage et révocation de toutes les sessions en cas de réutilisation d'un ancien jeton. Si le front et l'API sont sur deux domaines différents (ex. `*.vercel.app` et `*.onrender.com`), passez `COOKIE_SAMESITE=none` ; sur un même domaine (`kodav.ci` et `api.kodav.ci`), gardez `strict`.

| Espace         | Adresse          | Rôles admis       |
| -------------- | ---------------- | ----------------- |
| Client         | `/espace-client` | client            |
| Technicien     | `/technicien`    | technicien, admin |
| Administration | `/admin`         | admin             |

## Devis

- **Prix** : calculés uniquement par l'API (`POST /api/v1/pricing/estimate`), à partir du catalogue et des règles tarifaires (urgence, déplacement par commune, remise volume). Le configurateur `/devis` et l'aperçu de l'admin appellent ce même calcul.
- **Parcours** : Diagnostic Express (`/diagnostic`) → configurateur pré-rempli → demande `DEV-AAAA-NNNN` (PDF d'estimation par email) → l'admin ajuste les lignes et envoie le devis définitif (PDF + lien d'acceptation à usage unique) → le client accepte ou refuse en ligne, depuis son espace ou depuis le lien.
- **Sans compte** : la demande crée un prospect ; si le visiteur crée ensuite un compte avec la même adresse, ses demandes y sont rattachées dès la confirmation de l'email.
- **Brouillon** : sauvegardé dans le navigateur, et sur le serveur pour un client connecté.
- **Expiration** : les devis envoyés passent en « expiré » à la fin de leur validité (tâche quotidienne à 2 h 15, heure d'Abidjan, et au démarrage de l'API).
- **PDF** : générés à la demande avec pdfkit et les polices du kit de marque (`server/assets/fonts`, converties en TTF car pdfkit ne sait pas extraire un sous-ensemble d'une police WOFF2).

## Rendez-vous et interventions

- **Créneaux** : calculés par l'API à partir des disponibilités (horaires par jour, durée, battement, capacité, techniciens, jours fermés, délai de prévenance, horizon), réglables dans `/admin/planning` > Disponibilités. Un créneau est revérifié au moment de la réservation : deux personnes ne peuvent pas prendre la dernière place.
- **Parcours** : réservation sur `/rendez-vous` (référence `INT-AAAA-NNNN`) → l'admin affecte un technicien → le technicien passe « en route », « en cours », « terminée » depuis son téléphone, remplit le rapport (travaux, temps, matériel, photos) et fait signer le client à l'écran → intervention « validée », rapport PDF dans l'espace client.
- **Temps réel** : Socket.io sur le même port que l'API (`/socket.io`), authentifié par le jeton d'accès, ou par un jeton de suivi en lecture seule pour la page publique `/suivi` (référence + téléphone ou email).
- **Report et annulation** : en ligne jusqu'à `cancelCutoffHours` avant l'intervention (24 h par défaut).
- **Rappels** : email la veille, vérifié toutes les 15 minutes (node-cron).
- **Photos** : JPEG ou PNG, 5 Mo maximum, contenu réel vérifié. Stockées dans Cloudinary en ressources privées si `CLOUDINARY_*` est renseigné, sinon dans `server/uploads` (développement). Elles ne sont jamais publiques : l'API les sert après contrôle des droits.

## Charte graphique

`client/src/brand/tokens.json` est la source de vérité : `npm run tokens -w client` (lancé automatiquement avant `dev` et `build`) génère `client/src/brand/tokens.css` (variables CSS clair/sombre, thème Tailwind, styles `text-h1`, `text-body`…). La vitrine des composants est sur `/design-system` en développement.

## Pré-rendu

Au build, les pages publiques sont générées en HTML statique avec le contenu de l'API (`VITE_API_URL`) : lancez l'API avant `npm run build` pour un HTML complet. Si l'API est injoignable, le build réussit quand même (liste des pages issue du seed, contenu chargé dans le navigateur). Dans le navigateur, chaque page se rafraîchit depuis l'API, donc une modification faite dans l'admin est visible sans rebuild.

Les pages non pré-rendues (connexion, espaces connectés) doivent être servies par `client/build/client/__spa-fallback.html` : configurez la réécriture de l'hébergeur en conséquence (ex. Netlify : `/* /__spa-fallback.html 200`). `npm run preview` sert à la place la page d'accueil, ce qui provoque un avertissement d'hydratation sans conséquence en local.

## À savoir

- `NODE_ENV=production` dans votre shell empêche l'installation des devDependencies et fait échouer les tests React : utilisez `npm install --include=dev` et `NODE_ENV=test npm test`, ou retirez cette variable de votre profil.

Cadrage technique : [docs/phase-0-cadrage.md](docs/phase-0-cadrage.md).
