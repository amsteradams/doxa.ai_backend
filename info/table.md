# Documentation des Tables de la Base de Données

Ce document liste toutes les tables, leurs colonnes et les relations entre elles.

## Enums

### UserType
- `ADMIN`
- `USER`

### AdvisorSender
- `user`
- `advisor`

### Difficulty
- `easy`
- `medium`
- `hard`
- `simulation`

---

## Tables

### `users`

**Description :** Utilisateurs de l'application

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Identifiant unique |
| `username` | String | UNIQUE, NOT NULL | Nom d'utilisateur |
| `password` | String | NULLABLE | Mot de passe (nullable si OAuth) |
| `user_type` | UserType | DEFAULT USER | Type d'utilisateur (ADMIN/USER) |
| `balance` | Int | DEFAULT 0 | Solde de tokens |
| `created_at` | DateTime | DEFAULT now() | Date de création |

**Relations :**
- `orders` → `orders.user_id` (One-to-Many, CASCADE DELETE)
- `games` → `games.user_id` (One-to-Many, CASCADE DELETE)
- `actions` → `actions.user_id` (One-to-Many)
- `advisor_messages` → `advisor_messages.user_id` (One-to-Many)
- `country_messages` → `country_messages.user_id` (One-to-Many)
- `game_actions` → `game_actions.user_id` (One-to-Many, CASCADE DELETE)

---

### `orders`

**Description :** Commandes d'achat de tokens

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Identifiant unique |
| `user_id` | String (UUID) | FOREIGN KEY, NOT NULL | Référence à `users.id` |
| `amount` | Int | NOT NULL | Montant de la commande |
| `completed` | Boolean | DEFAULT false | Statut de la commande |
| `created_at` | DateTime | DEFAULT now() | Date de création |

**Relations :**
- `user` ← `users.id` (Many-to-One, CASCADE DELETE)

---

### `presets`

**Description :** Blueprints immuables de scénarios de jeu

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Identifiant unique |
| `has_provinces` | Boolean | DEFAULT false | Indique si le preset a des provinces |
| `advisor_prompt` | String | NOT NULL | Prompt pour le conseiller IA |
| `event_prompt` | String | NOT NULL | Prompt pour les événements |
| `chat_prompt` | String | NOT NULL | Prompt pour les chats de pays |
| `lore` | String | DEFAULT "" | Lore du monde |
| `starting_date` | String | NULLABLE | Date de départ du preset |
| `played_count` | Int | DEFAULT 0 | Nombre de parties jouées |
| `created_at` | DateTime | DEFAULT now() | Date de création |

**Relations :**
- `preset_countries` → `preset_countries.preset_id` (One-to-Many, CASCADE DELETE)
- `games` → `games.preset_id` (One-to-Many)

---

### `preset_countries`

**Description :** Pays template associés à un preset

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Identifiant unique |
| `preset_id` | String (UUID) | FOREIGN KEY, NOT NULL | Référence à `presets.id` |
| `name` | String | NOT NULL | Nom du pays |
| `color` | String | NOT NULL | Couleur du pays |
| `independant` | Boolean | NOT NULL | Indépendance du pays |
| `owned_by` | String | NULLABLE | Nom du pays propriétaire (null si indépendant) |
| `surname` | String | NULLABLE | Surnom du pays |
| `svg_id` | String | NOT NULL | Identifiant SVG du pays |
| `economy` | Int | DEFAULT 50, NULLABLE | Jauge économie (0-100) |
| `power` | Int | DEFAULT 50, NULLABLE | Jauge pouvoir (0-100) |
| `created_at` | DateTime | DEFAULT now() | Date de création |

**Contraintes :**
- UNIQUE(`preset_id`, `name`)

**Relations :**
- `preset` ← `presets.id` (Many-to-One, CASCADE DELETE)

---

### `games`

**Description :** Instances de jeu

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Identifiant unique |
| `user_id` | String (UUID) | FOREIGN KEY, NOT NULL | Référence à `users.id` |
| `preset_id` | String (UUID) | FOREIGN KEY, NULLABLE | Référence à `presets.id` |
| `trame` | String | DEFAULT "" | Résumé factuel cumulatif du monde |
| `selected_country_id` | String (UUID) | NULLABLE | UUID du preset_country sélectionné |
| `current_turn` | Int | DEFAULT 1 | Tour actuel |
| `current_ingame_date` | String | NULLABLE | Date in-game actuelle |
| `tokens_spent` | Int | DEFAULT 0 | Tokens dépensés |
| `game_over` | Boolean | DEFAULT false | Statut de fin de partie |
| `money` | Int | DEFAULT 50 | Indicateur Money (0-100) |
| `power` | Int | DEFAULT 50 | Indicateur Power (0-100) |
| `popularity` | Int | DEFAULT 50 | Indicateur Popularity (0-100) |
| `difficulty` | Difficulty | DEFAULT medium | Difficulté de la partie |
| `created_at` | DateTime | DEFAULT now() | Date de création |
| `last_play` | DateTime | NULLABLE | Dernière date de jeu |

**Relations :**
- `user` ← `users.id` (Many-to-One, CASCADE DELETE)
- `preset` ← `presets.id` (Many-to-One)
- `game_countries` → `game_countries.game_id` (One-to-Many, CASCADE DELETE)
- `actions` → `actions.game_id` (One-to-Many, CASCADE DELETE)
- `advisor_chats` → `advisor_chats.game_id` (One-to-Many, CASCADE DELETE)
- `country_chats` → `country_chats.game_id` (One-to-Many, CASCADE DELETE)
- `advisor_messages` → `advisor_messages.game_id` (One-to-Many, CASCADE DELETE)
- `country_messages` → `country_messages.game_id` (One-to-Many, CASCADE DELETE)
- `game_actions` → `game_actions.game_id` (One-to-Many, CASCADE DELETE)
- `game_events` → `game_events.game_id` (One-to-Many, CASCADE DELETE)

---

### `game_countries`

**Description :** États vivants des pays par partie

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Identifiant unique |
| `game_id` | String (UUID) | FOREIGN KEY, NOT NULL | Référence à `games.id` |
| `name` | String | NOT NULL | Nom du pays |
| `color` | String | NOT NULL | Couleur du pays |
| `independant` | Boolean | NOT NULL | Indépendance du pays |
| `owned_by` | String | NULLABLE | Nom du pays propriétaire |
| `surname` | String | NULLABLE | Surnom du pays |
| `svg_id` | String | NOT NULL | Identifiant SVG du pays |
| `economy` | Int | DEFAULT 50, NULLABLE | Jauge économie (0-100) |
| `power` | Int | DEFAULT 50, NULLABLE | Jauge pouvoir (0-100) |
| `created_at` | DateTime | DEFAULT now() | Date de création |

**Contraintes :**
- UNIQUE(`game_id`, `name`)

**Relations :**
- `game` ← `games.id` (Many-to-One, CASCADE DELETE)
- `country_chat_countries` → `country_chat_countries.country_id` (One-to-Many, CASCADE DELETE)

---

### `actions`

**Description :** Actions soumises par l'utilisateur (submitAction)

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Identifiant unique |
| `game_id` | String (UUID) | FOREIGN KEY, NOT NULL | Référence à `games.id` |
| `user_id` | String (UUID) | FOREIGN KEY, NULLABLE | Référence à `users.id` |
| `text` | String | NOT NULL | Description de l'action |
| `resume` | String | NOT NULL | Résumé de l'action |
| `ai_response` | String | NOT NULL | Réponse brute de l'IA |
| `token_cost` | Int | NOT NULL | Coût en tokens |
| `border_changed` | Boolean | NOT NULL | Indique si les frontières ont changé |
| `affected_countries` | String[] | NOT NULL | Liste des pays affectés |
| `created_at` | DateTime | DEFAULT now() | Date de création |

**Relations :**
- `user` ← `users.id` (Many-to-One)
- `game` ← `games.id` (Many-to-One, CASCADE DELETE)
- `border_changes` → `border_changes.action_id` (One-to-Many, CASCADE DELETE)

---

### `border_changes`

**Description :** Historique des changements de frontières

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Identifiant unique |
| `action_id` | String (UUID) | FOREIGN KEY, NOT NULL | Référence à `actions.id` |
| `country` | String | NOT NULL | Nom du pays (game_country.name) |
| `previous_owner` | String | NULLABLE | Propriétaire précédent |
| `new_owner` | String | NULLABLE | Nouveau propriétaire (null = indépendance) |
| `created_at` | DateTime | DEFAULT now() | Date de création |

**Relations :**
- `action` ← `actions.id` (Many-to-One, CASCADE DELETE)

---

### `game_actions`

**Description :** Actions utilisateur par tour (0-10 par tour)

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Identifiant unique |
| `game_id` | String (UUID) | FOREIGN KEY, NOT NULL | Référence à `games.id` |
| `user_id` | String (UUID) | FOREIGN KEY, NOT NULL | Référence à `users.id` |
| `turn` | Int | NOT NULL | Tour actuel |
| `ingame_date` | String | NOT NULL | Date in-game |
| `content` | String | NOT NULL | Contenu de l'action |
| `created_at` | DateTime | DEFAULT now() | Date de création |

**Relations :**
- `user` ← `users.id` (Many-to-One, CASCADE DELETE)
- `game` ← `games.id` (Many-to-One, CASCADE DELETE)

---

### `game_events`

**Description :** Événements générés par tour

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Identifiant unique |
| `game_id` | String (UUID) | FOREIGN KEY, NOT NULL | Référence à `games.id` |
| `turn` | Int | NOT NULL | Tour actuel |
| `date` | String | NOT NULL | Date in-game |
| `resume` | String | NOT NULL | Résumé de l'événement |
| `text` | String | NOT NULL | Texte complet de l'événement |
| `created_at` | DateTime | DEFAULT now() | Date de création |

**Relations :**
- `game` ← `games.id` (Many-to-One, CASCADE DELETE)

---

### `advisor_chats`

**Description :** Chats avec le conseiller IA

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Identifiant unique |
| `game_id` | String (UUID) | FOREIGN KEY, NOT NULL | Référence à `games.id` |
| `advisor_trame` | String | DEFAULT "" | Trame synthétique IA (mémoire longue, 2-5 phrases) |
| `current_turn_context` | String | DEFAULT "" | Mémoire chaude du tour en cours |
| `updated_at` | DateTime | DEFAULT now(), AUTO UPDATE | Date de mise à jour |

**Relations :**
- `game` ← `games.id` (Many-to-One, CASCADE DELETE)
- `messages` → `advisor_messages.chat_id` (One-to-Many, CASCADE DELETE)

---

### `advisor_messages`

**Description :** Messages du chat conseiller

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Identifiant unique |
| `chat_id` | String (UUID) | FOREIGN KEY, NOT NULL | Référence à `advisor_chats.id` |
| `game_id` | String (UUID) | FOREIGN KEY, NOT NULL | Référence à `games.id` |
| `user_id` | String (UUID) | FOREIGN KEY, NULLABLE | Référence à `users.id` |
| `sender` | AdvisorSender | NOT NULL | Expéditeur (user/advisor) |
| `content` | String | NOT NULL | Contenu du message |
| `token_cost` | Int | NOT NULL | Coût en tokens |
| `created_at` | DateTime | DEFAULT now() | Date de création |

**Relations :**
- `chat` ← `advisor_chats.id` (Many-to-One, CASCADE DELETE)
- `game` ← `games.id` (Many-to-One, CASCADE DELETE)
- `user` ← `users.id` (Many-to-One)

---

### `country_chats`

**Description :** Chats diplomatiques multi-pays

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Identifiant unique |
| `game_id` | String (UUID) | FOREIGN KEY, NOT NULL | Référence à `games.id` |
| `global_trame` | String | DEFAULT "" | Trame diplomatique globale |
| `current_turn_context` | String | DEFAULT "" | Synthèse courte des échanges du tour |
| `updated_at` | DateTime | DEFAULT now(), AUTO UPDATE | Date de mise à jour |

**Relations :**
- `game` ← `games.id` (Many-to-One, CASCADE DELETE)
- `countries` → `country_chat_countries.chat_id` (One-to-Many, CASCADE DELETE)
- `messages` → `country_messages.chat_id` (One-to-Many, CASCADE DELETE)

---

### `country_chat_countries`

**Description :** Table de liaison entre chats diplomatiques et pays

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `chat_id` | String (UUID) | FOREIGN KEY, PRIMARY KEY | Référence à `country_chats.id` |
| `country_id` | String (UUID) | FOREIGN KEY, PRIMARY KEY | Référence à `game_countries.id` |
| `country_trame` | String | DEFAULT "" | Trame diplomatique par pays (1-3 phrases) |

**Contraintes :**
- PRIMARY KEY(`chat_id`, `country_id`)

**Relations :**
- `chat` ← `country_chats.id` (Many-to-One, CASCADE DELETE)
- `country` ← `game_countries.id` (Many-to-One, CASCADE DELETE)

---

### `country_messages`

**Description :** Messages des chats diplomatiques

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | String (UUID) | PRIMARY KEY, DEFAULT uuid() | Identifiant unique |
| `chat_id` | String (UUID) | FOREIGN KEY, NOT NULL | Référence à `country_chats.id` |
| `game_id` | String (UUID) | FOREIGN KEY, NOT NULL | Référence à `games.id` |
| `user_id` | String (UUID) | FOREIGN KEY, NULLABLE | Référence à `users.id` |
| `country_name` | String | NOT NULL | Nom du pays parlant (game_country.name) |
| `content` | String | NOT NULL | Contenu du message |
| `react` | String | NULLABLE | Réaction éventuelle (emoji, ton) |
| `ingame_date` | String | NULLABLE | Date in-game |
| `token_cost` | Int | NOT NULL | Coût en tokens |
| `created_at` | DateTime | DEFAULT now() | Date de création |

**Relations :**
- `chat` ← `country_chats.id` (Many-to-One, CASCADE DELETE)
- `game` ← `games.id` (Many-to-One, CASCADE DELETE)
- `user` ← `users.id` (Many-to-One)

---

## Diagramme des Relations Principales

```
users
  ├── orders (1:N, CASCADE)
  ├── games (1:N, CASCADE)
  ├── actions (1:N)
  ├── advisor_messages (1:N)
  ├── country_messages (1:N)
  └── game_actions (1:N, CASCADE)

presets
  ├── preset_countries (1:N, CASCADE)
  └── games (1:N)

games
  ├── game_countries (1:N, CASCADE)
  ├── actions (1:N, CASCADE)
  ├── advisor_chats (1:N, CASCADE)
  ├── country_chats (1:N, CASCADE)
  ├── advisor_messages (1:N, CASCADE)
  ├── country_messages (1:N, CASCADE)
  ├── game_actions (1:N, CASCADE)
  └── game_events (1:N, CASCADE)

actions
  └── border_changes (1:N, CASCADE)

advisor_chats
  └── advisor_messages (1:N, CASCADE)

country_chats
  ├── country_chat_countries (1:N, CASCADE)
  └── country_messages (1:N, CASCADE)

game_countries
  └── country_chat_countries (1:N, CASCADE)
```

---

## Notes Importantes

1. **CASCADE DELETE** : Lorsqu'une entité parente est supprimée, toutes les entités enfants liées sont automatiquement supprimées.

2. **UUID** : Toutes les clés primaires utilisent le type UUID généré automatiquement.

3. **Contraintes CHECK** : Les indicateurs `money`, `power`, et `popularity` dans `games` sont contraints entre 0 et 100.

4. **Index** : Les contraintes UNIQUE créent automatiquement des index pour améliorer les performances de recherche.

5. **Relations optionnelles** : Certaines relations sont NULLABLE (ex: `games.preset_id`, `actions.user_id`) pour permettre des cas d'usage flexibles.

