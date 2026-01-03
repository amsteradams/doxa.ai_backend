# Documentation API - Doxa.ai Backend

## Base URL

```
http://ec2-51-21-130-249.eu-north-1.compute.amazonaws.com
```

## Authentification

Actuellement, l'authentification utilise un header mock :
- **Header:** `x-user-id` : UUID de l'utilisateur

> ⚠️ **Note:** L'authentification JWT sera implémentée prochainement.

## Headers communs

- `Content-Type: application/json`
- `x-user-id: <uuid>` (requis pour les routes protégées)
- `x-language: <en|fr|es|zh>` (optionnel, prioritaire sur la langue de l'utilisateur en BDD)

**Note sur la langue:** La langue est déterminée dans cet ordre de priorité :
1. Header `x-language` (si présent et valide)
2. Langue de l'utilisateur en base de données (si définie)
3. Français par défaut (si aucune langue n'est spécifiée)

Tous les prompts envoyés à l'IA incluent automatiquement une instruction pour répondre dans la langue déterminée.

---

## Routes Health

### `GET /health`

Vérifie que le serveur est opérationnel.

**Réponse 200:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### `GET /health/db`

Vérifie la connexion à la base de données.

**Réponse 200:**
```json
{
  "status": "ok",
  "message": "Database connection successful",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Réponse 500:**
```json
{
  "status": "error",
  "message": "Failed to connect to database",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### `GET /health/health-check-ia`

Vérifie la connexion à l'API DeepSeek.

**Réponse 200:**
```json
{
  "status": "ok",
  "message": "DeepSeek API is working",
  "response": "...",
  "usage": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### `GET /health/health-check-groq`

Vérifie la connexion à l'API Groq.

**Réponse 200:**
```json
{
  "status": "ok",
  "message": "Groq API is working",
  "response": "...",
  "usage": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Routes Presets

### `GET /presets`

Récupère la liste de tous les presets disponibles.

**Réponse 200:**
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

Récupère les détails d'un preset spécifique, incluant ses pays.

**Paramètres:**
- `id` (path) : UUID du preset

**Réponse 200:**
```json
{
  "id": "uuid",
  "hasProvinces": false,
  "advisorPrompt": "...",
  "eventPrompt": "...",
  "chatPrompt": "...",
  "lore": "...",
  "startingDate": "2020-01-01",
  "playedCount": 0,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "presetCountries": [
    {
      "id": "uuid",
      "name": "France",
      "color": "#FF0000",
      "independant": true,
      "ownedBy": null,
      "surname": "La République",
      "svgId": "france"
    }
  ]
}
```

**Réponse 404:**
```json
{
  "error": "Preset not found",
  "details": "No preset found with ID: ...",
  "id": "uuid"
}
```

---

## Routes Users

### `GET /users/me`

Récupère les informations de l'utilisateur actuel.

**Headers requis:**
- `x-user-id`

**Réponse 200:**
```json
{
  "id": "uuid",
  "username": "admin",
  "userType": "ADMIN",
  "balance": 0,
  "language": "fr",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Réponse 401:**
```json
{
  "error": "Unauthorized"
}
```

### `PATCH /users/me/language`

Met à jour la langue de l'utilisateur.

**Headers requis:**
- `x-user-id`

**Body:**
```json
{
  "language": "fr"
}
```

**Langues valides:** `en`, `fr`, `es`, `zh` (ou `null` pour réinitialiser)

**Réponse 200:**
```json
{
  "id": "uuid",
  "username": "admin",
  "userType": "ADMIN",
  "balance": 0,
  "language": "fr",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Erreurs:**
- `400`: `Invalid language` - La langue fournie n'est pas valide
- `401`: `Unauthorized`
- `404`: `User not found`

### `GET /users/:id`

Récupère les informations d'un utilisateur spécifique.

**Paramètres:**
- `id` (path) : UUID de l'utilisateur

**Réponse 200:**
```json
{
  "id": "uuid",
  "username": "admin",
  "userType": "ADMIN",
  "balance": 0,
  "language": "fr",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Réponse 404:**
```json
{
  "error": "User not found"
}
```

---

## Routes Games

### `POST /games`

Crée une nouvelle partie.

**Headers requis:**
- `x-user-id`

**Body:**
```json
{
  "presetId": "uuid",
  "selectedCountryId": "uuid", // Optionnel
  "difficulty": "easy" | "medium" | "hard" | "simulation" // Optionnel, défaut: "medium"
}
```

**Réponse 201:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "presetId": "uuid",
  "currentTurn": 0,
  "trame": "",
  "gameOver": false,
  "currentIngameDate": "2020-01-01",
  "money": 50,
  "power": 50,
  "popularity": 50,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Erreurs:**
- `400`: `presetId is required`
- `400`: `Selected country not found in preset`
- `400`: `Selected country must be a sovereign country (independant)`
- `401`: `Unauthorized`
- `404`: `Preset not found`

### `GET /games`

Récupère la liste des parties de l'utilisateur.

**Headers requis:**
- `x-user-id`

**Réponse 200:**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "presetId": "uuid",
    "trame": "...",
    "currentTurn": 5,
    "currentIngameDate": "2020-06-01",
    "tokensSpent": 100,
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

Récupère les détails d'une partie spécifique.

**Paramètres:**
- `id` (path) : UUID de la partie

**Réponse 200:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "presetId": "uuid",
  "trame": "...",
  "currentTurn": 5,
  "currentIngameDate": "2020-06-01",
  "tokensSpent": 100,
  "gameOver": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "lastPlay": "2024-01-01T00:00:00.000Z",
  "preset": {
    "id": "uuid",
    "hasProvinces": false
  },
  "user": {
    "id": "uuid",
    "username": "admin"
  }
}
```

**Réponse 404:**
```json
{
  "error": "Game not found"
}
```

### `GET /games/:id/countries`

Récupère la liste des pays d'une partie.

**Paramètres:**
- `id` (path) : UUID de la partie

**Réponse 200:**
```json
[
  {
    "id": "uuid",
    "name": "France",
    "color": "#FF0000",
    "independant": true,
    "ownedBy": null,
    "surname": "La République",
    "svgId": "france",
    "economy": 50,
    "power": 50
  }
]
```

### `GET /games/:id/events`

Récupère les événements d'une partie.

**Paramètres:**
- `id` (path) : UUID de la partie
- `turn` (query, optionnel) : Numéro du tour (défaut: tour actuel)

**Réponse 200:**
```json
[
  {
    "id": "uuid",
    "turn": 5,
    "date": "2020-06-01",
    "resume": "Résumé de l'événement",
    "text": "Texte complet de l'événement",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### `GET /games/:id/chat`

Récupère tous les chats (advisor et country) d'une partie.

**Paramètres:**
- `id` (path) : UUID de la partie

**Réponse 200:**
```json
{
  "advisorChat": {
    "id": "uuid",
    "advisorTrame": "...",
    "currentTurnContext": "...",
    "messages": [
      {
        "id": "uuid",
        "sender": "user" | "advisor",
        "content": "...",
        "tokenCost": 10,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  },
  "countryChats": [
    {
      "id": "uuid",
      "globalTrame": "...",
      "currentTurnContext": "...",
      "messages": [
        {
          "id": "uuid",
          "countryName": "France",
          "content": "...",
          "react": "😊",
          "ingameDate": "2020-06-01",
          "tokenCost": 10,
          "createdAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "countries": [
        {
          "country": {
            "id": "uuid",
            "name": "France",
            "svgId": "france"
          },
          "countryTrame": "..."
        }
      ]
    }
  ]
}
```

### `GET /games/:id/indicators`

Récupère les indicateurs (money, power, popularity) d'une partie.

**Paramètres:**
- `id` (path) : UUID de la partie

**Réponse 200:**
```json
{
  "money": 50,
  "power": 50,
  "popularity": 50
}
```

### `POST /games/:id/actions`

Soumet des actions pour le tour actuel.

**Headers requis:**
- `x-user-id`

**Paramètres:**
- `id` (path) : UUID de la partie

**Body:**
```json
{
  "actions": [
    {
      "content": "Description de l'action"
    }
  ]
}
```

**Contraintes:**
- `actions` doit être un tableau non vide
- Maximum 10 actions par tour
- Chaque action doit avoir un `content` non vide

**Réponse 201:**
```json
{
  "message": "Actions created successfully",
  "actions": [
    {
      "id": "uuid",
      "gameId": "uuid",
      "text": "...",
      "resume": "...",
      "tokenCost": 10,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Erreurs:**
- `400`: `actions must be an array`
- `400`: `actions array cannot be empty`
- `400`: `Maximum 10 actions per turn allowed`
- `400`: `Each action must have a non-empty content field`
- `400`: `Game is over`
- `401`: `Unauthorized`
- `403`: `Unauthorized: not the game owner`
- `404`: `Game not found`

### `DELETE /games/:id/actions/:actionId`

Supprime une action.

**Headers requis:**
- `x-user-id`

**Paramètres:**
- `id` (path) : UUID de la partie
- `actionId` (path) : UUID de l'action

**Réponse 200:**
```json
{
  "message": "Action deleted successfully"
}
```

**Erreurs:**
- `401`: `Unauthorized`
- `403`: `Unauthorized: not the game owner`
- `404`: `Action not found`

### `POST /games/:id/advisor/chat`

Envoie un message dans le chat advisor.

**Headers requis:**
- `x-user-id`
- `x-language` (optionnel) : `en`, `fr`, `es`, `zh`

**Paramètres:**
- `id` (path) : UUID de la partie

**Body:**
```json
{
  "message": "Question pour l'advisor"
}
```

**Réponse 200:**
```json
{
  "message": {
    "id": "uuid",
    "sender": "advisor",
    "content": "Réponse de l'advisor",
    "tokenCost": 10,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Erreurs:**
- `400`: `message is required`
- `401`: `Unauthorized`
- `403`: `Unauthorized: not the game owner`
- `404`: `Game not found`

### `POST /games/:id/move-forward`

Avance d'un tour dans la partie. Génère les événements, met à jour les indicateurs, et génère les réactions.

**Headers requis:**
- `x-user-id`
- `x-language` (optionnel) : `en`, `fr`, `es`, `zh`

**Paramètres:**
- `id` (path) : UUID de la partie

**Réponse 200:**
```json
{
  "message": "Turn advanced successfully",
  "game": {
    "id": "uuid",
    "currentTurn": 6,
    "currentIngameDate": "2020-07-01",
    "money": 55,
    "power": 52,
    "popularity": 48,
    "trame": "...",
    "gameOver": false
  },
  "events": [
    {
      "id": "uuid",
      "turn": 6,
      "date": "2020-07-01",
      "resume": "...",
      "text": "..."
    }
  ]
}
```

**Erreurs:**
- `400`: `Game is over`
- `400`: `No actions submitted for this turn`
- `401`: `Unauthorized`
- `403`: `Unauthorized: not the game owner`
- `404`: `Game not found`

**Notes:**
- Cette route génère automatiquement ~20 réactions (tweets ou messages de taverne) selon la date de départ du preset
- Les réactions sont générées après le tour et stockées dans la base de données
- 80% des réactions proviennent du pays sélectionné par l'utilisateur, 20% d'autres pays

### `POST /games/:id/country-chat`

Crée un nouveau chat diplomatique avec un ou plusieurs pays.

**Headers requis:**
- `x-user-id`
- `x-language` (optionnel) : `en`, `fr`, `es`, `zh`

**Paramètres:**
- `id` (path) : UUID de la partie

**Body:**
```json
{
  "countryIds": ["uuid1", "uuid2"]
}
```

**Réponse 201:**
```json
{
  "chat": {
    "id": "uuid",
    "gameId": "uuid",
    "globalTrame": "...",
    "countries": [
      {
        "country": {
          "id": "uuid",
          "name": "France",
          "svgId": "france"
        },
        "countryTrame": "..."
      }
    ]
  }
}
```

**Erreurs:**
- `400`: `countryIds must be an array with at least one country`
- `400`: `All countries must exist in the game`
- `401`: `Unauthorized`
- `403`: `Unauthorized: not the game owner`
- `404`: `Game not found`

### `POST /games/:id/country-chat/:chatId/send-message`

Envoie un message du joueur dans un chat diplomatique.

**Headers requis:**
- `x-user-id`
- `x-language` (optionnel) : `en`, `fr`, `es`, `zh`

**Paramètres:**
- `id` (path) : UUID de la partie
- `chatId` (path) : UUID du chat

**Body:**
```json
{
  "message": "Message diplomatique"
}
```

**Réponse 200:**
```json
{
  "userMessage": {
    "id": "uuid",
    "countryName": "Votre pays",
    "content": "Message diplomatique",
    "tokenCost": 0,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "countryMessages": [
    {
      "id": "uuid",
      "countryName": "France",
      "content": "Réponse du pays",
      "react": "😊",
      "tokenCost": 10,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Erreurs:**
- `400`: `message is required`
- `401`: `Unauthorized`
- `403`: `Unauthorized: not the game owner`
- `404`: `Game not found`
- `404`: `Chat not found`

### `POST /games/:id/country-chat/:chatId/request-message`

Demande une réponse d'un pays spécifique dans un chat diplomatique.

**Headers requis:**
- `x-user-id`
- `x-language` (optionnel) : `en`, `fr`, `es`, `zh`

**Paramètres:**
- `id` (path) : UUID de la partie
- `chatId` (path) : UUID du chat

**Body:**
```json
{
  "countryId": "uuid"
}
```

**Réponse 200:**
```json
{
  "message": {
    "id": "uuid",
    "countryName": "France",
    "content": "Réponse du pays",
    "react": "😊",
    "ingameDate": "2020-07-01",
    "tokenCost": 10,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
  }
}
```

**Erreurs:**
- `400`: `countryId is required`
- `400`: `Country is not part of this chat`
- `401`: `Unauthorized`
- `403`: `Unauthorized: not the game owner`
- `404`: `Game not found`
- `404`: `Chat not found`
- `404`: `Country not found`

### `GET /games/:id/reactions`

Récupère les réactions (tweets ou messages de taverne) pour un tour donné.

**Paramètres:**
- `id` (path) : UUID de la partie
- `turn` (query, optionnel) : Numéro du tour (défaut: tour actuel)

**Réponse 200:**
```json
[
  {
    "id": "uuid",
    "gameId": "uuid",
    "turn": 6,
    "type": "tweet" | "taverne",
    "username": "@JeanDupont" | "Un marchand français",
    "content": "Contenu de la réaction",
    "likes": 42,
    "retweets": 5,
    "quotes": 2,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Notes:**
- Si `preset.startingDate >= 2010`, les réactions sont des tweets avec `likes`, `retweets`, `quotes`
- Si `preset.startingDate < 2010`, les réactions sont des messages de taverne (sans métriques sociales)
- Les réactions sont générées automatiquement lors de `move-forward`

---

## Codes d'erreur HTTP

- `200` : Succès
- `201` : Créé avec succès
- `400` : Requête invalide
- `401` : Non autorisé (pas de header `x-user-id`)
- `403` : Interdit (pas le propriétaire de la ressource)
- `404` : Ressource non trouvée
- `500` : Erreur serveur

---

## Notes importantes

1. **Authentification:** Actuellement mockée via `x-user-id`. L'authentification JWT sera implémentée prochainement.

2. **Langue:** Le header `x-language` peut être utilisé pour spécifier la langue des réponses IA (`en`, `fr`, `es`, `zh`).

3. **Tokens:** Les actions et messages IA consomment des tokens. Le solde de l'utilisateur est débité automatiquement.

4. **Réactions:** Les réactions sont générées automatiquement lors de `move-forward` et stockées dans la base de données. Elles peuvent être récupérées via `GET /games/:id/reactions`.

5. **Trame:** La trame (`trame`) est une synthèse narrative de l'état du jeu, mise à jour à chaque tour.

6. **Indicateurs:** Les indicateurs (`money`, `power`, `popularity`) sont des valeurs entre 0 et 100.

7. **Tours:** Les tours commencent à 0. Le premier tour réel est le tour 1 après le premier `move-forward`.


