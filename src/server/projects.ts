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

export const getProjects = createServerFn({ method: "GET" })
  .inputValidator(z.object({ teamId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    return prisma.project.findMany({
      where: { teamId: data.teamId },
      include: { _count: { select: { issues: true } } },
      orderBy: { createdAt: "desc" },
    })
  })

export const createProject = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      teamId: z.string(),
      name: z.string().min(1),
      key: z.string().length(3),
      description: z.string().optional(),
      color: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const { teamId, ...rest } = data
    const project = await prisma.project.create({
      data: { ...rest, teamId },
      include: { _count: { select: { issues: true } } },
    })

    // Copy all current global states into this new project
    const globalStates = await prisma.workflowState.findMany({
      where: { teamId, projectId: null },
      orderBy: { position: "asc" },
    })
    if (globalStates.length > 0) {
      await prisma.$transaction(
        globalStates.map((s) =>
          prisma.workflowState.create({
            data: {
              name: s.name,
              type: s.type,
              color: s.color,
              position: s.position,
              teamId,
              projectId: project.id,
            },
          }),
        ),
      )
    }

    return project
  })

export const updateProject = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      projectId: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      color: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const { projectId, ...rest } = data
    return prisma.project.update({
      where: { id: projectId },
      data: rest,
      include: { _count: { select: { issues: true } } },
    })
  })

export const deleteProject = createServerFn({ method: "POST" })
  .inputValidator(z.object({ projectId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    await prisma.project.delete({ where: { id: data.projectId } })
  })

export const duplicateProject = createServerFn({ method: "POST" })
  .inputValidator(z.object({ projectId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const source = await prisma.project.findUniqueOrThrow({
      where: { id: data.projectId },
    })

    // Generate a unique key by appending a suffix
    const baseKey = source.key.slice(0, 2)
    const existingKeys = await prisma.project.findMany({
      where: { teamId: source.teamId, key: { startsWith: baseKey } },
      select: { key: true },
    })
    const usedKeys = new Set(existingKeys.map((p) => p.key))
    let newKey = baseKey + "2"
    let suffix = 2
    while (usedKeys.has(newKey)) {
      suffix++
      newKey = baseKey + suffix
    }

    return prisma.project.create({
      data: {
        teamId: source.teamId,
        name: `${source.name} (Copy)`,
        key: newKey.toUpperCase().slice(0, 3),
        description: source.description,
        color: source.color,
        icon: source.icon,
        status: "active",
      },
      include: { _count: { select: { issues: true } } },
    })
  })

export const projectsQueryOptions = (teamId: string) =>
  queryOptions({
    queryKey: ["projects", teamId],
    queryFn: () => getProjects({ data: { teamId } }),
  })
