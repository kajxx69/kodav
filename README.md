# Plateforme KODAV Technologies

Monorepo npm workspaces : `client` (React + React Router 8, pré-rendu des pages publiques), `server` (API Express 5 + MongoDB), `shared` (schémas Zod et utilitaires communs).

## Démarrage

Prérequis : Node.js 22 LTS ou plus récent.

```bash
npm install
cp .env.example .env   # puis renseigner au minimum MONGODB_URI
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

## Charte graphique

`client/src/brand/tokens.json` est la source de vérité : `npm run tokens -w client` (lancé automatiquement avant `dev` et `build`) génère `client/src/brand/tokens.css` (variables CSS clair/sombre, thème Tailwind, styles `text-h1`, `text-body`…). La vitrine des composants est sur `/design-system` en développement.

## Pré-rendu

Au build, les pages publiques sont générées en HTML statique avec le contenu de l'API (`VITE_API_URL`) : lancez l'API avant `npm run build` pour un HTML complet. Si l'API est injoignable, le build réussit quand même (liste des pages issue du seed, contenu chargé dans le navigateur). Dans le navigateur, chaque page se rafraîchit depuis l'API, donc une modification faite dans l'admin est visible sans rebuild.

## À savoir

- `NODE_ENV=production` dans votre shell empêche l'installation des devDependencies et fait échouer les tests React : utilisez `npm install --include=dev` et `NODE_ENV=test npm test`, ou retirez cette variable de votre profil.

Cadrage technique : [docs/phase-0-cadrage.md](docs/phase-0-cadrage.md).
