# Agent 1 — Server Functions (Complétion)

## Contexte
Les server functions de base existent (`src/server/teams.ts`, `issues.ts`, `projects.ts`, `labels.ts`, `workflow-states.ts`, `invitations.ts`, `daily-tasks.ts`). Il faut compléter ce qui manque pour supporter toutes les pages.

## Pattern à suivre
```ts
import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/start-server-core"
import { z } from "zod"
import { prisma } from "../lib/db"
import { auth } from "../lib/auth"

async function getSession() {
  const request = getRequest()
  if (!request) return null
  return auth.api.getSession({ headers: request.headers })
}

export const myFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ teamId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")
    // ...
  })
```

## Fichiers à créer / modifier

### `src/server/stats.ts` — NOUVEAU
```ts
// Fonctions:
export const getTeamStats = createServerFn({ method: "GET" })
  .inputValidator(z.object({ teamId: z.string() }))
  .handler(async ({ data }) => {
    // Retourner:
    // - stats: { membersCount, projectsCount, totalIssues, completedIssues, completionRate }
    // - priorityBreakdown: [{ priority, count }] (NO_PRIORITY, LOW, MEDIUM, HIGH, URGENT)
    // - statusBreakdown: [{ type, name, count, color }]
    // - recentIssues: 5 dernières issues avec workflowState et project
  })

export const teamStatsQueryOptions = (teamId: string) => queryOptions({
  queryKey: ["team-stats", teamId],
  queryFn: () => getTeamStats({ data: { teamId } }),
})
```

### `src/server/members.ts` — NOUVEAU
```ts
// Fonctions:
export const getTeamMembers    // GET { teamId } → TeamMember[] avec user
export const removeTeamMember  // POST { teamId, memberId } → void
export const teamMembersQueryOptions
```

### `src/server/invitations.ts` — COMPLÉTER
Le fichier existe. Vérifier/ajouter:
```ts
export const getInvitations       // GET { teamId } → Invitation[]
export const createInvitation     // POST { teamId, email, role }
export const resendInvitation     // POST { invitationId }
export const deleteInvitation     // POST { invitationId }
export const acceptInvitation     // POST { invitationId } → redirect
export const getInvitationById    // GET { invitationId } → Invitation (PUBLIC, no session required)
export const invitationsQueryOptions
```

### `src/server/issues.ts` — COMPLÉTER
Vérifier que ces champs sont inclus dans `getIssues`:
- `include: { workflowState: true, labels: { include: { label: true } }, assignee: true, project: true, _count: { select: { comments: true } } }`
- Supporter filtrage par: `workflowStateId?`, `assigneeId?`, `projectId?`, `priority?`, `labelId?`
- Supporter tri par: `sortField?` (title|priority|createdAt|number), `sortDirection?` (asc|desc)

### `src/server/projects.ts` — COMPLÉTER
- `deleteProject(projectId)` — MANQUANT
- `duplicateProject(projectId)` — MANQUANT
- S'assurer que `getProjects` inclut `_count: { select: { issues: true } }`

### `src/server/workflow-states.ts` — VÉRIFIER
- S'assurer que les états sont ordonnés par `position`
- Types: backlog, unstarted, started, completed, canceled

## Prisma models à connaître
```prisma
model Issue {
  id              String        @id @default(cuid())
  number          Int           // auto-increment per team
  title           String
  description     String?
  priority        Priority      // NO_PRIORITY, LOW, MEDIUM, HIGH, URGENT
  estimate        Int?
  teamId          String
  projectId       String?
  workflowStateId String
  assigneeId      String?
  createdById     String
  createdAt       DateTime
  updatedAt       DateTime
  workflowState   WorkflowState @relation(...)
  labels          IssueLabel[]
  assignee        TeamMember?   @relation(...)
  project         Project?
  comments        Comment[]
}

model TeamMember {
  id     String @id
  userId String
  teamId String
  role   Role   // MEMBER, ADMIN
  email  String
  name   String
  user   User   @relation(...)
}

model Invitation {
  id         String   @id @default(cuid())
  email      String
  role       Role
  status     String   // pending, accepted, rejected
  teamId     String
  invitedBy  String
  expiresAt  DateTime
  token      String   @unique
  createdAt  DateTime
}
```

## Résultat attendu
- `src/server/stats.ts` créé et fonctionnel
- `src/server/members.ts` créé et fonctionnel
- `src/server/invitations.ts` complet (tous les CRUD)
- `src/server/issues.ts` supporte filtres + tri + includes complets
- `src/server/projects.ts` a delete + duplicate
- Tous les `queryOptions` exportés correctement
