import { createServerFn } from "@tanstack/react-start"
import { queryOptions } from "@tanstack/react-query"
import { prisma } from "../lib/db"
import { z } from "zod"
import { auth } from "../lib/auth"
import { getRequest } from "@tanstack/start-server-core"

async function getSession() {
  const request = getRequest()
  if (!request) return null
  return auth.api.getSession({ headers: request.headers })
}

const DEFAULT_WORKFLOW_STATES = [
  { name: "Backlog", type: "backlog", color: "#94a3b8", position: 0 },
  { name: "À faire", type: "unstarted", color: "#6b7280", position: 1 },
  { name: "En cours", type: "started", color: "#3b82f6", position: 2 },
  { name: "Terminé", type: "completed", color: "#22c55e", position: 3 },
  { name: "Annulé", type: "canceled", color: "#ef4444", position: 4 },
]

export const getTeams = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession()
  if (!session) throw new Error("Unauthenticated")

  return prisma.team.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: {
      members: true,
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "asc" },
  })
})

export const getTeam = createServerFn({ method: "GET" })
  .inputValidator(z.object({ teamId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const team = await prisma.team.findUniqueOrThrow({
      where: { id: data.teamId },
      include: { members: true, projects: true, workflowStates: { where: { projectId: null }, orderBy: { position: "asc" } }, labels: true },
    })
    const users = await prisma.user.findMany({
      where: { id: { in: team.members.map((m) => m.userId) } },
      select: { id: true, image: true },
    })
    const imageMap = Object.fromEntries(users.map((u) => [u.id, u.image]))
    return {
      ...team,
      members: team.members.map((m) => ({ ...m, image: imageMap[m.userId] ?? null })),
    }
  })

export const ensureDefaultTeam = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getSession()
  if (!session) throw new Error("Unauthenticated")

  const existing = await prisma.team.findFirst({
    where: { members: { some: { userId: session.user.id } } },
    orderBy: { createdAt: "asc" },
  })
  if (existing) return existing

  const team = await prisma.team.create({
    data: {
      name: "Perso",
      key: "PER",
      isDefault: true,
      members: {
        create: {
          userId: session.user.id,
          role: "admin",
          userEmail: session.user.email,
          userName: session.user.name,
        },
      },
      workflowStates: {
        create: DEFAULT_WORKFLOW_STATES,
      },
    },
  })
  return team
})

export const createTeam = createServerFn({ method: "POST" })
  .inputValidator(z.object({ name: z.string().min(1), key: z.string().length(3) }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    return prisma.team.create({
      data: {
        name: data.name,
        key: data.key.toUpperCase(),
        members: {
          create: {
            userId: session.user.id,
            role: "admin",
            userEmail: session.user.email,
            userName: session.user.name,
          },
        },
        workflowStates: {
          create: DEFAULT_WORKFLOW_STATES,
        },
      },
    })
  })

export const updateTeam = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      teamId: z.string(),
      name: z.string().min(1).optional(),
      groqApiKey: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const { teamId, ...rest } = data
    return prisma.team.update({ where: { id: teamId }, data: rest })
  })

export const deleteTeam = createServerFn({ method: "POST" })
  .inputValidator(z.object({ teamId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const team = await prisma.team.findUniqueOrThrow({
      where: { id: data.teamId },
      include: { members: true },
    })

    if (team.isDefault) {
      throw new Error("Impossible de supprimer l'équipe par défaut")
    }

    const currentMember = team.members.find((m) => m.userId === session.user.id)
    if (!currentMember || currentMember.role !== "admin") {
      throw new Error("Seul un admin peut supprimer une équipe")
    }

    if (team.members.length > 1) {
      throw new Error("Tous les membres doivent quitter l'équipe avant de la supprimer")
    }

    await prisma.team.delete({ where: { id: data.teamId } })
  })

export const teamsQueryOptions = queryOptions({
  queryKey: ["teams"],
  queryFn: () => getTeams(),
})

export const teamQueryOptions = (teamId: string) =>
  queryOptions({
    queryKey: ["teams", teamId],
    queryFn: () => getTeam({ data: { teamId } }),
  })
