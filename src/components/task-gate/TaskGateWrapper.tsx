import { useState, useCallback, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter, useRouterState } from "@tanstack/react-router"
import { useLockEvent } from "../../hooks/useLockEvent"
import { hasTodayTasks } from "../../server/daily-tasks"
import { TaskGateModal } from "./TaskGateModal"
import { LockTaskModal } from "./LockTaskModal"

export function TaskGateWrapper({ children }: { children: React.ReactNode }) {
  const [showGate, setShowGate] = useState(false)
  const [hasCheckedToday, setHasCheckedToday] = useState(false)
  const [lockModalOpen, setLockModalOpen] = useState(false)
  const [lastKnownTeamId, setLastKnownTeamId] = useState("")

  const router = useRouter()
  const location = useRouterState({ select: (s) => s.location })
  const teamIdMatch = location.pathname.match(/\/teams\/([^/]+)/)
  const teamId = teamIdMatch?.[1] ?? ""

  useEffect(() => {
    if (teamId) setLastKnownTeamId(teamId)
  }, [teamId])

  const { data: todayHasTasks, isLoading } = useQuery({
    queryKey: ["daily-tasks", "has-today"],
    queryFn: () => hasTodayTasks(),
    staleTime: 1000 * 60 * 5,
  })

  useEffect(() => {
    if (!isLoading && !hasCheckedToday) {
      setHasCheckedToday(true)
      if (!todayHasTasks) {
        setShowGate(true)
      }
    }
  }, [todayHasTasks, isLoading, hasCheckedToday])

  const handleUnlock = useCallback(
    (_timestamp: number) => {
      void hasTodayTasks().then((hasTasks) => {
        if (!hasTasks) {
          setShowGate(true)
        } else if (teamId) {
          void router.navigate({
            to: "/teams/$teamId/tasks",
            params: { teamId },
          })
        }
      })
    },
    [teamId, router],
  )

  const handlePreLock = useCallback(() => {
    if (typeof window !== "undefined" && window.__TAURI__) {
      void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        const win = getCurrentWindow()
        void win.show().then(() => win.setFocus())
      })
    }
    setLockModalOpen(true)
  }, [])

  useLockEvent(handleUnlock, handlePreLock)

  const handleComplete = useCallback(() => {
    setShowGate(false)
  }, [])

  return (
    <>
      {children}
      {showGate && <TaskGateModal onComplete={handleComplete} />}
      {lastKnownTeamId && (
        <LockTaskModal
          open={lockModalOpen}
          onOpenChange={setLockModalOpen}
          teamId={lastKnownTeamId}
        />
      )}
    </>
  )
}
