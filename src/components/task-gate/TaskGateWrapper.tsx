import { useState, useCallback, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLockEvent } from "../../hooks/useLockEvent"
import { hasTodayTasks } from "../../server/daily-tasks"
import { TaskGateModal } from "./TaskGateModal"

export function TaskGateWrapper({ children }: { children: React.ReactNode }) {
  const [showGate, setShowGate] = useState(false)
  const [hasCheckedToday, setHasCheckedToday] = useState(false)

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

  const handleUnlock = useCallback((_timestamp: number) => {
    void hasTodayTasks().then((hasTasks) => {
      if (!hasTasks) setShowGate(true)
    })
  }, [])

  useLockEvent(handleUnlock)

  const handleComplete = useCallback(() => {
    setShowGate(false)
  }, [])

  return (
    <>
      {children}
      {showGate && <TaskGateModal onComplete={handleComplete} />}
    </>
  )
}
