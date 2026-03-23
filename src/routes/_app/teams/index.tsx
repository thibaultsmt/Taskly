import { createFileRoute, redirect } from "@tanstack/react-router"
import { ensureDefaultTeam } from "../../../server/teams"

export const Route = createFileRoute("/_app/teams/")({
  loader: async () => {
    const team = await ensureDefaultTeam()
    throw redirect({ to: "/teams/$teamId/tasks", params: { teamId: team.id } })
  },
  component: () => null,
})
