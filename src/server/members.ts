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

export const getTeamMembers = createServerFn({ method: "GET" })
  .inputValidator(z.object({ teamId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const members = await prisma.teamMember.findMany({
      where: { teamId: data.teamId },
      orderBy: { createdAt: "asc" },
    })
    const users = await prisma.user.findMany({
      where: { id: { in: members.map((m) => m.userId) } },
      select: { id: true, image: true },
    })
    const imageMap = Object.fromEntries(users.map((u) => [u.id, u.image]))
    return members.map((m) => ({ ...m, image: imageMap[m.userId] ?? null }))
  })

export const removeTeamMember = createServerFn({ method: "POST" })
  .inputValidator(z.object({ teamId: z.string(), memberId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    await prisma.teamMember.delete({
      where: { id: data.memberId, teamId: data.teamId },
    })
  })

export const teamMembersQueryOptions = (teamId: string) =>
  queryOptions({
    queryKey: ["team-members", teamId],
    queryFn: () => getTeamMembers({ data: { teamId } }),
  })
