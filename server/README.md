# Fight Room — Serveur de partage (Lacis)

Petit serveur qui permet aux utilisateurs Fight Room de **partager les codes
d'accès** d'une réservation avec leurs amis. Il **ne remplace pas** l'API
fightroom.fr : il ne fait que gérer les amis et les partages.

Construit avec [Lacis](https://lacis.lycia.dev) (routing par fichiers, zéro
dépendance runtime). Tourne sur **Node** (cible par défaut) ou **Bun**.

## Identité / comptes

Pas de système de compte maison. L'identité = le compte Fight Room existant :
l'app envoie son JWT Medusa (`_medusa_jwt`) dans l'en-tête
`Authorization: Bearer <jwt>`. Le middleware `requireAuth` le valide en appelant
`fightroom.fr/api/storefront/customer` pour récupérer le vrai `customer_id` /
email (résultat mis en cache 5 min). Aucun mot de passe n'est stocké côté serveur.

## Lancer en local

```bash
cd server
bun install        # ou: npm install
bun run dev        # ou: npm run dev  → http://localhost:3000
```

Les données sont écrites dans `server/data/db.json` (gitignoré).

## Endpoints

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/` | Health check (public) |
| `GET` | `/me` | Utilisateur courant |
| `GET` | `/friends` | Liste des amis |
| `DELETE` | `/friends/:id` | Supprimer un ami (`id` = id de la demande acceptée) |
| `GET` | `/friends/requests` | Demandes en attente (`incoming` / `outgoing`) |
| `POST` | `/friends/requests` | Envoyer une demande `{ email }` |
| `PATCH` | `/friends/requests/:id` | `{ action: 'accept' \| 'decline' }` |
| `DELETE` | `/friends/requests/:id` | Annuler une demande envoyée |
| `GET` | `/shares` | Partages `received` (pull auto) et `sent` |
| `POST` | `/shares` | Partager `{ toEmail, booking }` (amis uniquement) |
| `DELETE` | `/shares/:id` | Supprimer un partage |

Toutes les routes (sauf `/`) exigent `Authorization: Bearer <jwt Medusa>`.

## Déploiement

### Node (recommandé)

Filesystem persistant → le store JSON fonctionne tel quel.

```bash
NODE_ENV=production PORT=3000 bun run start   # ou: npm run start
```

Derrière un process manager (pm2, systemd…) et un reverse proxy HTTPS.
Configure ensuite `EXPO_PUBLIC_SHARE_API_URL` dans l'app vers cette URL.

### Serverless (Vercel / Netlify)

Lacis supporte Vercel/Netlify (`api/[...slug].ts`, `vercel.json`,
`netlify/functions/api.ts`, `netlify.toml` fournis, build via `lacis build`).

⚠️ **Limite technique** : ces plateformes n'ont **pas de filesystem
persistant**, donc le store JSON par défaut (`src/store.ts`) ne persiste pas.
Pour déployer en serverless, remplace `src/store.ts` par une implémentation
KV/Redis (ex. Upstash) en gardant la même surface de fonctions exportées. C'est
la raison pour laquelle la cible par défaut est Node.
