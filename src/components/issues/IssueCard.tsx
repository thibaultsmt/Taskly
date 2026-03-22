import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { PriorityIcon } from "#/components/shared/priority-icon"
import { LabelBadge } from "#/components/shared/label-badge"
import { AssigneeAvatar } from "#/components/shared/assignee-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu"
import { cn } from "#/lib/utils"

type DbPriority = "none" | "low" | "medium" | "high" | "urgent"

const DB_TO_PRIORITY: Record<DbPriority, "NO_PRIORITY" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"> = {
  none: "NO_PRIORITY",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  urgent: "URGENT",
}

interface IssueLabel {
  id: string
  label: {
    id: string
    name: string
    color: string
  }
}

interface Issue {
  id: string
  title: string
  description?: string | null
  number: number
  priority: string
  assignee?: string | null
  assigneeImage?: string | null
  labels?: IssueLabel[]
  project?: { name: string } | null
  dueDate?: Date | string | null
}

function fmtDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

interface IssueCardProps {
  issue: Issue
  teamKey: string
  onEdit: (issue: Issue) => void
  onDelete?: (issueId: string) => void
  onView?: (issue: Issue) => void
  isDragging?: boolean
  className?: string
}

function IssueCard({ issue, teamKey, onEdit, onDelete, onView, isDragging, className }: IssueCardProps) {
  const priority = DB_TO_PRIORITY[issue.priority as DbPriority] ?? "NO_PRIORITY"
  const labels = issue.labels ?? []

  return (
    <div
      className={cn(
        "group cursor-pointer rounded-lg border bg-card p-3 text-sm shadow-sm",
        isDragging && "rotate-1 shadow-lg opacity-80",
        className,
      )}
      onClick={() => (onView ?? onEdit)(issue)}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {issue.project ? issue.project.name.slice(0, 3).toUpperCase() : teamKey}-{issue.number}
        </span>
        <div className="flex items-center shrink-0">
          <PriorityIcon priority={priority} />
          <div className="overflow-hidden w-0 group-hover:w-[22px] transition-all duration-150">
            <div className="w-[22px] flex items-center justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              className="p-0.5 rounded cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(issue) }}>
                <Pencil className="size-4" />
                Modifier
              </DropdownMenuItem>
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={(e) => { e.stopPropagation(); onDelete(issue.id) }}
                  >
                    <Trash2 className="size-4" />
                    Supprimer
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <p className="mb-2 line-clamp-2 font-medium leading-snug">{issue.title}</p>

      {labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-2">
          {labels.slice(0, 2).map((il) => (
            <LabelBadge key={il.id} name={il.label.name} color={il.label.color} />
          ))}
          {labels.length > 2 && (
            <span className="text-xs text-muted-foreground">+{labels.length - 2}</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-1">
        {issue.description && (
          <p className="flex-1 truncate text-xs text-muted-foreground">{issue.description}</p>
        )}
        {issue.dueDate && (
          <span className="text-xs text-muted-foreground">{fmtDate(issue.dueDate)}</span>
        )}
        <AssigneeAvatar
          assignee={issue.assignee ? { name: issue.assignee, email: "", image: issue.assigneeImage } : null}
          className="shrink-0 ml-auto"
        />
      </div>
    </div>
  )
}

export { IssueCard }
export type { Issue as IssueCardIssue }
