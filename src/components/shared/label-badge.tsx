import { cn } from "#/lib/utils"

interface LabelBadgeProps {
  name: string
  color: string
  className?: string
}

function LabelBadge({ name, color, className }: LabelBadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", className)}>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>{name}</span>
    </span>
  )
}

export { LabelBadge }
