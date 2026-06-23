# Fight Room — Monorepo

Application compagnon non-officielle pour [fightroom.fr](https://fightroom.fr). Permet de consulter les lieux, réserver une salle de combat et gérer ses réservations depuis son téléphone.

Ce dépôt est un **monorepo** :

| Package | Emplacement | Rôle |
|---|---|---|
| App mobile | racine (`app/`, `components/`, `lib/`…) | App Expo / React Native |
| Serveur de partage | [`server/`](./server) | Serveur Lacis pour partager les codes d'accès entre amis (ne remplace pas l'API fightroom.fr) |

> **Build Android :** [Télécharger sur Expo](https://expo.dev/artifacts/eas/hnePumutqm8a1nmFisM3xa.apk)
>
> <img src="pictures/qr_code_build.png" width="160"/>

---

## Aperçu

<table>
  <tr>
    <td align="center"><b>Lieux</b></td>
    <td align="center"><b>Salles d'un lieu</b></td>
    <td align="center"><b>Réservation</b></td>
    <td align="center"><b>Mes réservations</b></td>
    <td align="center"><b>Codes d'accès</b></td>
  </tr>
  <tr>
    <td><img src="pictures/accueil.png" width="160"/></td>
    <td><img src="pictures/liste_room.png" width="160"/></td>
    <td><img src="pictures/book_room.png" width="160"/></td>
    <td><img src="pictures/bookings.png" width="160"/></td>
    <td><img src="pictures/booking_detail.png" width="160"/></td>
  </tr>
</table>

---

## Fonctionnalités

- **Liste des lieux** — carte OSM intégrée par lieu, adresse, nombre de salles
- **Réservation** — calendrier, choix de durée et créneau, ajout au panier fightroom.fr
- **Réservations** — suivi des réservations à venir ; historique (terminées/annulées) accessible via toggle
- **Codes d'accès** — netcodes affichés et copiables depuis la réservation, avec statut traduit (Actif, Autorisé, Programmé…)
- **Ouvrir sur Maps** — lien direct vers l'adresse dans l'app Maps native
- **Annulation** — prévisualisation du remboursement avant confirmation
- **Session persistante** — reconnexion automatique silencieuse à l'expiration du JWT (détection du 307 `/account` → `/sign-in`)
- **Amis & partage** — ajout d'amis par email (comptes Fight Room), partage des codes d'accès d'une réservation ; le destinataire récupère automatiquement l'heure et les codes

## Stack

- [Expo](https://expo.dev) / React Native (SDK 54)
- [Expo Router](https://docs.expo.dev/router/introduction/) — navigation fichier
- [TanStack Query](https://tanstack.com/query) — cache et fetching
- [react-native-reusables](https://github.com/mrzachnugent/react-native-reusables) — composants UI (NativeWind)

## Lancer en local

```bash
bun install        # installe l'app + le serveur (workspaces)
bun run dev        # app Expo
bun run server     # serveur de partage (http://localhost:3000)
```

Pour que l'app cible le serveur, définir `EXPO_PUBLIC_SHARE_API_URL` (défaut :
`http://localhost:3000`). Détails du serveur : [`server/README.md`](./server/README.md).
