# Taskly — Plan de migration TanStack Start

## Objectif
Reconstruire toutes les pages/logiques de l'ancienne app Next.js dans la nouvelle architecture TanStack Start + Tauri v2, de manière fonctionnelle et cohérente.

## Ordre d'exécution (dépendances)

```
Agent 1 → Agent 2 → Agent 4
                 ↘ Agent 5
Agent 3 → Agent 4 ↗
Agent 6 (parallèle avec 4 et 5)
Agent 7 (après 4 et 5)
```

| # | Agent | Fichier | Dépend de | Durée estimée |
|---|-------|---------|-----------|---------------|
| 1 | Server Functions | `01-server-functions.md` | — | Long |
| 2 | Shared UI Components | `02-shared-components.md` | — | Long |
| 3 | Team Layout & Nav | `03-team-layout.md` | Agent 1, 2 | Moyen |
| 4 | Issues Feature | `04-issues-feature.md` | Agent 1, 2, 3 | Très long |
| 5 | Projects Feature | `05-projects-feature.md` | Agent 1, 2, 3 | Long |
| 6 | Management Page | `06-management-page.md` | Agent 1, 2, 3 | Moyen |
| 7 | People & Invitations | `07-people-invitations.md` | Agent 1, 2, 3 | Long |

## Stack technique
- **Framework**: TanStack Start v1.167.x (Vite + React 19)
- **Routing**: TanStack Router (file-based, `src/routes/`)
- **State**: TanStack Query v5 (server functions comme queryFn)
- **Auth**: Better Auth v1.5 (Google OAuth, session via `getRequest()`)
- **DB**: Prisma 6 + PostgreSQL (Supabase)
- **UI**: Tailwind CSS v4 + shadcn/ui (New York style)
- **Desktop**: Tauri v2.10

## Conventions à respecter
- Server functions dans `src/server/*.ts` avec `createServerFn`
- Validation avec `.inputValidator(zod)` (PAS `.validator()`)
- Handler reçoit `{ data }` quand il y a un validator
- Session via `getRequest()` de `@tanstack/start-server-core`
- Routes dans `src/routes/` en file-based routing
- Loaders dans `Route.loader` avec `ensureQueryData` ou `prefetchQuery`
- Mutations via `useMutation` + `queryClient.invalidateQueries`
- Optimistic updates avec `queryClient.setQueryData`
- Import path alias: `#/*` = `src/*`

## URLs cibles
```
/                           → Landing page (index.tsx)
/login                      → Google OAuth
/teams                      → Liste des équipes
/teams/$teamId/issues       → Issues (list/board/table)
/teams/$teamId/projects     → Projects (list/table)
/teams/$teamId/management   → Stats & analytics
/teams/$teamId/people       → Members & invitations
/invite/$invitationId       → Accept invitation (public)
```
