import * as React from "react"
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react"
import { PriorityIcon } from "#/components/shared/priority-icon"
import { StatusBadge } from "#/components/shared/status-badge"
import { LabelBadge } from "#/components/shared/label-badge"
import { AssigneeAvatar } from "#/components/shared/assignee-avatar"
import { ActionsMenu } from "#/components/shared/actions-menu"
import type { WorkflowStateType } from "#/components/shared/status-badge"

type DbPriority = "none" | "low" | "medium" | "high" | "urgent"

const DB_TO_PRIORITY: Record<DbPriority, "NO_PRIORITY" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"> = {
  none: "NO_PRIORITY",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  urgent: "URGENT",
}

interface WorkflowState {
  id: string
  name: string
  type: string
  color: string
  position: number
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
  number: number
  priority: string
  assignee?: string | null
  assigneeImage?: string | null
  workflowStateId: string
  workflowState?: WorkflowState | null
  labels?: IssueLabel[]
  project?: { id: string; name: string } | null
  dueDate?: Date | string | null
}

function fmtDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

interface Team {
  key: string
}

interface IssueListProps {
  issues: Issue[]
  states: WorkflowState[]
  team: Team
  onEdit: (issue: Issue) => void
  onDelete: (issueId: string) => void
  onView?: (issue: Issue) => void
}

export function IssueRow({
  issue,
  teamKey,
  onEdit,
  onDelete,
  onView,
}: {
  issue: Issue
  teamKey: string
  onEdit: (issue: Issue) => void
  onDelete: (issueId: string) => void
  onView?: (issue: Issue) => void
}) {
  const priority = DB_TO_PRIORITY[issue.priority as DbPriority] ?? "NO_PRIORITY"
  const labels = issue.labels ?? []
  const visibleLabels = labels.slice(0, 2)
  const extraLabels = labels.length - 2

  return (
    <div className="group flex items-center gap-3 border-b px-4 py-2 text-sm hover:bg-muted/30 transition-colors">
      <PriorityIcon priority={priority} className="shrink-0" />

      <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
        {issue.project ? issue.project.name.slice(0, 3).toUpperCase() : teamKey}-{issue.number}
      </span>

      <button
        className="flex-1 truncate text-left hover:underline cursor-pointer"
        onClick={() => (onView ?? onEdit)(issue)}
      >
        {issue.title}
      </button>

      {issue.workflowState && (
        <StatusBadge
          type={issue.workflowState.type as WorkflowStateType}
          name={issue.workflowState.name}
          className="shrink-0 text-xs"
        />
      )}

      <div className="flex shrink-0 items-center gap-1">
        {visibleLabels.map((il) => (
          <LabelBadge key={il.id} name={il.label.name} color={il.label.color} />
        ))}
        {extraLabels > 0 && (
          <span className="text-xs text-muted-foreground">+{extraLabels}</span>
        )}
      </div>

      {issue.dueDate && (
        <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(issue.dueDate)}</span>
      )}

      <div className="shrink-0">
        <AssigneeAvatar
          assignee={issue.assignee ? { name: issue.assignee, email: "", image: issue.assigneeImage } : null}
        />
      </div>

      <div className="overflow-hidden w-0 group-hover:w-[22px] transition-all duration-150 shrink-0">
        <div className="w-[22px] flex items-center justify-center">
        <ActionsMenu
          actions={[
            {
              label: "Modifier",
              icon: Pencil,
              onClick: () => onEdit(issue),
            },
            {
              label: "Supprimer",
              icon: Trash2,
              onClick: () => onDelete(issue.id),
              variant: "destructive",
              separator: true,
            },
          ]}
        />
        </div>
      </div>
    </div>
  )
}

function IssueGroup({
  state,
  issues,
  teamKey,
  onEdit,
  onDelete,
  onView,
}: {
  state: WorkflowState
  issues: Issue[]
  teamKey: string
  onEdit: (issue: Issue) => void
  onDelete: (issueId: string) => void
  onView?: (issue: Issue) => void
}) {
  const [collapsed, setCollapsed] = React.useState(false)

  return (
    <div>
      <button
        className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={() => setCollapsed((c) => !c)}
      >
        {collapsed ? (
          <ChevronRight className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: state.color }}
        />
        <span>{state.name}</span>
        <span className="ml-1 text-xs text-muted-foreground">({issues.length})</span>
      </button>

      {!collapsed && (
        <div>
          {issues.length === 0 ? (
            <div className="px-12 py-2 text-xs text-muted-foreground">
              Aucune issue dans cet état
            </div>
          ) : (
            issues.map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                teamKey={teamKey}
                onEdit={onEdit}
                onDelete={onDelete}
                onView={onView}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function IssueList({ issues, states, team, onEdit, onDelete, onView }: IssueListProps) {
  const sortedStates = [...states].sort((a, b) => a.position - b.position)

  const grouped = React.useMemo(() => {
    const map = new Map<string, Issue[]>()
    for (const state of sortedStates) {
      map.set(state.id, [])
    }
    for (const issue of issues) {
      const existing = map.get(issue.workflowStateId)
      if (existing) {
        existing.push(issue)
      } else {
        map.set(issue.workflowStateId, [issue])
      }
    }
    return map
  }, [issues, sortedStates])

  return (
    <div className="divide-y">
      {sortedStates.map((state) => (
        <IssueGroup
          key={state.id}
          state={state}
          issues={grouped.get(state.id) ?? []}
          teamKey={team.key}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
        />
      ))}
    </div>
  )
}

export { IssueList }
export type { Issue as IssueListIssue, WorkflowState as IssueListWorkflowState }
