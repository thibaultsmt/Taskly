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

export const getTasks = createServerFn({ method: "GET" })
  .inputValidator(z.object({ teamId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")
    return prisma.task.findMany({
      where: { teamId: data.teamId, userId: session.user.id },
      orderBy: { position: "asc" },
    })
  })

export const createTask = createServerFn({ method: "POST" })
  .inputValidator(z.object({ teamId: z.string(), content: z.string().min(1) }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")
    const last = await prisma.task.findFirst({
      where: { teamId: data.teamId, userId: session.user.id },
      orderBy: { position: "desc" },
    })
    return prisma.task.create({
      data: {
        content: data.content,
        teamId: data.teamId,
        userId: session.user.id,
        position: (last?.position ?? -1) + 1,
      },
    })
  })

export const updateTask = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      content: z.string().optional(),
      completed: z.boolean().optional(),
      priority: z.string().optional(),
      startDate: z.string().optional().nullable(),
      dueDate: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")
    const { id, startDate, dueDate, ...rest } = data
    return prisma.task.update({
      where: { id, userId: session.user.id },
      data: {
        ...rest,
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      },
    })
  })

export const deleteTask = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")
    await prisma.task.delete({ where: { id: data.id, userId: session.user.id } })
  })

export const reorderTasks = createServerFn({ method: "POST" })
  .inputValidator(z.object({ tasks: z.array(z.object({ id: z.string(), position: z.number() })) }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")
    await prisma.$transaction(
      data.tasks.map(({ id, position }) =>
        prisma.task.update({ where: { id, userId: session.user.id }, data: { position } }),
      ),
    )
  })

export const tasksQueryOptions = (teamId: string) =>
  queryOptions({
    queryKey: ["tasks", teamId],
    queryFn: () => getTasks({ data: { teamId } }),
  })
