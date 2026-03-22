import { cn } from "#/lib/utils"

type WorkflowStateType = "backlog" | "unstarted" | "started" | "completed" | "canceled"

interface StatusBadgeProps {
  type: string
  name: string
  color?: string
  className?: string
}

const stateColors: Record<string, string> = {
  backlog: "#94a3b8",
  unstarted: "#6b7280",
  started: "#3b82f6",
  completed: "#22c55e",
  canceled: "#ef4444",
}

function StatusBadge({ type, name, color, className }: StatusBadgeProps) {
  const dotColor = color ?? stateColors[type] ?? "#94a3b8"
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      <span>{name}</span>
    </span>
  )
}

export { StatusBadge, type WorkflowStateType }
