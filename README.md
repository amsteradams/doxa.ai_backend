# Doxa.ai - Backend Database Layer

Ce projet contient la couche base de données pour Doxa.ai, un jeu de simulation mobile alimenté par l'IA.

## 📋 Prérequis

- Node.js (version 18 ou supérieure)
- PostgreSQL (version 14 ou supérieure)
- npm ou yarn

## 🔧 Configuration

### 1. Variables d'environnement

Créez un fichier `.env` à la racine du dossier `backend` avec les variables suivantes :

```env
DATABASE_URL="postgresql://user:password@localhost:5432/doxa?schema=public"
NODE_ENV=development
APP_ENV=development
```

**Important :** Remplacez `user`, `password`, `localhost`, `5432` et `doxa` par vos propres valeurs de configuration PostgreSQL.

### 2. Installation des dépendances

```bash
npm install
```

## 🗄️ Base de données

### Génération du client Prisma

Avant de pouvoir utiliser Prisma, vous devez générer le client :

```bash
npm run prisma:generate
```

### Migrations

#### Créer une nouvelle migration (développement)

```bash
npm run prisma:migrate
```

Cette commande :
- Crée une nouvelle migration basée sur les changements dans `schema.prisma`
- Applique la migration à la base de données
- Régénère le client Prisma

#### Appliquer les migrations (production)

```bash
npm run prisma:migrate:deploy
```

Cette commande applique toutes les migrations en attente sans créer de nouvelles migrations.

### Seed (Données initiales)

Le script de seed crée un utilisateur administrateur par défaut :

- **Email/Username:** `admin@doxa.local`
- **Password:** `root`
- **Role:** `ADMIN`

**⚠️ Important :** Changez le mot de passe de l'admin en production !

Pour exécuter le seed :

```bash
npm run prisma:seed
```

### Prisma Studio (Interface graphique)

Pour visualiser et modifier les données de la base de données via une interface graphique :

```bash
npm run prisma:studio
```

Cela ouvre Prisma Studio dans votre navigateur (par défaut sur `http://localhost:5555`).

## 📊 Structure du schéma

Le schéma de base de données inclut les modèles suivants :

### Modèles principaux

- **User** : Utilisateurs (admin et utilisateurs normaux, incluant les invités)
- **Order** : Commandes d'achat de tokens
- **Preset** : Blueprints immuables de jeux
- **PresetCountry** : Templates de pays pour les presets
- **Game** : Instances de jeu
- **GameCountry** : États des pays par jeu
- **Action** : Actions soumises par les joueurs
- **BorderChange** : Historique des changements de frontières

### Chats

- **AdvisorChat** : Chat avec l'advisor
- **AdvisorMessage** : Messages de l'advisor
- **CountryChat** : Chat diplomatique multi-pays
- **CountryChatCountry** : Relation entre chats et pays
- **CountryMessage** : Messages des pays

### Enums

- **UserType** : `ADMIN`, `USER`
- **AdvisorSender** : `user`, `advisor`

## 🔄 Workflow de développement

1. Modifiez le schéma dans `prisma/schema.prisma`
2. Créez et appliquez une migration : `npm run prisma:migrate`
3. Le client Prisma est automatiquement régénéré
4. Utilisez `PrismaClient` dans votre code pour interagir avec la base de données

## 📝 Notes importantes

- Toutes les clés primaires utilisent des UUIDs
- Les relations utilisent des clés étrangères avec cascade sur suppression
- Les timestamps sont automatiquement gérés (`created_at`, `updated_at`)
- Les contraintes d'unicité sont définies où nécessaire
- Les index sont automatiquement créés sur les clés étrangères

## 🚀 Commandes disponibles

| Commande | Description |
|----------|-------------|
| `npm run prisma:generate` | Génère le client Prisma |
| `npm run prisma:migrate` | Crée et applique une nouvelle migration (dev) |
| `npm run prisma:migrate:deploy` | Applique les migrations (prod) |
| `npm run prisma:seed` | Exécute le script de seed |
| `npm run prisma:studio` | Ouvre Prisma Studio |
| `npm run build` | Compile TypeScript |
| `npm run dev` | Lance le serveur en mode développement |

## 🔒 Sécurité

- Les mots de passe sont hashés avec bcrypt (10 rounds)
- L'utilisateur admin par défaut doit avoir son mot de passe changé en production
- Les variables d'environnement sensibles ne doivent jamais être commitées

## 📚 Documentation Prisma

Pour plus d'informations sur Prisma, consultez la [documentation officielle](https://www.prisma.io/docs).



# doxa.ai_backend
