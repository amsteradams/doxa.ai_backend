# Documentation du Schéma de Base de Données - Doxa.ai

## Vue d'ensemble

Le schéma Prisma définit la structure de la base de données PostgreSQL pour Doxa.ai. Tous les modèles utilisent des UUIDs comme clés primaires et incluent des timestamps automatiques.

---

## Enums

### `UserType`
- `ADMIN` : Administrateur
- `USER` : Utilisateur standard

### `AdvisorSender`
- `user` : Message de l'utilisateur
- `advisor` : Message de l'advisor IA

### `Difficulty`
- `easy` : Facile
- `medium` : Moyen (défaut)
- `hard` : Difficile
- `simulation` : Mode simulation

---

## Modèles

### `User`

Représente un utilisateur de l'application.

**Champs:**
- `id` (String, UUID, PK) : Identifiant unique
- `username` (String, unique) : Nom d'utilisateur
- `password` (String?, nullable) : Mot de passe hashé (nullable si OAuth)
- `userType` (UserType, défaut: USER) : Type d'utilisateur
- `balance` (Int, défaut: 0) : Solde de tokens
- `language` (String?, nullable) : Langue de l'utilisateur (`en`, `fr`, `es`, `zh` ou `null`)
- `createdAt` (DateTime) : Date de création

**Relations:**
- `orders` : Commandes de l'utilisateur
- `games` : Parties de l'utilisateur
- `actions` : Actions soumises par l'utilisateur
- `advisorMessages` : Messages envoyés dans les chats advisor
- `countryMessages` : Messages envoyés dans les chats diplomatiques
- `gameActions` : Actions par tour

**Table:** `users`

---

### `Order`

Représente une commande d'achat de tokens.

**Champs:**
- `id` (String, UUID, PK) : Identifiant unique
- `userId` (String, FK → User) : Utilisateur propriétaire
- `amount` (Int) : Montant de la commande
- `completed` (Boolean, défaut: false) : Statut de la commande
- `createdAt` (DateTime) : Date de création

**Relations:**
- `user` : Utilisateur propriétaire (CASCADE on delete)

**Table:** `orders`

---

### `Preset`

Blueprint immuable d'un scénario de jeu.

**Champs:**
- `id` (String, UUID, PK) : Identifiant unique
- `hasProvinces` (Boolean, défaut: false) : Indique si le preset utilise des provinces
- `advisorPrompt` (String) : Prompt pour l'advisor IA
- `eventPrompt` (String) : Prompt pour la génération d'événements
- `chatPrompt` (String) : Prompt pour les chats diplomatiques
- `lore` (String, défaut: "") : Lore du preset
- `startingDate` (String?, nullable) : Date de départ in-game (ex: "2020-01-01")
- `playedCount` (Int, défaut: 0) : Nombre de fois joué
- `createdAt` (DateTime) : Date de création

**Relations:**
- `presetCountries` : Pays du preset
- `games` : Parties utilisant ce preset

**Table:** `presets`

---

### `PresetCountry`

Template de pays pour un preset.

**Champs:**
- `id` (String, UUID, PK) : Identifiant unique
- `presetId` (String, FK → Preset) : Preset parent
- `name` (String) : Nom du pays
- `color` (String) : Couleur hexadécimale
- `independant` (Boolean) : Indique si le pays est souverain
- `ownedBy` (String?, nullable) : Nom du pays propriétaire (null si indépendant)
- `surname` (String?, nullable) : Surnom/titre du pays
- `svgId` (String) : Identifiant SVG pour l'affichage
- `economy` (Int?, défaut: 50) : Jauge économie (0-100)
- `power` (Int?, défaut: 50) : Jauge pouvoir (0-100)
- `createdAt` (DateTime) : Date de création

**Relations:**
- `preset` : Preset parent (CASCADE on delete)

**Contraintes:**
- Unique sur `[presetId, name]`

**Table:** `preset_countries`

---

### `Game`

Instance de jeu (partie).

**Champs:**
- `id` (String, UUID, PK) : Identifiant unique
- `userId` (String, FK → User) : Utilisateur propriétaire
- `presetId` (String?, nullable, FK → Preset) : Preset utilisé
- `trame` (String, défaut: "") : Trame narrative du jeu
- `selectedCountryId` (String?, nullable) : UUID du preset_country sélectionné par le joueur
- `currentTurn` (Int, défaut: 1) : Tour actuel
- `currentIngameDate` (String?, nullable) : Date in-game actuelle
- `tokensSpent` (Int, défaut: 0) : Tokens dépensés
- `gameOver` (Boolean, défaut: false) : Indique si la partie est terminée
- `money` (Int, défaut: 50) : Jauge ressources (0-100)
- `power` (Int, défaut: 50) : Jauge pouvoir (0-100)
- `popularity` (Int, défaut: 50) : Jauge popularité (0-100)
- `difficulty` (Difficulty, défaut: medium) : Difficulté
- `createdAt` (DateTime) : Date de création
- `lastPlay` (DateTime?, nullable) : Dernière date de jeu

**Relations:**
- `user` : Utilisateur propriétaire (CASCADE on delete)
- `preset` : Preset utilisé
- `gameCountries` : Pays de la partie
- `actions` : Actions soumises
- `advisorChats` : Chats avec l'advisor
- `countryChats` : Chats diplomatiques
- `advisorMessages` : Messages advisor
- `countryMessages` : Messages diplomatiques
- `gameActions` : Actions par tour
- `gameEvents` : Événements par tour
- `reactions` : Réactions sociales (tweets/taverne)

**Table:** `games`

---

### `GameCountry`

État vivant d'un pays dans une partie.

**Champs:**
- `id` (String, UUID, PK) : Identifiant unique
- `gameId` (String, FK → Game) : Partie parente
- `name` (String) : Nom du pays
- `color` (String) : Couleur hexadécimale
- `independant` (Boolean) : Indique si le pays est souverain
- `ownedBy` (String?, nullable) : Nom du pays propriétaire (null si indépendant)
- `surname` (String?, nullable) : Surnom/titre du pays
- `svgId` (String) : Identifiant SVG pour l'affichage
- `economy` (Int?, défaut: 50) : Jauge économie (0-100)
- `power` (Int?, défaut: 50) : Jauge pouvoir (0-100)
- `createdAt` (DateTime) : Date de création

**Relations:**
- `game` : Partie parente (CASCADE on delete)
- `countryChatCountries` : Relations avec les chats diplomatiques

**Contraintes:**
- Unique sur `[gameId, name]`

**Table:** `game_countries`

---

### `Action`

Action soumise par un joueur.

**Champs:**
- `id` (String, UUID, PK) : Identifiant unique
- `gameId` (String, FK → Game) : Partie
- `userId` (String?, nullable, FK → User) : Utilisateur (nullable pour actions système)
- `text` (String) : Texte de l'action
- `resume` (String) : Résumé de l'action
- `aiResponse` (String) : Réponse brute de l'IA
- `tokenCost` (Int) : Coût en tokens
- `borderChanged` (Boolean) : Indique si les frontières ont changé
- `affectedCountries` (String[]) : Liste des pays affectés
- `createdAt` (DateTime) : Date de création

**Relations:**
- `user` : Utilisateur (nullable)
- `game` : Partie (CASCADE on delete)
- `borderChanges` : Changements de frontières

**Table:** `actions`

---

### `BorderChange`

Historique des changements de frontières.

**Champs:**
- `id` (String, UUID, PK) : Identifiant unique
- `actionId` (String, FK → Action) : Action ayant causé le changement
- `country` (String) : Nom du pays (game_country.name)
- `previousOwner` (String?, nullable) : Propriétaire précédent
- `newOwner` (String?, nullable) : Nouveau propriétaire (null = indépendance)
- `createdAt` (DateTime) : Date de création

**Relations:**
- `action` : Action parente (CASCADE on delete)

**Table:** `border_changes`

---

### `GameAction`

Actions utilisateur par tour.

**Champs:**
- `id` (String, UUID, PK) : Identifiant unique
- `gameId` (String, FK → Game) : Partie
- `userId` (String, FK → User) : Utilisateur
- `turn` (Int) : Tour actuel
- `ingameDate` (String) : Date in-game
- `content` (String) : Contenu de l'action
- `createdAt` (DateTime) : Date de création

**Relations:**
- `user` : Utilisateur (CASCADE on delete)
- `game` : Partie (CASCADE on delete)

**Table:** `game_actions`

---

### `GameEvent`

Événements générés par tour.

**Champs:**
- `id` (String, UUID, PK) : Identifiant unique
- `gameId` (String, FK → Game) : Partie
- `turn` (Int) : Tour actuel
- `date` (String) : Date in-game
- `resume` (String) : Résumé de l'événement
- `text` (String) : Texte complet de l'événement
- `createdAt` (DateTime) : Date de création

**Relations:**
- `game` : Partie (CASCADE on delete)

**Table:** `game_events`

---

### `AdvisorChat`

Chat avec l'advisor IA.

**Champs:**
- `id` (String, UUID, PK) : Identifiant unique
- `gameId` (String, FK → Game) : Partie
- `advisorTrame` (String, défaut: "") : Trame synthétique IA (mémoire longue, 2-5 phrases)
- `currentTurnContext` (String, défaut: "") : Mémoire chaude du tour en cours
- `updatedAt` (DateTime) : Date de mise à jour (auto)

**Relations:**
- `game` : Partie (CASCADE on delete)
- `messages` : Messages du chat

**Table:** `advisor_chats`

---

### `AdvisorMessage`

Message dans un chat advisor.

**Champs:**
- `id` (String, UUID, PK) : Identifiant unique
- `chatId` (String, FK → AdvisorChat) : Chat parent
- `gameId` (String, FK → Game) : Partie
- `userId` (String?, nullable, FK → User) : Utilisateur (nullable pour messages système)
- `sender` (AdvisorSender) : Expéditeur (user ou advisor)
- `content` (String) : Contenu brut du message
- `tokenCost` (Int) : Coût en tokens
- `createdAt` (DateTime) : Date de création

**Relations:**
- `chat` : Chat parent (CASCADE on delete)
- `game` : Partie (CASCADE on delete)
- `user` : Utilisateur (nullable)

**Table:** `advisor_messages`

---

### `CountryChat`

Chat diplomatique multi-pays.

**Champs:**
- `id` (String, UUID, PK) : Identifiant unique
- `gameId` (String, FK → Game) : Partie
- `globalTrame` (String, défaut: "") : Trame diplomatique globale
- `currentTurnContext` (String, défaut: "") : Mémoire chaude du tour en cours
- `updatedAt` (DateTime) : Date de mise à jour (auto)

**Relations:**
- `game` : Partie (CASCADE on delete)
- `countries` : Pays participants (via CountryChatCountry)
- `messages` : Messages du chat

**Table:** `country_chats`

---

### `CountryChatCountry`

Relation entre un chat diplomatique et un pays.

**Champs:**
- `chatId` (String, FK → CountryChat) : Chat
- `countryId` (String, FK → GameCountry) : Pays
- `countryTrame` (String, défaut: "") : Trame diplomatique par pays (1-3 phrases)

**Relations:**
- `chat` : Chat (CASCADE on delete)
- `country` : Pays (CASCADE on delete)

**Contraintes:**
- Clé primaire composite sur `[chatId, countryId]`

**Table:** `country_chat_countries`

---

### `CountryMessage`

Message dans un chat diplomatique.

**Champs:**
- `id` (String, UUID, PK) : Identifiant unique
- `chatId` (String, FK → CountryChat) : Chat parent
- `gameId` (String, FK → Game) : Partie
- `userId` (String?, nullable, FK → User) : Utilisateur (nullable pour messages système)
- `countryName` (String) : Nom du pays parlant (game_country.name)
- `content` (String) : Contenu brut du message
- `react` (String?, nullable) : Réaction éventuelle (emoji, ton, etc.)
- `ingameDate` (String?, nullable) : Date in-game
- `tokenCost` (Int) : Coût en tokens
- `createdAt` (DateTime) : Date de création

**Relations:**
- `chat` : Chat parent (CASCADE on delete)
- `game` : Partie (CASCADE on delete)
- `user` : Utilisateur (nullable)

**Table:** `country_messages`

---

### `Reaction`

Réactions sociales (tweets ou messages de taverne).

**Champs:**
- `id` (String, UUID, PK) : Identifiant unique
- `gameId` (String, FK → Game) : Partie
- `turn` (Int) : Tour actuel
- `type` (String) : Type de réaction ("tweet" ou "taverne")
- `username` (String) : Nom d'utilisateur (tweet) ou nom contextuel (taverne)
- `content` (String) : Message de la réaction
- `likes` (Int?, défaut: 0) : Nombre de likes (tweets uniquement)
- `retweets` (Int?, défaut: 0) : Nombre de retweets (tweets uniquement)
- `quotes` (Int?, défaut: 0) : Nombre de citations (tweets uniquement)
- `createdAt` (DateTime) : Date de création

**Relations:**
- `game` : Partie (CASCADE on delete)

**Notes:**
- Si `preset.startingDate >= 2010`, les réactions sont des tweets avec métriques sociales
- Si `preset.startingDate < 2010`, les réactions sont des messages de taverne (sans métriques)
- Générées automatiquement lors de `move-forward`
- 80% des réactions proviennent du pays sélectionné, 20% d'autres pays

**Table:** `reactions`

---

## Relations principales

```
User
├── orders (Order[])
├── games (Game[])
├── actions (Action[])
├── advisorMessages (AdvisorMessage[])
├── countryMessages (CountryMessage[])
└── gameActions (GameAction[])

Preset
├── presetCountries (PresetCountry[])
└── games (Game[])

Game
├── gameCountries (GameCountry[])
├── actions (Action[])
├── advisorChats (AdvisorChat[])
├── countryChats (CountryChat[])
├── advisorMessages (AdvisorMessage[])
├── countryMessages (CountryMessage[])
├── gameActions (GameAction[])
├── gameEvents (GameEvent[])
└── reactions (Reaction[])

AdvisorChat
└── messages (AdvisorMessage[])

CountryChat
├── countries (CountryChatCountry[])
└── messages (CountryMessage[])
```

---

## Notes importantes

1. **UUIDs:** Toutes les clés primaires utilisent des UUIDs générés automatiquement.

2. **CASCADE:** La plupart des relations utilisent `onDelete: Cascade` pour maintenir l'intégrité référentielle.

3. **Timestamps:** `createdAt` est automatiquement défini à la création. `updatedAt` est automatiquement mis à jour pour les modèles qui l'utilisent.

4. **Jauges:** Les jauges (`economy`, `power`, `popularity`, `money`) sont des valeurs entre 0 et 100.

5. **Trames:** Les trames (`trame`, `advisorTrame`, `countryTrame`, `globalTrame`) sont des synthèses narratives compressées utilisées par l'IA pour maintenir le contexte.

6. **Réactions:** Les réactions sont générées automatiquement et stockées par tour. Le format (tweet vs taverne) dépend de la date de départ du preset.

7. **Actions:** Les actions peuvent être soumises par l'utilisateur ou générées par le système. Elles consomment des tokens.

8. **Chats:** Les chats (advisor et country) maintiennent une mémoire longue (`trame`) et une mémoire chaude (`currentTurnContext`) pour optimiser les appels IA.

---

## Commandes Prisma utiles

```bash
# Générer le client Prisma
npm run prisma:generate

# Créer et appliquer une migration
npm run prisma:migrate

# Appliquer les migrations (production)
npm run prisma:migrate:deploy

# Seed la base de données
npm run prisma:seed

# Ouvrir Prisma Studio
npm run prisma:studio
```


