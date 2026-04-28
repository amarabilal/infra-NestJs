# Tournament API

API REST NestJS de gestion de tournois de jeux vidéo.

## Stack technique

- **NestJS** — Framework Node.js
- **TypeScript strict** — Typage complet
- **PostgreSQL** — Base de données
- **TypeORM** — ORM
- **JWT + Passport** — Authentification
- **Docker** — Conteneurisation dev et prod
- **Swagger/OpenAPI** — Documentation interactive
- **class-validator** — Validation des DTOs

---

## Prérequis

- Docker Desktop installé et démarré
- Node.js 22+ (pour le mode local uniquement)
- npm 10+

---

## Installation et lancement

### 1. Cloner et configurer l'environnement

```bash
cp .env.example .env
```

Modifier `.env` si nécessaire (les valeurs par défaut fonctionnent avec Docker).

### 2. Mode développement (Docker)

```bash
docker-compose up --build
```

L'API est disponible sur `http://localhost:3000`.
La base PostgreSQL est automatiquement créée et synchronisée.

### 3. Mode production (Docker)

```bash
docker-compose -f docker-compose.prod.yml up --build
```

### 4. Mode local (sans Docker)

```bash
# Démarrer uniquement PostgreSQL
docker-compose up postgres -d

# Installer les dépendances
npm install

# Lancer en mode watch
npm run start:dev
```

---

## Documentation API

Swagger disponible à l'adresse :

```
http://localhost:3000/api
```

---

## Routes disponibles

### Authentification

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/auth/register` | Non | Inscription joueur |
| POST | `/auth/login` | Non | Connexion + JWT |

### Joueurs

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/players` | Non | Liste des joueurs |
| GET | `/players/:id` | Non | Profil d'un joueur |
| GET | `/players/:id/tournaments` | Non | Tournois d'un joueur |
| GET | `/players/:id/stats` | Non | Statistiques d'un joueur |
| PUT | `/players/:id` | JWT | Modifier son profil |

### Jeux

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/games` | Non | Liste des jeux |
| GET | `/games/:id` | Non | Détail d'un jeu |
| POST | `/games` | JWT + Admin | Ajouter un jeu |
| PUT | `/games/:id` | JWT + Admin | Modifier un jeu |
| DELETE | `/games/:id` | JWT + Admin | Supprimer un jeu |

### Tournois

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/tournaments` | Non | Liste (filtrable par `?status=pending`) |
| POST | `/tournaments` | JWT | Créer un tournoi |
| GET | `/tournaments/:id` | Non | Détail d'un tournoi |
| PUT | `/tournaments/:id` | JWT + Propriétaire/Admin | Modifier un tournoi |
| DELETE | `/tournaments/:id` | JWT + Propriétaire/Admin | Supprimer (pending uniquement) |
| POST | `/tournaments/:id/join` | JWT | S'inscrire à un tournoi |
| GET | `/tournaments/:id/matches` | Non | Matchs d'un tournoi |

> Pour démarrer un tournoi, envoyer `PUT /tournaments/:id` avec `{ "status": "in_progress" }`.

### Matchs

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/matches/:id/result` | JWT | Soumettre un résultat |

---

## Règles métier

### Règles sur les tournois

- Créé automatiquement en statut `pending`
- Un tournoi démarre avec au moins **2 joueurs inscrits** en envoyant `PUT /tournaments/:id { "status": "in_progress" }`
- Au démarrage, les matchs sont générés automatiquement (bracket)
- Les nombres impairs de joueurs sont gérés par un système **BYE** (le joueur seul avance automatiquement)
- Le bracket progresse automatiquement à chaque round complet
- Seul le **créateur** ou un **admin** peut modifier/supprimer/démarrer un tournoi
- **Champs modifiables uniquement en statut `pending`** : `maxPlayers`, `startDate`, `gameId`
- **Suppression interdite** si le tournoi a déjà commencé ou est terminé
- Le statut `completed` est **définitif** — impossible de le modifier ou de revenir en arrière

### Règles sur les matchs

- Un match BYE ne peut pas recevoir de résultat
- Seuls le créateur du tournoi, un admin ou l'un des deux joueurs du match peuvent soumettre un résultat
- Le `winnerId` doit obligatoirement être l'un des deux joueurs du match
- Impossible de soumettre un résultat sur un match déjà terminé (409)
- Impossible de soumettre un résultat si le tournoi n'est pas en cours (400)

### Sécurité des données

- Le `password` n'est jamais retourné par l'API (ni dans les réponses, ni dans Swagger)

---

## Tests d'intégration

Les tests nécessitent une base PostgreSQL accessible.

```bash
# Créer la base de test (si elle n'existe pas)
docker exec -it tournament_postgres createdb -U postgres tournament_test_db

# Lancer les tests e2e
npm run test:e2e
```

Avec Docker (base déjà démarrée via `docker-compose up postgres -d`) :

```bash
DB_NAME=tournament_test_db npm run test:e2e
```

---

## Créer un compte admin

Par défaut, tous les joueurs ont le rôle `player`. Pour créer un admin, modifier directement en base :

```sql
UPDATE players SET role = 'admin' WHERE email = 'your@email.com';
```

Ou via psql dans Docker :

```bash
docker exec -it tournament_postgres psql -U postgres -d tournament_db -c "UPDATE players SET role = 'admin' WHERE email = 'your@email.com';"
```

---

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `NODE_ENV` | Environnement | `development` |
| `PORT` | Port de l'API | `3000` |
| `DB_HOST` | Hôte PostgreSQL | `localhost` |
| `DB_PORT` | Port PostgreSQL | `5432` |
| `DB_USERNAME` | Utilisateur | `postgres` |
| `DB_PASSWORD` | Mot de passe | `postgres` |
| `DB_NAME` | Nom de la base | `tournament_db` |
| `JWT_SECRET` | Clé secrète JWT | — |
| `JWT_EXPIRES_IN` | Durée du token | `7d` |

---

## Structure du projet

```
src/
├── config/           # Configuration TypeORM et JWT
├── common/           # Guards, Interceptors, Pipes, Filters, Decorators
├── auth/             # Register, Login, JWT Strategy
├── players/          # CRUD joueurs + stats
├── games/            # CRUD jeux (admin pour POST)
├── tournaments/      # CRUD tournois + inscriptions
├── matches/          # Soumission de résultats
└── brackets/         # Génération automatique du bracket + BYE
```

---

## Déploiement production

```bash
# Build de l'image
docker build --target production -t tournament-api:prod .

# Ou via docker-compose
docker-compose -f docker-compose.prod.yml up --build -d
```

L'image de production utilise un build multi-stage :
1. `base` — installation des dépendances
2. `builder` — compilation TypeScript
3. `production` — image minimale avec uniquement les dépendances de production

---

## Bonus implémentés

| Bonus | Points | Statut |
|-------|--------|--------|
| Swagger/OpenAPI | +1 pt | Disponible sur `/api` |
| Brackets automatiques + BYE | +1.5 pts | Intégré dans `BracketsService` |
| Statistiques joueurs | +1 pt | Route `GET /players/:id/stats` |
