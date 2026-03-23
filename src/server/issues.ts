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

export const getIssues = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      teamId: z.string(),
      workflowStateId: z.string().optional(),
      assigneeId: z.string().optional(),
      projectId: z.string().optional(),
      priority: z.string().optional(),
      labelId: z.string().optional(),
      sortField: z.enum(["title", "priority", "createdAt", "number"]).optional(),
      sortDirection: z.enum(["asc", "desc"]).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const {
      teamId,
      workflowStateId,
      assigneeId,
      projectId,
      priority,
      labelId,
      sortField = "createdAt",
      sortDirection = "desc",
    } = data

    const where: Record<string, unknown> = { teamId }

    if (workflowStateId) where.workflowStateId = workflowStateId
    if (assigneeId) where.assigneeId = assigneeId
    if (projectId) where.projectId = projectId
    if (priority) where.priority = priority
    if (labelId) {
      where.labels = { some: { labelId } }
    }

    const issues = await prisma.issue.findMany({
      where,
      include: {
        workflowState: true,
        labels: { include: { label: true } },
        project: true,
        _count: { select: { comments: true } },
      },
      orderBy: { [sortField]: sortDirection },
    })

    const assigneeNames = [...new Set(issues.map((i) => i.assignee).filter(Boolean))] as string[]
    if (assigneeNames.length === 0) return issues.map((i) => ({ ...i, assigneeImage: null }))

    const members = await prisma.teamMember.findMany({
      where: { teamId, userName: { in: assigneeNames } },
      select: { userName: true, userId: true },
    })
    const userIds = members.map((m) => m.userId)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, image: true },
    })
    const userImageMap = Object.fromEntries(users.map((u) => [u.id, u.image]))
    const nameToImage = Object.fromEntries(
      members.map((m) => [m.userName, userImageMap[m.userId] ?? null]),
    )

    return issues.map((i) => ({ ...i, assigneeImage: i.assignee ? (nameToImage[i.assignee] ?? null) : null }))
  })

export const getIssue = createServerFn({ method: "GET" })
  .inputValidator(z.object({ issueId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    return prisma.issue.findUniqueOrThrow({
      where: { id: data.issueId },
      include: {
        workflowState: true,
        labels: { include: { label: true } },
        project: true,
        _count: { select: { comments: true } },
      },
    })
  })

export const createIssue = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      teamId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.string().optional(),
      workflowStateId: z.string().optional(),
      assigneeId: z.string().optional(),
      assignee: z.string().optional(),
      projectId: z.string().optional(),
      startDate: z.string().optional().nullable(),
      dueDate: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const { teamId, startDate, dueDate, ...rest } = data

    // Auto-increment number per team
    const lastIssue = await prisma.issue.findFirst({
      where: { teamId },
      orderBy: { number: "desc" },
      select: { number: true },
    })
    const number = (lastIssue?.number ?? 0) + 1

    return prisma.issue.create({
      data: {
        ...rest,
        teamId,
        number,
        creatorId: session.user.id,
        creator: session.user.name,
        workflowStateId: rest.workflowStateId ?? "",
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      },
      include: {
        workflowState: true,
        labels: { include: { label: true } },
        project: true,
        _count: { select: { comments: true } },
      },
    })
  })

export const updateIssue = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      issueId: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.string().optional(),
      workflowStateId: z.string().optional(),
      assigneeId: z.string().optional(),
      assignee: z.string().nullable().optional(),
      projectId: z.string().nullable().optional(),
      startDate: z.string().optional().nullable(),
      dueDate: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const { issueId, startDate, dueDate, ...rest } = data
    return prisma.issue.update({
      where: { id: issueId },
      data: {
        ...rest,
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      },
      include: {
        workflowState: true,
        labels: { include: { label: true } },
        project: true,
        _count: { select: { comments: true } },
      },
    })
  })

export const deleteIssue = createServerFn({ method: "POST" })
  .inputValidator(z.object({ issueId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    await prisma.issue.delete({ where: { id: data.issueId } })
  })

export const issuesQueryOptions = (
  teamId: string,
  filters?: {
    workflowStateId?: string
    assigneeId?: string
    projectId?: string
    priority?: string
    labelId?: string
    sortField?: "title" | "priority" | "createdAt" | "number"
    sortDirection?: "asc" | "desc"
  },
) =>
  queryOptions({
    queryKey: ["issues", teamId, filters],
    queryFn: () => getIssues({ data: { teamId, ...filters } }),
  })
