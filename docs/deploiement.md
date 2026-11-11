# Guide de déploiement

Architecture conseillée :

- **Front** : site statique pré-rendu (`client/build/client`) sur Netlify ou Vercel ;
- **API** : service Node (Express et Socket.io) sur Render ou Railway ;
- **Base** : MongoDB Atlas ;
- **Domaine** : `kodav.ci` pour le site, `api.kodav.ci` pour l'API.

Avec ce découpage, le site et l'API partagent le même domaine principal : le cookie de session reste en `COOKIE_SAMESITE=strict`.

## 1. MongoDB Atlas

1. Créez un utilisateur dédié à la production (Database Access), avec le rôle `readWrite` sur la base `kodav` uniquement et un mot de passe généré.
2. **Accès réseau** (Network Access) :
   - Render et Railway n'ont pas d'adresse IP fixe sur les offres de base. Deux possibilités :
     - autoriser `0.0.0.0/0`, en vous appuyant sur un mot de passe long et un utilisateur limité à une seule base ;
     - souscrire à l'option d'IP sortante fixe de l'hébergeur et n'autoriser que ces adresses (recommandé).
   - Retirez les adresses de développement qui ne servent plus.
3. Récupérez la chaîne de connexion (Connect, puis Drivers) et ajoutez le nom de la base : `mongodb+srv://<utilisateur>:<mot-de-passe>@cluster0.xxxxx.mongodb.net/kodav?retryWrites=true&w=majority`.
4. Activez les sauvegardes du cluster (offre M10 et plus) ou planifiez un `mongodump` régulier.

## 2. API sur Render ou Railway

Réglages du service (Web Service sur Render, service sur Railway) :

| Réglage         | Valeur                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| Dossier racine  | racine du dépôt                                                        |
| Version de Node | 22 ou plus (`NODE_VERSION=22` sur Render)                              |
| Build           | `npm ci --include=dev && npm run build -w shared -w server`            |
| Démarrage       | `npm run start -w server`                                              |
| Sonde de santé  | `/api/v1/health`                                                       |
| Instances       | **une seule** (les tâches planifiées et Socket.io tournent en mémoire) |

L'API doit tourner en continu : les rappels de rendez-vous, l'expiration des devis et les alertes de licences sont planifiés dans le processus. Évitez les offres gratuites qui mettent le service en veille.

### Variables d'environnement de l'API

Renseignez-les dans l'interface de l'hébergeur, jamais dans le dépôt :

| Variable                                                                       | Valeur de production                                                                           |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                     | `production`                                                                                   |
| `PORT`                                                                         | fourni par l'hébergeur (ne pas forcer sur Render)                                              |
| `API_URL`                                                                      | `https://api.kodav.ci`                                                                         |
| `CLIENT_URL`                                                                   | `https://kodav.ci`                                                                             |
| `CORS_ORIGINS`                                                                 | `https://kodav.ci,https://www.kodav.ci`                                                        |
| `TZ`                                                                           | `Africa/Abidjan`                                                                               |
| `MONGODB_URI`                                                                  | chaîne Atlas de production                                                                     |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`                                      | deux valeurs aléatoires différentes (48 octets)                                                |
| `COOKIE_SAMESITE`                                                              | `strict` (site et API sur le même domaine principal)                                           |
| `ENCRYPTION_KEY`                                                               | 32 octets en base64, **à conserver** : sans elle, les clés de licence confiées sont illisibles |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | compte d'envoi (Brevo, Mailjet, Gmail Workspace…)                                              |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`         | obligatoires en production : le disque des hébergeurs est effacé à chaque déploiement          |
| `TURNSTILE_ENABLED`, `TURNSTILE_SECRET_KEY`                                    | anti-spam des formulaires publics (recommandé)                                                 |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`                                      | premier compte administrateur                                                                  |
| `SEED_TEST_PASSWORD`                                                           | **vide** : aucun compte de test en production                                                  |

Générer les secrets :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"      # ENCRYPTION_KEY
```

### Premier démarrage

Une fois l'API en ligne, lancez une fois le seed depuis le shell de l'hébergeur : `npm run seed`. Il crée le catalogue, les formules, les paramètres et le compte administrateur, sans jamais modifier un compte qui existe déjà. Connectez-vous ensuite, changez le mot de passe administrateur, puis remplacez les tarifs d'exemple dans **Admin, puis Catalogue** (un bandeau les signale sur le tableau de bord).

## 3. Front sur Netlify ou Vercel

Le front est un site statique. Ses variables `VITE_*` sont lues **au build** et visibles dans le navigateur : n'y mettez rien de secret.

| Variable                  | Valeur                             |
| ------------------------- | ---------------------------------- |
| `VITE_API_URL`            | `https://api.kodav.ci/api/v1`      |
| `VITE_SITE_URL`           | `https://kodav.ci`                 |
| `VITE_TURNSTILE_SITE_KEY` | clé publique Turnstile (si activé) |
| `NODE_VERSION`            | `22`                               |

L'API de production doit répondre pendant le build : le pré-rendu y lit le catalogue et les contenus. Sans elle, le build réussit quand même, mais les pages se remplissent dans le navigateur, ce qui est moins bon pour le référencement. Après une modification importante du catalogue dans l'admin, relancez un déploiement du front pour mettre à jour le HTML pré-rendu et le sitemap.

### Netlify

- Commande de build : `npm ci --include=dev && npm run build -w shared && npm run build -w client`
- Dossier publié : `client/build/client`
- Fichier `netlify.toml` à la racine du dépôt :

```toml
[[redirects]]
  from = "/*"
  to = "/__spa-fallback.html"
  status = 200

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"
```

Netlify sert d'abord les fichiers existants : les pages pré-rendues sont prioritaires, la réécriture ne s'applique qu'aux autres adresses.

### Vercel

- Framework : « Other », commande de build identique, dossier de sortie `client/build/client`.
- Fichier `vercel.json` à la racine :

```json
{
  "rewrites": [{ "source": "/((?!.*\\.).*)", "destination": "/__spa-fallback.html" }],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
  ]
}
```

## 4. Nom de domaine

1. **Site** : chez votre registraire (.ci : NIC CI ou un revendeur agréé), créez les enregistrements indiqués par Netlify ou Vercel. En général :
   - un enregistrement `A` ou `ALIAS` pour `kodav.ci` ;
   - un `CNAME` pour `www`.
2. **API** : un `CNAME` `api` vers l'adresse fournie par Render ou Railway, puis ajoutez le domaine personnalisé dans l'interface du service.
3. Les certificats HTTPS sont émis automatiquement. Vérifiez que les deux adresses répondent en `https://` avant d'ouvrir le site.
4. Choisissez une adresse principale (`kodav.ci` ou `www.kodav.ci`), redirigez l'autre vers elle, et utilisez la même dans `CLIENT_URL`, `CORS_ORIGINS` et `VITE_SITE_URL`.
5. **Emails** : chez le fournisseur SMTP, configurez SPF, DKIM et DMARC pour le domaine de `MAIL_FROM`, sinon les emails (devis, factures, bilans) risquent d'arriver en indésirables.

## 5. Vérifications après mise en ligne

- `https://api.kodav.ci/api/v1/health` répond `ok` et indique la base connectée.
- Connexion administrateur, puis déconnexion et reconnexion (cookie de session).
- Demande de devis visiteur : email de confirmation reçu, demande visible dans l'admin.
- Envoi d'une photo dans un rapport d'intervention (Cloudinary).
- `https://kodav.ci/sitemap.xml` et `https://kodav.ci/robots.txt` contiennent bien l'URL de production.
- Déclarez le sitemap dans Google Search Console et créez la fiche Google Business Profile (recherche locale à Abidjan).
- Lighthouse mobile sur l'accueil et une fiche service : objectif 90 ou plus.

## 6. Mises à jour

- Chaque push sur `main` peut redéployer automatiquement le front et l'API.
- Avant de pousser : `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`.
- Le service worker est versionné (`VERSION` dans `client/public/sw.js`). Les fichiers du build changent de nom à chaque version, donc aucune action n'est nécessaire ; augmentez `VERSION` seulement si vous modifiez la stratégie de cache.
