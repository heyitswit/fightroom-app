# Fight Room — API Reference

Documentation reverse-engineered pour l'app React Native Lille-Valenciennes.

---

## Base URL

```
https://fightroom.fr
```

## Auth

L'auth passe par un **Next.js Server Action** (pas une API REST classique). Le endpoint est la page `/sign-in` elle-même, appelée avec des headers spécifiques.

### Login

```
POST https://fightroom.fr/sign-in
Content-Type: text/plain;charset=UTF-8
next-action: 40ee68e67804a83b0025abe8b4881a8f93af166636
```

**Body** (text/plain, pas JSON)
```
[{"email":"user@example.com","password":"motdepasse"}]
```

**Réponse** — pas de body JSON, tout est dans les **Set-Cookie** de la réponse :
```
Set-Cookie: _medusa_jwt=eyJ...; Path=/; Max-Age=604800; Secure; HttpOnly; SameSite=strict
Set-Cookie: _medusa_locale=fr-FR; Path=/
```

> ⚠️ Le header `next-action` est un hash généré côté serveur Next.js. Il peut changer à chaque déploiement. Le récupérer dynamiquement :

```ts
async function getNextActionHash(): Promise<string> {
  const res = await fetch('https://fightroom.fr/sign-in');
  const html = await res.text();
  const match = html.match(/next-action[":\s]+([a-f0-9]{40,})/);
  if (!match) throw new Error('next-action hash introuvable');
  return match[1];
}
```

Appeler avant chaque login, passer le résultat dans le header `next-action`.

### Utiliser le JWT

Toutes les requêtes authentifiées doivent envoyer le JWT en cookie :

```ts
const headers = {
  'Cookie': [
    `_medusa_jwt=${jwt}`,
    `_medusa_region_id=reg_01KP9Z19XKXCGQC3HCH64EXA0R`,
    `_medusa_cart_id=${cartId}`,
    `_booking_device_id=${deviceId}`,
    `_medusa_locale=fr-FR`,
  ].join('; '),
  'Content-Type': 'application/json',
};
```

### Durée de session

```
Max-Age: 604800  →  7 jours
```
Stocker le JWT dans `expo-secure-store`, rafraîchir à expiration en rappelant le login.

### Implémentation React Native (expo-secure-store)

```ts
import * as SecureStore from 'expo-secure-store';
import { v4 as uuidv4 } from 'uuid';

const DEVICE_ID_KEY = 'fightroom_device_id';
const JWT_KEY = 'fightroom_jwt';
const CART_KEY = 'fightroom_cart_id';

async function getDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = uuidv4();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  return id;
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch('https://fightroom.fr/sign-in', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      'next-action': '40ee68e67804a83b0025abe8b4881a8f93af166636',
    },
    body: JSON.stringify([{ email, password }]),
  });

  // Extraire le JWT du Set-Cookie
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/_medusa_jwt=([^;]+)/);
  if (!match) throw new Error('Login échoué');

  const jwt = match[1];
  await SecureStore.setItemAsync(JWT_KEY, jwt);
  return jwt;
}

async function buildHeaders(extraHeaders = {}): Promise<HeadersInit> {
  const jwt = await SecureStore.getItemAsync(JWT_KEY);
  const cartId = await SecureStore.getItemAsync(CART_KEY);
  const deviceId = await getDeviceId();

  const cookies = [
    `_medusa_jwt=${jwt}`,
    `_medusa_region_id=reg_01KP9Z19XKXCGQC3HCH64EXA0R`,
    `_medusa_locale=fr-FR`,
    `_booking_device_id=${deviceId}`,
    cartId ? `_medusa_cart_id=${cartId}` : '',
  ].filter(Boolean).join('; ');

  return {
    'Cookie': cookies,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
}
```

Les autres cookies nécessaires :
```
_medusa_region_id=reg_01KP9Z19XKXCGQC3HCH64EXA0R   ← fixe
_medusa_cart_id=<cart_id>                            ← obtenu à la 1ère réservation (ok réponse de selections/confirm)
_booking_device_id=<uuid>                            ← UUID v4 généré une fois, stocké en SecureStore
```

---

## IDs fixes (Lille-Valenciennes)

```
region_id:           reg_01KP9Z19XKXCGQC3HCH64EXA0R
plan_id (horaire):   01KP9Z1QHM0XT54E0KNV536B18

Salles :
  Ring               01KP9Z1QT8DHH7D1NYG3MYH503
  Octogone           01KP9Z1QTX2ZJ1P7H8HR1FSA5Q  ← même ID que le "lieu parent"
  Percussions        01KP9Z1QVMDQ4CK3X2ZX8T1JVJ
```

---

## Endpoints

### 1. Disponibilité mensuelle (calendrier)

```
GET /api/booking/availability
```

**Params**
| Param | Valeur |
|---|---|
| `resource_id` | ID de la salle |
| `plan_id` | `01KP9Z1QHM0XT54E0KNV536B18` |
| `view` | `month` |
| `anchor_date` | `YYYY-MM-01` |

**Exemple**
```
GET /api/booking/availability?resource_id=01KP9Z1QT8DHH7D1NYG3MYH503&plan_id=01KP9Z1QHM0XT54E0KNV536B18&view=month&anchor_date=2026-06-01
```

**Réponse**
```json
{
  "booking_resource": { "id": "...", "timezone": "Europe/Paris" },
  "booking_plan": {
    "id": "...",
    "name": "Location Horaire",
    "kind": "duration",
    "min_duration_minutes": 60,
    "max_duration_minutes": 480,
    "start_time_increment_minutes": 60,
    "duration_increment_minutes": 60
  },
  "availability": [
    {
      "date": "2026-06-01T00:00:00.000Z",
      "is_available": true,
      "slots": [],
      "capacity": 1,
      "available_units": 1,
      "blocker": null
    }
  ]
}
```

> ⚠️ En vue `month`, `slots` est toujours `[]`. Utiliser `is_available` pour coloriser le calendrier.
> Un jour avec `blocker != null` est bloqué même si `is_available: true`.

---

### 2. Créneaux du jour

```
GET /api/booking/availability
```

**Params** — mêmes que ci-dessus mais `view=day` et `anchor_date=YYYY-MM-DD`

**Exemple**
```
GET /api/booking/availability?resource_id=01KP9Z1QT8DHH7D1NYG3MYH503&plan_id=01KP9Z1QHM0XT54E0KNV536B18&view=day&anchor_date=2026-06-10
```

**Réponse — slots**
```json
{
  "availability": [
    {
      "date": "2026-06-10T00:00:00.000Z",
      "is_available": true,
      "slots": [
        {
          "start": "2026-06-10T08:00:00.000Z",
          "end": "2026-06-10T22:00:00.000Z",
          "available": true,
          "capacity": 1,
          "available_units": 1,
          "max_contiguous_duration_minutes": 480
        }
      ]
    }
  ]
}
```

> Les slots représentent des **plages ouvertes**, pas des créneaux individuels.
> Pour générer les créneaux 1h, 2h, etc. : découper la plage en segments de `start_time_increment_minutes` (60 min).

**Logique de découpage (TypeScript)**
```ts
function generateSlots(slot: Slot, durationMin: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const durMs = durationMin * 60 * 1000;
  const incMs = 60 * 60 * 1000; // 60 min increment
  let cursor = new Date(slot.start).getTime();
  const end = new Date(slot.end).getTime();

  while (cursor + durMs <= end) {
    slots.push({
      start: new Date(cursor).toISOString(),
      end: new Date(cursor + durMs).toISOString(),
    });
    cursor += incMs;
  }
  return slots;
}
```

---

### 3. Ajouter au panier (confirmer une sélection)

```
POST /api/booking/selections/confirm
Content-Type: application/json
```

**Body**
```json
{
  "bookingResourceId": "01KP9Z1QT8DHH7D1NYG3MYH503",
  "bookingPlanId": "01KP9Z1QHM0XT54E0KNV536B18",
  "payload": {
    "kind": "duration",
    "start_at": "2026-06-10T08:00:00.000Z",
    "end_at": "2026-06-10T09:00:00.000Z",
    "duration_minutes": 60
  },
  "regionId": "reg_01KP9Z19XKXCGQC3HCH64EXA0R",
  "devCreateStaleBookingCartLine": false
}
```

**Réponse (succès)**
```json
{
  "ok": true,
  "cart_id": "cart_01KSAWSCF2EG6VNMTCAWJPDZ3V",
  "cart_line_item_id": "cali_01KSPW05NZ8MSNBR51DDM5JMMB",
  "booking_cart_item": {
    "id": "cali_01KSPW05NZ8MSNBR51DDM5JMMB",
    "cart_line_item_id": "cali_01KSPW05NZ8MSNBR51DDM5JMMB",
    "quoted_unit_price": 11,
    "currency_code": "eur",
    "expires_at": "2026-06-10T08:44:45.667Z"
  },
  "booking_cart_items": [
    {
      "id": "cali_...",
      "cart_id": "cart_...",
      "booking_resource_id": "01KP9Z1QT8DHH7D1NYG3MYH503",
      "booking_plan_id": "01KP9Z1QHM0XT54E0KNV536B18",
      "resource_title": "Ring",
      "plan_name": "Location Horaire",
      "plan_kind": "duration",
      "start_time": "2026-06-10T08:00:00.000Z",
      "end_time": "2026-06-10T09:00:00.000Z",
      "time_zone": "Europe/Paris",
      "hold_expires_at": "2026-06-10T08:44:45.667Z",
      "quoted_unit_price": 11,
      "currency_code": "eur"
    }
  ]
}
```

> ⚠️ Le hold expire au bout de **15 minutes**. Rediriger l'utilisateur vers le checkout avant.
> `quoted_unit_price` est en **centimes** (11 = 11€ ou 0.11€ — à valider avec un vrai test).

---

### 4. Panier courant

```
GET /api/booking/cart-summary
```

**Réponse**
```json
{
  "cartId": "cart_01KSAWSCF2EG6VNMTCAWJPDZ3V",
  "entries": [...],
  "count": 1,
  "summaryTotal": 1100,
  "summaryCurrency": "eur"
}
```

```
GET /api/booking/cart
```
Retourne le détail complet du panier avec les allocations et conflits.

---

### 5. Historique réservations client

```
GET /api/booking/customer-bookings
```

**Réponse**
```json
{
  "bookings": [],
  "count": 0,
  "offset": 0,
  "limit": 50
}
```

---

### 6. Infos client connecté

```
GET /api/storefront/customer
```

**Réponse**
```json
{
  "customer": {
    "id": "cus_...",
    "email": "...",
    "first_name": "...",
    "last_name": "..."
  }
}
```

---

### 7. Checkout (hors scope app)

Une fois la réservation dans le panier, rediriger vers :
```
https://fightroom.fr/cart
```

---

## Règles métier importantes

| Règle | Valeur |
|---|---|
| Durée min | 60 min |
| Durée max | 480 min (8h) |
| Incrément de début | toutes les 60 min |
| Incrément de durée | 60 min |
| Hold après sélection | 15 minutes |
| Timezone | `Europe/Paris` |
| Cutoff même jour | non défini (null) |

---

## Stack suggérée pour React Native

```
react-native-reusables   → composants UI
expo-router              → navigation
@tanstack/react-query    → fetching + cache des dispos
zustand                  → state panier
expo-secure-store        → stockage JWT
date-fns                 → manipulation dates/créneaux
```

### Fetching avec react-query (exemple)

```ts
import { useQuery } from '@tanstack/react-query';

export function useMonthAvailability(resourceId: string, year: number, month: number) {
  const anchor = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return useQuery({
    queryKey: ['availability', resourceId, anchor],
    queryFn: async () => {
      const res = await fetch(
        `https://fightroom.fr/api/booking/availability?resource_id=${resourceId}&plan_id=01KP9Z1QHM0XT54E0KNV536B18&view=month&anchor_date=${anchor}`,
        { headers: { Cookie: `_medusa_jwt=${jwt}; _medusa_region_id=reg_01KP9Z19XKXCGQC3HCH64EXA0R` } }
      );
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

---

## Screens à implémenter

```
/                  → sélection salle (Ring / Octogone / Percussions)
/booking           → calendrier + créneaux
/booking/confirm   → récap + bouton payer
/cart              → WebView fightroom.fr/cart
/bookings          → historique (GET /api/booking/customer-bookings)
```
