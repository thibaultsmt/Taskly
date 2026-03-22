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

export const getWorkflowStates = createServerFn({ method: "GET" })
  .inputValidator(z.object({ teamId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")
    return prisma.workflowState.findMany({
      where: { teamId: data.teamId, projectId: null },
      orderBy: { position: "asc" },
    })
  })

export const getProjectWorkflowStates = createServerFn({ method: "GET" })
  .inputValidator(z.object({ teamId: z.string(), projectId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const project = await prisma.project.findUniqueOrThrow({
      where: { id: data.projectId },
      select: { createdAt: true },
    })

    // Project-specific states already saved
    const projectStates = await prisma.workflowState.findMany({
      where: { teamId: data.teamId, projectId: data.projectId },
      orderBy: { position: "asc" },
    })

    // Global states that existed strictly before this project was created
    const globalBeforeProject = await prisma.workflowState.findMany({
      where: {
        teamId: data.teamId,
        projectId: null,
        createdAt: { lt: project.createdAt },
      },
      orderBy: { position: "asc" },
    })

    // Copy any global state not yet present in this project (on-the-fly migration)
    const projectNames = new Set(projectStates.map((s) => s.name))
    const missing = globalBeforeProject.filter((s) => !projectNames.has(s.name))

    if (missing.length > 0) {
      await prisma.$transaction([
        // Shift existing project-specific states after the incoming ones
        ...projectStates.map((s, i) =>
          prisma.workflowState.update({
            where: { id: s.id },
            data: { position: missing.length + i },
          }),
        ),
        // Insert the missing global states at the front
        ...missing.map((s, i) =>
          prisma.workflowState.create({
            data: {
              name: s.name,
              type: s.type,
              color: s.color,
              position: i,
              teamId: data.teamId,
              projectId: data.projectId,
            },
          }),
        ),
      ])

      return prisma.workflowState.findMany({
        where: { teamId: data.teamId, projectId: data.projectId },
        orderBy: { position: "asc" },
      })
    }

    return projectStates
  })

export const createWorkflowState = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      teamId: z.string(),
      name: z.string().min(1),
      color: z.string(),
      projectId: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const last = await prisma.workflowState.findFirst({
      where: { teamId: data.teamId, projectId: data.projectId ?? null },
      orderBy: { position: "desc" },
    })
    return prisma.workflowState.create({
      data: {
        name: data.name,
        type: data.name,
        color: data.color,
        position: (last?.position ?? -1) + 1,
        teamId: data.teamId,
        projectId: data.projectId ?? null,
      },
    })
  })

export const updateWorkflowState = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      color: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const { id, name, color } = data
    return prisma.workflowState.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name, type: name } : {}),
        ...(color !== undefined ? { color } : {}),
      },
    })
  })

export const deleteWorkflowState = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    await prisma.workflowState.delete({ where: { id: data.id } })
  })

export const reorderWorkflowStates = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      states: z.array(z.object({ id: z.string(), position: z.number() })),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")
    await prisma.$transaction(
      data.states.map(({ id, position }) =>
        prisma.workflowState.update({ where: { id }, data: { position } }),
      ),
    )
  })

export const workflowStatesQueryOptions = (teamId: string) =>
  queryOptions({
    queryKey: ["workflow-states", teamId],
    queryFn: () => getWorkflowStates({ data: { teamId } }),
  })

export const projectWorkflowStatesQueryOptions = (teamId: string, projectId: string) =>
  queryOptions({
    queryKey: ["workflow-states", teamId, projectId],
    queryFn: () => getProjectWorkflowStates({ data: { teamId, projectId } }),
  })
