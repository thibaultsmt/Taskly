import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog"
import { StatusBadge } from "#/components/shared/status-badge"
import { PriorityIcon } from "#/components/shared/priority-icon"
import { LabelBadge } from "#/components/shared/label-badge"
import { UserAvatar } from "#/components/shared/user-avatar"
import type { WorkflowStateType } from "#/components/shared/status-badge"
import type { Priority } from "#/components/shared/priority-icon"

type DbPriority = "none" | "low" | "medium" | "high" | "urgent"

const DB_TO_PRIORITY: Record<DbPriority, Priority> = {
  none: "NO_PRIORITY",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  urgent: "URGENT",
}

const PRIORITY_LABELS: Record<Priority, string> = {
  NO_PRIORITY: "Aucune priorité",
  LOW: "Faible",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  URGENT: "Urgente",
}

interface IssueLabel {
  id: string
  labelId: string
  label: { id: string; name: string; color: string }
}

interface Issue {
  id: string
  title: string
  description?: string | null
  number: number
  priority: string
  assignee?: string | null
  assigneeImage?: string | null
  workflowStateId: string
  workflowState?: { id: string; name: string; type: string; color: string; position: number } | null
  projectId?: string | null
  project?: { id: string; name: string } | null
  labels?: IssueLabel[]
  estimate?: number | null
  startDate?: Date | string | null
  dueDate?: Date | string | null
  createdAt: Date | string
}

interface Team {
  key: string
}

interface IssueDetailModalProps {
  issue: Issue | null
  team: Team
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (issue: Issue) => void
}

function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  )
}

function IssueDetailModal({ issue, team, open, onOpenChange }: IssueDetailModalProps) {
  if (!issue) return null

  const priority = DB_TO_PRIORITY[issue.priority as DbPriority] ?? "NO_PRIORITY"
  const labels = issue.labels ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <div className="flex flex-col gap-1 pr-8">
            <span className="font-mono text-xs text-muted-foreground">
              {issue.project ? issue.project.name.slice(0, 3).toUpperCase() : team.key}-{issue.number}
            </span>
            <DialogTitle className="text-base font-semibold leading-snug">
              {issue.title}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Body: two columns */}
        <div className="flex overflow-hidden" style={{ maxHeight: "65vh" }}>
          {/* Left: description */}
          <div className="flex-1 overflow-y-auto px-6 py-4 border-r">
            <span className="text-xs text-muted-foreground mb-1 block">Description</span>
            {issue.description ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {issue.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Aucune description</p>
            )}
          </div>

          {/* Right: properties */}
          <div className="w-64 shrink-0 overflow-y-auto px-4 py-4 flex flex-col divide-y divide-border/50">
            <PropRow label="Statut">
              {issue.workflowState ? (
                <StatusBadge
                  type={issue.workflowState.type as WorkflowStateType}
                  name={issue.workflowState.name}
                />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </PropRow>

            <PropRow label="Priorité">
              <span className="flex items-center gap-1.5">
                <PriorityIcon priority={priority} />
                <span className="text-xs">{PRIORITY_LABELS[priority]}</span>
              </span>
            </PropRow>

            <PropRow label="Assigné">
              {issue.assignee ? (
                <span className="flex items-center gap-1.5">
                  <UserAvatar
                    name={issue.assignee}
                    image={issue.assigneeImage ?? undefined}
                    size="sm"
                  />
                  <span className="text-xs truncate">{issue.assignee}</span>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Non assigné</span>
              )}
            </PropRow>

            {issue.project && (
              <PropRow label="Projet">
                <span className="text-xs">{issue.project.name}</span>
              </PropRow>
            )}

            {issue.estimate != null && (
              <PropRow label="Estimation">
                <span className="text-xs">{issue.estimate} pt{issue.estimate !== 1 ? "s" : ""}</span>
              </PropRow>
            )}

            {issue.startDate && (
              <PropRow label="Début">
                <span className="text-xs">{formatDate(issue.startDate)}</span>
              </PropRow>
            )}

            {issue.dueDate && (
              <PropRow label="Échéance">
                <span className="text-xs">{formatDate(issue.dueDate)}</span>
              </PropRow>
            )}

            {labels.length > 0 && (
              <PropRow label="Labels">
                <div className="flex flex-wrap gap-1">
                  {labels.map((il) => (
                    <LabelBadge key={il.id} name={il.label.name} color={il.label.color} />
                  ))}
                </div>
              </PropRow>
            )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  )
}

export { IssueDetailModal }
