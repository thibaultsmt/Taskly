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

export const getTeamStats = createServerFn({ method: "GET" })
  .inputValidator(z.object({ teamId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const { teamId } = data

    const [
      membersCount,
      projectsCount,
      totalIssues,
      workflowStates,
      priorityGroups,
      recentIssues,
    ] = await Promise.all([
      prisma.teamMember.count({ where: { teamId } }),
      prisma.project.count({ where: { teamId } }),
      prisma.issue.count({ where: { teamId } }),
      prisma.workflowState.findMany({ where: { teamId }, orderBy: { position: "asc" } }),
      prisma.issue.groupBy({
        by: ["priority"],
        where: { teamId },
        _count: { _all: true },
      }),
      prisma.issue.findMany({
        where: { teamId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          workflowState: true,
          project: true,
        },
      }),
    ])

    // Compute completed issues count (workflow states with type "completed")
    const completedStateIds = workflowStates
      .filter((ws) => ws.type === "completed")
      .map((ws) => ws.id)

    const completedIssues = await prisma.issue.count({
      where: { teamId, workflowStateId: { in: completedStateIds } },
    })

    const completionRate =
      totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0

    // Build priority breakdown ensuring all priorities are present
    const priorityOrder = ["none", "low", "medium", "high", "urgent"]
    const priorityMap = new Map(
      priorityGroups.map((g) => [g.priority, g._count._all]),
    )
    const priorityBreakdown = priorityOrder.map((priority) => ({
      priority,
      count: priorityMap.get(priority) ?? 0,
    }))

    // Build status breakdown per workflow state
    const issuesByState = await prisma.issue.groupBy({
      by: ["workflowStateId"],
      where: { teamId },
      _count: { _all: true },
    })
    const stateCountMap = new Map(
      issuesByState.map((g) => [g.workflowStateId, g._count._all]),
    )
    const statusBreakdown = workflowStates.map((ws) => ({
      type: ws.type,
      name: ws.name,
      count: stateCountMap.get(ws.id) ?? 0,
      color: ws.color,
    }))

    return {
      stats: {
        membersCount,
        projectsCount,
        totalIssues,
        completedIssues,
        completionRate,
      },
      priorityBreakdown,
      statusBreakdown,
      recentIssues,
    }
  })

export const teamStatsQueryOptions = (teamId: string) =>
  queryOptions({
    queryKey: ["team-stats", teamId],
    queryFn: () => getTeamStats({ data: { teamId } }),
  })
