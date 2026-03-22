import { createServerFn } from "@tanstack/react-start"
import { queryOptions } from "@tanstack/react-query"
import { prisma } from "../lib/db"
import { z } from "zod"
import { auth } from "../lib/auth"
import { getRequest } from "@tanstack/start-server-core"
import { resend, FROM_EMAIL } from "../lib/email"

async function getSession() {
  const request = getRequest()
  if (!request) return null
  return auth.api.getSession({ headers: request.headers })
}

export const getInvitations = createServerFn({ method: "GET" })
  .inputValidator(z.object({ teamId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    return prisma.invitation.findMany({
      where: { teamId: data.teamId, status: "pending" },
      include: { team: true },
      orderBy: { createdAt: "desc" },
    })
  })

export const getInvitationById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ invitationId: z.string() }))
  .handler(async ({ data }) => {
    return prisma.invitation.findUnique({
      where: { id: data.invitationId },
      include: { team: true },
    })
  })

export const createInvitation = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      teamId: z.string(),
      email: z.string().email(),
      role: z.enum(["developer", "admin", "viewer"]).default("developer"),
    }),
  )
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const invitation = await prisma.invitation.create({
      data: {
        teamId: data.teamId,
        email: data.email,
        role: data.role,
        invitedBy: session.user.id,
        expiresAt,
      },
      include: { team: true },
    })

    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: `Invitation to join ${invitation.team.name} on Taskly`,
      html: `<p>You've been invited to join <strong>${invitation.team.name}</strong> on Taskly.</p><p>Click <a href="${process.env.VITE_APP_URL ?? ""}/invite/${invitation.id}">here</a> to accept the invitation.</p>`,
    })

    return invitation
  })

export const resendInvitation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ invitationId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const invitation = await prisma.invitation.findUniqueOrThrow({
      where: { id: data.invitationId },
      include: { team: true },
    })

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await prisma.invitation.update({
      where: { id: data.invitationId },
      data: { expiresAt, status: "pending" },
    })

    await resend.emails.send({
      from: FROM_EMAIL,
      to: invitation.email,
      subject: `Invitation to join ${invitation.team.name} on Taskly`,
      html: `<p>You've been invited to join <strong>${invitation.team.name}</strong> on Taskly.</p><p>Click <a href="${process.env.VITE_APP_URL ?? ""}/invite/${invitation.id}">here</a> to accept the invitation.</p>`,
    })

    return invitation
  })

export const deleteInvitation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ invitationId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    await prisma.invitation.delete({ where: { id: data.invitationId } })
  })

export const acceptInvitation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ invitationId: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")

    const invitation = await prisma.invitation.findUniqueOrThrow({
      where: { id: data.invitationId },
    })

    // Check if already a member
    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: invitation.teamId, userId: session.user.id } },
    })

    if (!existing) {
      await prisma.teamMember.create({
        data: {
          teamId: invitation.teamId,
          userId: session.user.id,
          userEmail: session.user.email,
          userName: session.user.name,
          role: invitation.role,
        },
      })
    }

    await prisma.invitation.update({
      where: { id: data.invitationId },
      data: { status: "accepted" },
    })

    return { teamId: invitation.teamId }
  })

export const invitationsQueryOptions = (teamId: string) =>
  queryOptions({
    queryKey: ["invitations", teamId],
    queryFn: () => getInvitations({ data: { teamId } }),
  })
