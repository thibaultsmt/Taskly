import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { getSession } from "../../server/auth"
import { TaskGateWrapper } from "../../components/task-gate/TaskGateWrapper"

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: "/login" })
    return { session }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <TaskGateWrapper>
      <Outlet />
    </TaskGateWrapper>
  )
}
