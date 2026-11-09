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

Cadrage technique : [docs/phase-0-cadrage.md](docs/phase-0-cadrage.md).
