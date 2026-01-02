# API Documentation

Documentation des endpoints disponibles dans l'API Doxa.ai.

## Sommaire

### Health Check
- [GET /health](#get-health)

### Presets
- [GET /presets](#get-presets)
- [GET /presets/:id](#get-presetsid)

### Users
- [GET /users/me](#get-usersme)
- [GET /users/:id](#get-usersid)

### Games
- [POST /games](#post-games)
- [GET /games](#get-games)
- [GET /games/:id](#get-gamesid)
- [GET /games/:id/countries](#get-gamesidcountries)
- [GET /games/:id/events](#get-gamesidevents)
- [GET /games/:id/chat](#get-gamesidchat)
- [POST /games/:id/country-chat](#post-gamesidcountry-chat)
- [POST /games/:id/country-chat/:chatId/send-message](#post-gamesidcountry-chatchatidsend-message)
- [POST /games/:id/country-chat/:chatId/request-message](#post-gamesidcountry-chatchatidrequest-message) (INTERNE)
- [POST /games/:id/actions](#post-gamesidactions)
- [DELETE /games/:id/actions/:actionId](#delete-gamesidactionsactionid)
- [POST /games/:id/advisor/chat](#post-gamesidadvisorchat)
- [POST /games/:id/move-forward](#post-gamesidmove-forward)
- [GET /games/:id/indicators](#get-gamesidindicators)
- [GET /games/:id/reactions](#get-gamesidreactions)

---

## Base URL

Par défaut : `http://localhost:3000`

## Authentification (Mock)

Pour l'instant, l'authentification est mockée. Utilisez le header `x-user-id` pour identifier l'utilisateur connecté.

```
x-user-id: <user-uuid>
```

---

## Health Check

### `GET /health`

Vérifie l'état du serveur.

**Réponse :**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Presets

### `GET /presets`

Récupère la liste de tous les presets disponibles.

**Réponse :**
```json
[
  {
    "id": "uuid",
    "hasProvinces": false,
    "playedCount": 0,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### `GET /presets/:id`

Récupère les détails d'un preset spécifique, incluant tous ses pays.

**Paramètres :**
- `id` (path) : UUID du preset

**Réponse :**
```json
{
  "id": "uuid",
  "hasProvinces": false,
  "advisorPrompt": "...",
  "eventPrompt": "...",
  "chatPrompt": "...",
  "playedCount": 0,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "presetCountries": [
    {
      "id": "uuid",
      "name": "France",
      "color": "#FF0000",
      "independant": true,
      "ownedBy": null,
      "surname": null,
      "svgId": "FR"
    }
  ]
}
```

**Codes d'erreur :**
- `404` : Preset non trouvé

---

## Users

### `GET /users/me`

Récupère les informations de l'utilisateur connecté.

**Headers requis :**
- `x-user-id` : UUID de l'utilisateur

**Réponse :**
```json
{
  "id": "uuid",
  "username": "user@example.com",
  "userType": "USER",
  "balance": 1000,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Codes d'erreur :**
- `401` : Non autorisé (header manquant)
- `404` : Utilisateur non trouvé

### `GET /users/:id`

Récupère les informations d'un utilisateur spécifique.

**Paramètres :**
- `id` (path) : UUID de l'utilisateur

**Réponse :**
```json
{
  "id": "uuid",
  "username": "user@example.com",
  "userType": "USER",
  "balance": 1000,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Codes d'erreur :**
- `404` : Utilisateur non trouvé

---

## Games

### `POST /games`

Crée un nouveau jeu à partir d'un preset.

**Headers requis :**
- `x-user-id` : UUID de l'utilisateur

**Body :**
```json
{
  "presetId": "uuid",
  "selectedCountryId": "uuid" // Optionnel : UUID du pays choisi dans le preset
}
```

**Réponse :**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "presetId": "uuid",
  "currentTurn": 0,
  "trame": "",
  "gameOver": false,
  "currentIngameDate": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "indicators": {
    "resources": 50,
    "popularity": 50,
    "power": 50
  }
}
```

**Codes d'erreur :**
- `400` : Requête invalide (presetId manquant ou pays choisi invalide)
- `401` : Non autorisé
- `404` : Preset non trouvé
- `500` : Erreur serveur

**Notes :**
- Crée le jeu avec `currentTurn = 0`
- Clone automatiquement tous les pays du preset vers le jeu
- Initialise les indicateurs à 50/50/50
- Aucune IA, token, narration ou action n'est exécutée lors de la création

### `GET /games`

Récupère la liste des jeux. Si le header `x-user-id` est fourni, filtre les jeux par utilisateur.

**Headers optionnels :**
- `x-user-id` : UUID de l'utilisateur (pour filtrer)

**Réponse :**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "presetId": "uuid",
    "trame": "Résumé du monde...",
    "currentTurn": 1,
    "currentIngameDate": "2020-01-01",
    "tokensSpent": 0,
    "gameOver": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastPlay": "2024-01-01T00:00:00.000Z",
    "preset": {
      "id": "uuid",
      "hasProvinces": false
    }
  }
]
```

### `GET /games/:id`

Récupère les détails complets d'un jeu spécifique.

**Paramètres :**
- `id` (path) : UUID du jeu

**Réponse :**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "presetId": "uuid",
  "trame": "Résumé du monde...",
  "currentTurn": 1,
  "currentIngameDate": "2020-01-01",
  "tokensSpent": 0,
  "gameOver": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "lastPlay": "2024-01-01T00:00:00.000Z",
  "preset": {
    "id": "uuid",
    "hasProvinces": false
  },
  "user": {
    "id": "uuid",
    "username": "user@example.com"
  }
}
```

**Codes d'erreur :**
- `404` : Jeu non trouvé

### `GET /games/:id/countries`

Récupère tous les pays d'un jeu, triés par nom.

**Paramètres :**
- `id` (path) : UUID du jeu

**Réponse :**
```json
[
  {
    "id": "uuid",
    "name": "France",
    "color": "#FF0000",
    "independant": true,
    "ownedBy": null,
    "surname": null,
    "svgId": "FR",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Codes d'erreur :**
- `404` : Jeu non trouvé

### `GET /games/:id/events`

Récupère tous les événements (GameEvents) d'un jeu, triés par tour décroissant.

**Paramètres :**
- `id` (path) : UUID du jeu

**Réponse :**
```json
[
  {
    "id": "uuid",
    "turn": 1,
    "date": "2020-01-01",
    "resume": "Résumé de l'événement",
    "text": "Texte complet de l'événement",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Codes d'erreur :**
- `404` : Jeu non trouvé

**Note :** Les événements sont triés par tour décroissant.

### `POST /games/:id/country-chat`

Crée un nouveau chat diplomatique entre 1 à 5 pays. Peut être déclenché par l'utilisateur ou par des mécanismes internes.

**Paramètres :**
- `id` (path) : UUID de la game

**Headers :**
- `x-user-id` (optionnel) : UUID de l'utilisateur. Si fourni, vérifie que l'utilisateur est le propriétaire de la game. Si non fourni, permet aux mécanismes internes de créer le chat.

**Body :**
```json
{
  "countryIds": ["uuid-country-1", "uuid-country-2", "uuid-country-3"]
}
```

**Validation :**
- `countryIds` doit être un tableau
- Le tableau doit contenir entre 1 et 5 pays
  - 1 pays = chat 1-à-1 avec l'utilisateur
  - 2-5 pays = chat multi-participants avec l'utilisateur
- Tous les pays doivent exister dans `game_countries` pour cette game
- Les doublons ne sont pas autorisés

**Réponse (201 Created) :**
```json
{
  "id": "uuid",
  "gameId": "uuid",
  "globalTrame": "",
  "currentTurnContext": "",
  "countries": [
    {
      "country": {
        "id": "uuid",
        "name": "France",
        "svgId": "FR",
        "color": "#0000FF",
        "independant": true
      },
      "countryTrame": ""
    }
  ],
  "messages": [],
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Codes d'erreur :**
- `400` : Validation échouée (tableau invalide, nombre de pays incorrect, doublons)
- `403` : Utilisateur non autorisé (si x-user-id fourni mais n'est pas le propriétaire)
- `404` : Game non trouvée ou certains pays non trouvés dans la game
- `500` : Erreur serveur

**Notes :**
- Si `x-user-id` n'est pas fourni, la route peut être utilisée par des mécanismes internes
- Le chat est créé avec des trames vides qui seront remplies lors des échanges diplomatiques
- Les messages peuvent être ajoutés ultérieurement via d'autres endpoints

---

### `POST /games/:id/country-chat/:chatId/send-message`

Envoie un message dans un chat diplomatique. Cette route est **uniquement utilisable par l'utilisateur** (pas par les mécanismes internes).

**Paramètres :**
- `id` (path) : UUID de la game
- `chatId` (path) : UUID du chat diplomatique

**Headers :**
- `x-user-id` (requis) : UUID de l'utilisateur. L'utilisateur doit être le propriétaire de la game.

**Body :**
```json
{
  "message": "Bonjour, je souhaite discuter d'un accord commercial."
}
```

**Validation :**
- `x-user-id` est obligatoire
- `message` doit être une chaîne non vide
- L'utilisateur doit être propriétaire de la game
- Le chat doit exister et appartenir à la game
- La game ne doit pas être terminée

**Réponse (201 Created) :**
```json
{
  "id": "uuid",
  "chatId": "uuid",
  "gameId": "uuid",
  "userId": "uuid",
  "countryName": "France",
  "content": "Bonjour, je souhaite discuter d'un accord commercial.",
  "ingameDate": "2020-01-15",
  "tokenCost": 0,
  "react": null,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Codes d'erreur :**
- `400` : Validation échouée (message vide, game terminée)
- `401` : Non autorisé (x-user-id manquant)
- `403` : Interdit (utilisateur n'est pas propriétaire de la game)
- `404` : Game non trouvée ou chat non trouvé
- `500` : Erreur serveur

**Notes :**
- ⚠️ Cette route est **uniquement utilisable par l'utilisateur** (x-user-id obligatoire)
- Le `countryName` correspond au nom du pays sélectionné par l'utilisateur dans la game
- Le message est limité à 2000 caractères (sanitization automatique)
- `tokenCost` est toujours 0 pour les messages utilisateur
- Cette route ne génère **pas** de réponse automatique de l'IA (utiliser d'autres endpoints pour cela)

---

### `POST /games/:id/country-chat/:chatId/request-message` (INTERNE)

API **interne** pour demander un message à l'IA. Cette route est destinée aux mécanismes internes du système et ne nécessite pas d'authentification utilisateur.

**Paramètres :**
- `id` (path) : UUID de la game
- `chatId` (path) : UUID du chat diplomatique

**Body :**
```json
{
  "trame": "string",
  "messages": [
    {
      "userId": "uuid | null",
      "countryName": "string | null",
      "content": "string",
      "ingameDate": "string | null"
    }
  ],
  "gauges": {
    "economy": 50,
    "power": 50,
    "popularity": 50
  },
  "chatPrompt": "string",
  "difficulty": "easy | medium | hard | simulation",
  "difficultyPrompt": "string",
  "actingCountry": {
    "name": "string",
    "independant": true,
    "ownedBy": "string | null",
    "surname": "string | null"
  },
  "targetCountries": [
    {
      "name": "string",
      "gauges": {
        "power": 50,
        "economy": 50,
        "relationship": 50
      }
    }
  ],
  "ingameDate": "string | null",
  "lore": "string",
  "underlyingPressures": "string"
}
```

**Validation :**
- `trame` (requis) : Trame diplomatique de la game
- `gauges` (requis) : Jauges du pays utilisateur (economy, power, popularity)
- `chatPrompt` (requis) : Prompt de règles diplomatiques
- `difficulty` (requis) : Niveau de difficulté
- `actingCountry` (requis) : Pays qui parle (doit avoir un `name`)
- `targetCountries` (requis) : Tableau des pays cibles
- `messages` (optionnel) : Historique des messages de la discussion
- `ingameDate` (optionnel) : Date in-game
- `lore` (optionnel) : Contexte historique du preset
- `underlyingPressures` (optionnel) : Pressions sous-jacentes

**Réponse (200 OK) :**
```json
{
  "message": "Réponse diplomatique générée par l'IA",
  "leaveAfterTalking": false,
  "leaveDate": "2020-01-15 | null"
}
```

**Codes d'erreur :**
- `400` : Validation échouée (paramètres manquants ou invalides)
- `404` : Chat non trouvé ou game non trouvée
- `500` : Erreur serveur ou réponse IA invalide après retry

**Notes :**
- ⚠️ Cette route est **interne** et ne nécessite pas d'authentification utilisateur
- Le message généré est limité à 2000 caractères (sanitization automatique)
- La route implémente une logique de retry (jusqu'à 3 tentatives) en cas de réponse IA invalide
- Le contexte est envoyé à l'IA sous forme de JSON structuré
- Le prompt système combine `chatPrompt` + `difficultyPrompt` + instructions de difficulté

---

### `POST /games/:id/actions`

Crée des actions de jeu pour le tour actuel. L'utilisateur peut créer entre 0 et 10 actions par tour.

**Headers requis :**
```
x-user-id: <user-uuid>
```

**Body :**
```json
{
  "actions": [
    {
      "content": "Renforcer l'armée de 10%"
    },
    {
      "content": "Négocier un traité commercial avec l'Allemagne"
    }
  ]
}
```

**Paramètres :**
- `actions` (array, requis) : Tableau d'actions à créer (1 à 10 actions)
  - `content` (string, requis) : Contenu de l'action

**Réponse :**
```json
{
  "actions": [
    {
      "id": "uuid",
      "turn": 1,
      "ingameDate": "2020-01-01",
      "content": "Renforcer l'armée de 10%",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "uuid",
      "turn": 1,
      "ingameDate": "2020-01-01",
      "content": "Négocier un traité commercial avec l'Allemagne",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Codes d'erreur :**
- `400` : Tableau d'actions invalide (vide, trop d'actions, contenu manquant)
- `401` : Non autorisé (header x-user-id manquant)
- `403` : Non autorisé (pas le propriétaire du jeu)
- `404` : Jeu non trouvé
- `400` : Jeu terminé

**Note :** Les actions sont automatiquement associées au tour actuel (`currentTurn`) et à la date in-game actuelle (`currentIngameDate`) de la partie.

### `DELETE /games/:id/actions/:actionId`

Supprime une action du tour actuel créée par l'utilisateur.

**Headers requis :**
```
x-user-id: <user-uuid>
```

**Paramètres :**
- `id` (path) : UUID du jeu
- `actionId` (path) : UUID de l'action à supprimer

**Réponse :**
```json
{
  "message": "Action deleted successfully",
  "actionId": "uuid"
}
```

**Codes d'erreur :**
- `400` : Action n'appartient pas au tour actuel ou au jeu, ou jeu terminé
- `401` : Non autorisé (header x-user-id manquant)
- `403` : Non autorisé (pas le propriétaire du jeu ou de l'action)
- `404` : Jeu ou action non trouvé

**Notes :**
- Seules les actions du tour actuel peuvent être supprimées
- Seul le propriétaire de l'action peut la supprimer
- Les actions ne peuvent pas être supprimées si le jeu est terminé

### `POST /games/:id/advisor/chat`

Envoie un message au conseiller et retourne sa réponse IA.

**Headers requis :**
- `x-user-id` : UUID de l'utilisateur

**Paramètres :**
- `id` (path) : UUID du jeu

**Body :**
```json
{
  "message": "Dois-je renforcer mon armée cette année ?"
}
```

**Réponse :**
```json
{
  "id": "uuid",
  "content": "Réponse de l'advisor...",
  "sender": "advisor",
  "tokenCost": 150,
  "usage": {
    "prompt_tokens": 500,
    "completion_tokens": 150,
    "total_tokens": 650
  },
  "newBalance": 350,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Codes d'erreur :**
- `400` : Requête invalide (message manquant ou jeu terminé)
- `401` : Non autorisé
- `402` : Solde insuffisant
- `403` : Non autorisé (pas le propriétaire du jeu)
- `404` : Jeu non trouvé
- `500` : Erreur serveur ou service IA non configuré

**Notes :**
- Le contexte envoyé à l'IA inclut : lore du preset, prompt advisor, trame du jeu, tour actuel, date in-game, indicateurs (money/popularity/power), et uniquement les messages du tour courant
- Les tokens sont débités exactement selon l'usage retourné par DeepSeek (total_tokens)
- Aucun impact sur le monde (pas d'action, pas de Jump Forward)
- Les messages sont persistés dans la base de données avec les coûts en tokens

### `GET /games/:id/chat`

Récupère tous les chats d'un jeu (advisor et country chats).

**Paramètres :**
- `id` (path) : UUID du jeu

**Réponse :**
```json
{
  "advisorChat": {
    "id": "uuid",
    "advisorTrame": "Résumé de la conversation avec l'advisor...",
    "currentTurnContext": "Contexte du tour actuel...",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "messages": [
      {
        "id": "uuid",
        "sender": "user",
        "content": "Message de l'utilisateur",
        "tokenCost": 5,
        "createdAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": "uuid",
        "sender": "advisor",
        "content": "Réponse de l'advisor",
        "tokenCost": 10,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  },
  "countryChats": [
    {
      "id": "uuid",
      "globalTrame": "Résumé diplomatique global...",
      "currentTurnContext": "Contexte du tour actuel...",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "messages": [
        {
          "id": "uuid",
          "countryName": "France",
          "content": "Message diplomatique",
          "react": "😊",
          "ingameDate": "2020-01-01",
          "tokenCost": 8,
          "createdAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "countries": [
        {
          "country": {
            "id": "uuid",
            "name": "France",
            "svgId": "FR"
          },
          "countryTrame": "Résumé diplomatique de la France..."
        }
      ]
    }
  ]
}
```

**Codes d'erreur :**
- `404` : Jeu non trouvé

### `POST /games/:id/move-forward`

Fait avancer le jeu d'un tour en simulant l'évolution du monde sur une période de 1 jour à 6 mois. Appelle le World Engine AI pour générer des événements, mettre à jour les indicateurs, et gérer les conséquences des actions du joueur.

**Headers requis :**
```
x-user-id: <user-uuid>
```

**Paramètres :**
- `id` (path) : UUID du jeu

**Réponse :**
```json
{
  "events": [
    {
      "id": "uuid",
      "date": "2020-02-01",
      "summary": "French diplomatic pressure increases",
      "description": "Following your refusal of the trade agreement, French diplomats adopt a firmer stance...",
      "chatInitiated": true,
      "chatContent": "Cher représentant, nous souhaitons discuter de votre refus de l'accord commercial...",
      "countryInvolved": ["France"],
      "chatId": "uuid-of-created-chat"
    }
  ],
  "updatedGauges": {
    "economy": 33,
    "power": 10,
    "popularity": 38
  },
  "borderChanges": [
    {
      "from": "CH",
      "to": "FR",
      "description": "Switzerland annexed by France"
    }
  ],
  "gameOver": false
}
```

**Note :** 
- `borderChanges` peut être `null` s'il n'y a pas de changement de frontières lors de ce tour.
- Chaque événement contient :
  - `chatInitiated` (boolean) : `true` si cet événement déclenche un chat diplomatique, `false` sinon
  - `chatContent` (string | null) : Le message initial du chat diplomatique si `chatInitiated` est `true`, `null` sinon
  - `countryInvolved` (array of strings | null) : Liste des noms des pays impliqués dans le chat si `chatInitiated` est `true`, `null` sinon
  - `chatId` (string | null) : UUID du chat diplomatique créé si `chatInitiated` est `true`, `null` sinon

**Codes d'erreur :**
- `400` : Jeu terminé
- `401` : Non autorisé (header x-user-id manquant)
- `403` : Non autorisé (pas le propriétaire du jeu)
- `404` : Jeu non trouvé ou preset manquant
- `500` : Erreur serveur ou échec de validation de la réponse IA

**Fonctionnement :**

1. **Collecte des données** :
   - État actuel du jeu (date, difficulté, indicateurs, trame, tour)
   - Données du preset (lore, eventPrompt)
   - Résumés des chats diplomatiques (country chats)
   - Résumé du chat advisor
   - Actions utilisateur du tour actuel (game_actions)
   - Prompt de difficulté depuis le système de fichiers

2. **Appel au World Engine AI** :
   - Construit un INPUT JSON strict avec toutes les données collectées
   - Appelle l'IA avec le system prompt (eventPrompt + difficultyPrompt + instructions)
   - Valide la réponse jusqu'à 3 tentatives en cas d'échec

3. **Persistence des résultats** :
   - **Events** : Création d'entrées dans `game_events` et mise à jour de `games.trame`
   - **Gauges** : Mise à jour de `games.money`, `power`, `popularity`
   - **Country chats** : Mise à jour de `country_chat_countries.country_trame`
   - **Advisor summary** : Mise à jour de `advisor_chats.advisor_trame` (+ mémoire si présente)
   - **Border changes** : Mise à jour de `game_countries.owned_by` si nécessaire
   - **Game over** : Mise à jour de `games.game_over` si la partie est terminée

4. **Avancement du tour** :
   - `games.current_turn` incrémenté de 1
   - `games.current_ingame_date` mis à jour avec la date du dernier événement
   - `games.last_play` mis à jour à maintenant

**Notes :**
- Toutes les opérations sont effectuées dans une transaction Prisma (rollback en cas d'erreur)
- La réponse IA est strictement validée selon le schéma attendu
- Les événements générés couvrent une période de 1 jour à 6 mois après la date actuelle
- Le nombre d'événements générés est entre 3 et 20
- Les indicateurs ne sont mis à jour que si l'IA fournit de nouvelles valeurs

### `GET /games/:id/indicators`

Récupère les indicateurs du jeu (ressources, popularité, pouvoir).

**Paramètres :**
- `id` (path) : UUID du jeu

**Réponse :**
```json
{
  "resources": 50,
  "popularity": 50,
  "power": 50,
  "lastUpdated": "2024-01-01T00:00:00.000Z"
}
```

**Codes d'erreur :**
- `404` : Jeu non trouvé

**Note :** Actuellement, cette route retourne des valeurs mockées. La logique de calcul des indicateurs sera implémentée plus tard.

---

## Codes d'erreur HTTP

- `200` : Succès
- `400` : Requête invalide
- `401` : Non autorisé
- `404` : Ressource non trouvée
- `500` : Erreur serveur

---

## Notes importantes

- Toutes les dates sont au format ISO 8601
- Tous les UUIDs sont des strings
- L'authentification est actuellement mockée via le header `x-user-id`
- Certaines routes retournent des données mockées (voir les notes dans la documentation)
- Les réponses sont toujours en JSON

