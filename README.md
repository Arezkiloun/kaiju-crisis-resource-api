# KAIJU — API de gestion de ressources en situation de crise

API REST backend permettant de gérer les ressources (stocks, réservations, transferts) entre plusieurs districts d'une ville frappée par une catastrophe. Projet de groupe réalisé à **Epitech** (2026).

## Fonctionnalités

- **Districts** : liste, détail, adjacences entre districts, accès maritime, niveau de gravité.
- **Ressources** : stocks par district, disponibilités, réservations et retours.
- **Transferts** entre districts avec circuit d'approbation selon le type de route :
  direct, transit (via un district intermédiaire), maritime, réquisition.
- **Niveau de catastrophe** et règles de rétention des stocks.
- **Calendrier** d'événements par district.
- **Rôles** (QC, LC, CD) avec guards et décorateurs NestJS.
- **Temps réel** : notifications via WebSocket (gateway NestJS).
- **Tests** unitaires des règles métier et tests d'intégration de l'API.

## Stack technique

| Domaine | Technologies |
|---|---|
| Backend | Node.js, TypeScript, NestJS |
| Base de données | PostgreSQL 16, Prisma ORM (migrations + seed) |
| Validation | class-validator, class-transformer |
| Temps réel | WebSocket (NestJS Gateway) |
| Infra | Docker, Docker Compose |
| Tests | node:test + tsx |

## Architecture

```text
apps/backend/
├── prisma/            # schéma, migrations, seed
├── src/
│   ├── auth/          # authentification
│   ├── districts/     # districts et adjacences
│   ├── resources/     # stocks, réservations, transferts + règles métier
│   ├── disaster/      # niveau de catastrophe, rétention
│   ├── calendar/      # événements
│   ├── realtime/      # WebSocket gateway
│   └── common/        # guards, décorateurs, exceptions, filtres
└── test/              # tests unitaires et d'intégration
```

## Lancer le projet

```bash
cp apps/backend/.env.example apps/backend/.env
docker compose up -d            # PostgreSQL sur le port 55432

cd apps/backend
npm install
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
npm run start:dev               # API sur http://localhost:3000
npm test
```

## Exemples d'endpoints

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/districts` | Liste des districts |
| GET | `/districts/:code/neighbors` | Districts adjacents |
| GET | `/resources/district/:code/availability` | Disponibilité des ressources |
| POST | `/resources/reservations` | Réserver une ressource |
| POST | `/resources/transfers` | Demander un transfert direct |
| POST | `/resources/transfers/:id/approve` | Approuver un transfert |
| POST | `/resources/transfers/maritime` | Transfert maritime |
| PUT | `/disaster/level` | Modifier le niveau de catastrophe |

## Équipe

- **Lounis Arezki** — API des districts, ressources et disponibilités, service de réservation et règles métier, transferts, tests backend
- **Kevin Xu**

## Ce que j'ai appris

- Concevoir une API modulaire avec NestJS (modules, contrôleurs, services, DTO).
- Modéliser un domaine complexe avec Prisma et PostgreSQL.
- Traduire des règles métier (réservations, circuits d'approbation) en code testable.
- Travailler en équipe avec Git (branches, pull requests).
