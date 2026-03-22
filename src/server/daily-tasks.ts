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

export const hasTodayTasks = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getSession()
    if (!session) return false

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const count = await prisma.dailyTask.count({
      where: {
        userId: session.user.id,
        date: { gte: today },
      },
    })
    return count > 0
  },
)

export const getDailyTasks = createServerFn({ method: "GET" })
  .inputValidator(z.object({ date: z.string().optional() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const date = data.date ? new Date(data.date) : new Date()
    date.setHours(0, 0, 0, 0)

    return prisma.dailyTask.findMany({
      where: { userId: session.user.id, date: { gte: date } },
      orderBy: { createdAt: "asc" },
    })
  })

export const createDailyTask = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      content: z.string().min(1).max(500),
      date: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const date = data.date ? new Date(data.date) : new Date()
    date.setHours(0, 0, 0, 0)

    return prisma.dailyTask.create({
      data: {
        content: data.content,
        userId: session.user.id,
        date,
      },
    })
  })

export const completeDailyTask = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    return prisma.dailyTask.update({
      where: { id: data.id, userId: session.user.id },
      data: { completed: true },
    })
  })

export const todayTasksQueryOptions = queryOptions({
  queryKey: ["daily-tasks", "today"],
  queryFn: () => getDailyTasks({ data: {} }),
  staleTime: 1000 * 60,
})
