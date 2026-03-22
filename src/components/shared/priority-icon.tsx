import { Minus, ChevronDown, ChevronUp, ArrowUp, AlertCircle } from "lucide-react"
import { cn } from "#/lib/utils"

type Priority = "NO_PRIORITY" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"

interface PriorityIconProps {
  priority: Priority
  className?: string
}

const priorityConfig: Record<Priority, { icon: React.ElementType; color: string }> = {
  NO_PRIORITY: { icon: Minus, color: "text-muted-foreground" },
  LOW: { icon: ChevronDown, color: "text-blue-500" },
  MEDIUM: { icon: ChevronUp, color: "text-yellow-500" },
  HIGH: { icon: ArrowUp, color: "text-orange-500" },
  URGENT: { icon: AlertCircle, color: "text-red-500" },
}

function PriorityIcon({ priority, className }: PriorityIconProps) {
  const { icon: Icon, color } = priorityConfig[priority] ?? priorityConfig.NO_PRIORITY
  return <Icon className={cn("size-4", color, className)} />
}

export { PriorityIcon, type Priority }
