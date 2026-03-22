import * as React from "react"
import { ChevronUp, ChevronDown } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table"
import { Button } from "#/components/ui/button"
import { PriorityIcon } from "#/components/shared/priority-icon"
import { StatusBadge } from "#/components/shared/status-badge"
import { AssigneeAvatar } from "#/components/shared/assignee-avatar"
import type { WorkflowStateType } from "#/components/shared/status-badge"

type DbPriority = "none" | "low" | "medium" | "high" | "urgent"

const DB_TO_PRIORITY: Record<DbPriority, "NO_PRIORITY" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"> = {
  none: "NO_PRIORITY",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  urgent: "URGENT",
}

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
}

const PAGE_SIZE = 20

type SortField = "number" | "title" | "priority" | "createdAt" | "startDate" | "dueDate"
type SortDir = "asc" | "desc"

interface WorkflowState {
  id: string
  name: string
  type: string
  color: string
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
  startDate?: Date | string | null
  dueDate?: Date | string | null
  createdAt: Date | string
}

interface Team {
  key: string
}

interface IssueTableProps {
  issues: Issue[]
  team: Team
  onEdit: (issue: Issue) => void
  onView?: (issue: Issue) => void
  sort?: SortField
  dir?: SortDir
  onSort?: (field: SortField, dir: SortDir) => void
}

function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function SortableHead({
  field,
  label,
  currentSort,
  currentDir,
  onSort,
}: {
  field: SortField
  label: string
  currentSort?: SortField
  currentDir?: SortDir
  onSort?: (field: SortField, dir: SortDir) => void
}) {
  const isActive = currentSort === field

  function handleClick() {
    if (!onSort) return
    if (isActive) {
      onSort(field, currentDir === "asc" ? "desc" : "asc")
    } else {
      onSort(field, "asc")
    }
  }

  return (
    <TableHead
      className={`cursor-pointer select-none ${onSort ? "hover:text-foreground" : ""}`}
      onClick={handleClick}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentDir === "asc" ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )
        ) : null}
      </span>
    </TableHead>
  )
}

function IssueTable({ issues, team, onEdit, onView, sort, dir, onSort }: IssueTableProps) {
  const [page, setPage] = React.useState(1)
  const [localSort, setLocalSort] = React.useState<SortField>("number")
  const [localDir, setLocalDir] = React.useState<SortDir>("desc")

  const activeSort = sort ?? localSort
  const activeDir = dir ?? localDir

  function handleSort(field: SortField, d: SortDir) {
    if (onSort) {
      onSort(field, d)
    } else {
      setLocalSort(field)
      setLocalDir(d)
    }
  }

  const sorted = React.useMemo(() => {
    const arr = [...issues]
    arr.sort((a, b) => {
      let cmp = 0
      switch (activeSort) {
        case "number":
          cmp = a.number - b.number
          break
        case "title":
          cmp = a.title.localeCompare(b.title)
          break
        case "priority":
          cmp = (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0)
          break
        case "createdAt": {
          const dateA = new Date(a.createdAt).getTime()
          const dateB = new Date(b.createdAt).getTime()
          cmp = dateA - dateB
          break
        }
        case "startDate": {
          const dateA = a.startDate ? new Date(a.startDate).getTime() : 0
          const dateB = b.startDate ? new Date(b.startDate).getTime() : 0
          cmp = dateA - dateB
          break
        }
        case "dueDate": {
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0
          cmp = dateA - dateB
          break
        }
      }
      return activeDir === "asc" ? cmp : -cmp
    })
    return arr
  }, [issues, activeSort, activeDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  React.useEffect(() => {
    setPage(1)
  }, [issues.length])

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                field="number"
                label="#"
                currentSort={activeSort}
                currentDir={activeDir}
                onSort={handleSort}
              />
              <SortableHead
                field="title"
                label="Titre"
                currentSort={activeSort}
                currentDir={activeDir}
                onSort={handleSort}
              />
              <TableHead>Status</TableHead>
              <SortableHead
                field="priority"
                label="Priorité"
                currentSort={activeSort}
                currentDir={activeDir}
                onSort={handleSort}
              />
              <TableHead>Projet</TableHead>
              <TableHead>Assigné</TableHead>
              <SortableHead
                field="startDate"
                label="Début"
                currentSort={activeSort}
                currentDir={activeDir}
                onSort={handleSort}
              />
              <SortableHead
                field="dueDate"
                label="Échéance"
                currentSort={activeSort}
                currentDir={activeDir}
                onSort={handleSort}
              />
              <SortableHead
                field="createdAt"
                label="Créée le"
                currentSort={activeSort}
                currentDir={activeDir}
                onSort={handleSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Aucune issue trouvée
                </TableCell>
              </TableRow>
            ) : (
              paged.map((issue) => {
                const priority = DB_TO_PRIORITY[issue.priority as DbPriority] ?? "NO_PRIORITY"

                return (
                  <TableRow
                    key={issue.id}
                    className="cursor-pointer"
                    onClick={() => (onView ?? onEdit)(issue)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {issue.project ? issue.project.name.slice(0, 3).toUpperCase() : team.key}-{issue.number}
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-medium">
                      {issue.title}
                    </TableCell>
                    <TableCell>
                      {issue.workflowState ? (
                        <StatusBadge
                          type={issue.workflowState.type as WorkflowStateType}
                          name={issue.workflowState.name}
                          className="text-xs"
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <PriorityIcon priority={priority} />
                        <span className="text-xs capitalize">{issue.priority}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {issue.project?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      {issue.assignee ? (
                        <AssigneeAvatar assignee={{ name: issue.assignee, email: "", image: issue.assigneeImage }} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {issue.startDate ? formatDate(issue.startDate) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {issue.dueDate ? formatDate(issue.dueDate) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(issue.createdAt)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-2">
          <span className="text-xs text-muted-foreground">
            Page {currentPage} / {totalPages} — {sorted.length} issue{sorted.length > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export { IssueTable }
