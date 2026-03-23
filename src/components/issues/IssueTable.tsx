import * as React from "react"
import { ChevronUp, ChevronDown, Eye, Save, X, CalendarDays } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table"
import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "#/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover"
import { DateSubPanel, formatDate as fmtPickerDate, startOfDay } from "#/components/shared/date-picker"
import { PriorityIcon } from "#/components/shared/priority-icon"
import { StatusBadge } from "#/components/shared/status-badge"
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
  urgent: 4, high: 3, medium: 2, low: 1, none: 0,
}

const PRIORITIES: { value: DbPriority; label: string }[] = [
  { value: "none", label: "Sans priorité" },
  { value: "low", label: "Faible" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Haute" },
  { value: "urgent", label: "Urgente" },
]

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
  label: { id: string; name: string; color: string }
}

interface Member {
  id: string
  userName: string
  userEmail: string
  image?: string | null
}

interface Project {
  id: string
  name: string
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
  projectId?: string | null
  project?: { id: string; name: string } | null
  startDate?: Date | string | null
  dueDate?: Date | string | null
  createdAt: Date | string
}

interface Team {
  key: string
  members?: Member[]
  projects?: Project[]
}

export interface EditDraft {
  title: string
  workflowStateId: string
  priority: string
  assignee: string | null
  projectId: string | null
  startDate: string | null
  dueDate: string | null
}

interface IssueTableProps {
  issues: Issue[]
  team: Team
  workflowStates?: WorkflowState[]
  onEdit: (issue: Issue) => void
  onView?: (issue: Issue) => void
  onSave?: (issueId: string, draft: EditDraft) => void
  sort?: SortField
  dir?: SortDir
  onSort?: (field: SortField, dir: SortDir) => void
}

function toDateString(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10)
}

function fmtTableDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function makeDraft(issue: Issue): EditDraft {
  return {
    title: issue.title,
    workflowStateId: issue.workflowStateId,
    priority: issue.priority,
    assignee: issue.assignee ?? null,
    projectId: issue.projectId ?? null,
    startDate: issue.startDate ? toDateString(issue.startDate) : null,
    dueDate: issue.dueDate ? toDateString(issue.dueDate) : null,
  }
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
    onSort(field, isActive && currentDir === "asc" ? "desc" : "asc")
  }

  return (
    <TableHead
      className={`cursor-pointer select-none ${onSort ? "hover:text-foreground" : ""}`}
      onClick={handleClick}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive && (currentDir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
      </span>
    </TableHead>
  )
}

function DateCell({
  value,
  onSelect,
  onPortalOpen,
  onPortalClose,
}: {
  value: string | null
  onSelect: (d: Date | null) => void
  onPortalOpen: () => void
  onPortalClose: () => void
}) {
  const dateVal = value ? new Date(value) : null
  return (
    <Popover onOpenChange={(open) => (open ? onPortalOpen() : onPortalClose())}>
      <PopoverTrigger className="inline-flex h-7 w-full items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-xs text-left transition-colors hover:bg-muted cursor-pointer">
        <CalendarDays className="size-3 shrink-0 text-muted-foreground" />
        <span className={dateVal ? "text-foreground" : "text-muted-foreground"}>
          {dateVal ? fmtPickerDate(dateVal) : "JJ/MM/AAAA"}
        </span>
      </PopoverTrigger>
      <PopoverContent className="p-0 overflow-hidden w-auto" align="start" sideOffset={6}>
        <DateSubPanel
          value={dateVal}
          onSelect={onSelect}
          clearable={!!dateVal}
        />
      </PopoverContent>
    </Popover>
  )
}

function IssueTableRow({
  issue,
  teamKey,
  workflowStates,
  members,
  projects,
  onView,
  onSave,
}: {
  issue: Issue
  teamKey: string
  workflowStates?: WorkflowState[]
  members?: Member[]
  projects?: Project[]
  onView?: (issue: Issue) => void
  onSave?: (issueId: string, draft: EditDraft) => void
}) {
  const rowRef = React.useRef<HTMLTableRowElement>(null)
  const editingRef = React.useRef(false)
  const [editing, setEditing] = React.useState(false)
  const activePortalsRef = React.useRef(0)

  const [draft, setDraftState] = React.useState<EditDraft>(() => makeDraft(issue))
  const draftRef = React.useRef(draft)

  function updateDraft(updater: (d: EditDraft) => EditDraft) {
    setDraftState((prev) => {
      const next = updater(prev)
      draftRef.current = next
      return next
    })
  }

  React.useEffect(() => {
    if (!editing) {
      const fresh = makeDraft(issue)
      draftRef.current = fresh
      setDraftState(fresh)
    }
  }, [issue, editing])

  function enterEdit() {
    if (editingRef.current) return
    editingRef.current = true
    setEditing(true)
  }

  function exitEdit(save: boolean) {
    editingRef.current = false
    setEditing(false)
    if (save) {
      onSave?.(issue.id, draftRef.current)
    } else {
      const fresh = makeDraft(issue)
      draftRef.current = fresh
      setDraftState(fresh)
    }
  }

  const exitEditRef = React.useRef(exitEdit)
  exitEditRef.current = exitEdit

  React.useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (!editingRef.current) return
      if (activePortalsRef.current > 0) return
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        exitEditRef.current(true)
      }
    }
    document.addEventListener("mousedown", handleMouseDown)
    return () => document.removeEventListener("mousedown", handleMouseDown)
  }, [])

  function onPortalOpen() { activePortalsRef.current++ }
  function onPortalClose() { activePortalsRef.current-- }

  const currentPriority = DB_TO_PRIORITY[draft.priority as DbPriority] ?? "NO_PRIORITY"
  const currentState = workflowStates?.find((s) => s.id === draft.workflowStateId)
  const currentProject = projects?.find((p) => p.id === draft.projectId)

  return (
    <TableRow ref={rowRef} onFocus={enterEdit}>
      {/* # — read-only */}
      <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
        {issue.project ? issue.project.name.slice(0, 3).toUpperCase() : teamKey}-{issue.number}
      </TableCell>

      {/* Title */}
      <TableCell className="max-w-[200px]">
        <Input
          value={draft.title}
          onChange={(e) => updateDraft((d) => ({ ...d, title: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Escape") exitEdit(false) }}
          className="h-7 py-0 text-sm font-medium"
        />
      </TableCell>

      {/* Status */}
      <TableCell>
        {workflowStates ? (
          <Select
            value={draft.workflowStateId}
            onValueChange={(v) => updateDraft((d) => ({ ...d, workflowStateId: v as string }))}
            onOpenChange={(open) => (open ? onPortalOpen() : onPortalClose())}
          >
            <SelectTrigger size="sm" className="w-full min-w-[110px]">
              {currentState ? (
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: currentState.color }} />
                  {currentState.name}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Statut</span>
              )}
            </SelectTrigger>
            <SelectContent>
              {workflowStates.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          issue.workflowState ? (
            <StatusBadge type={issue.workflowState.type as WorkflowStateType} name={issue.workflowState.name} className="text-xs" />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )
        )}
      </TableCell>

      {/* Priority */}
      <TableCell>
        <Select
          value={draft.priority}
          onValueChange={(v) => updateDraft((d) => ({ ...d, priority: v as string }))}
          onOpenChange={(open) => (open ? onPortalOpen() : onPortalClose())}
        >
          <SelectTrigger size="sm" className="w-full min-w-[120px]">
            <span className="flex items-center gap-1.5 text-xs">
              <PriorityIcon priority={currentPriority} className="size-3" />
              {PRIORITIES.find((p) => p.value === draft.priority)?.label ?? draft.priority}
            </span>
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                <PriorityIcon priority={DB_TO_PRIORITY[p.value]} className="size-3" />
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Project */}
      <TableCell>
        {projects ? (
          <Select
            value={draft.projectId ?? ""}
            onValueChange={(v) => updateDraft((d) => ({ ...d, projectId: (v as string) || null }))}
            onOpenChange={(open) => (open ? onPortalOpen() : onPortalClose())}
          >
            <SelectTrigger size="sm" className="w-full min-w-[110px]">
              <span className="text-xs">
                {currentProject ? (
                  currentProject.name
                ) : (
                  <span className="text-muted-foreground">Aucun projet</span>
                )}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Aucun projet</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">{issue.project?.name ?? "—"}</span>
        )}
      </TableCell>

      {/* Assignee */}
      <TableCell>
        {members ? (
          <Select
            value={draft.assignee ?? ""}
            onValueChange={(v) => updateDraft((d) => ({ ...d, assignee: (v as string) || null }))}
            onOpenChange={(open) => (open ? onPortalOpen() : onPortalClose())}
          >
            <SelectTrigger size="sm" className="w-full min-w-[110px]">
              <span className="text-xs">
                {draft.assignee ? (
                  draft.assignee
                ) : (
                  <span className="text-muted-foreground">Non assigné</span>
                )}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Non assigné</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.userName}>{m.userName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">{issue.assignee ?? "—"}</span>
        )}
      </TableCell>

      {/* Start date */}
      <TableCell>
        <DateCell
          value={draft.startDate}
          onSelect={(d) => updateDraft((dd) => ({ ...dd, startDate: d ? toDateString(startOfDay(d)) : null }))}
          onPortalOpen={onPortalOpen}
          onPortalClose={onPortalClose}
        />
      </TableCell>

      {/* Due date */}
      <TableCell>
        <DateCell
          value={draft.dueDate}
          onSelect={(d) => updateDraft((dd) => ({ ...dd, dueDate: d ? toDateString(startOfDay(d)) : null }))}
          onPortalOpen={onPortalOpen}
          onPortalClose={onPortalClose}
        />
      </TableCell>

      {/* Created at — read-only */}
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {fmtTableDate(issue.createdAt)}
      </TableCell>

      {/* Actions */}
      <TableCell>
        {editing ? (
          <div className="flex items-center gap-1">
            <Button
              size="icon-xs"
              variant="outline"
              className="bg-white text-neutral-900 border-neutral-200 hover:bg-neutral-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exitEdit(true)}
              title="Sauvegarder"
            >
              <Save className="size-3" />
            </Button>
            <Button
              size="icon-xs"
              variant="outline"
              className="bg-white text-neutral-900 border-neutral-200 hover:bg-neutral-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exitEdit(false)}
              title="Annuler"
            >
              <X className="size-3" />
            </Button>
          </div>
        ) : (
          <Button
            size="xs"
            variant="outline"
            className="bg-white text-neutral-900 border-neutral-200 hover:bg-neutral-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-50"
            onFocus={(e) => e.stopPropagation()}
            onClick={() => onView?.(issue)}
          >
            <Eye className="size-3" />
            Voir
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

function IssueTable({ issues, team, workflowStates, onView, onSave, sort, dir, onSort }: IssueTableProps) {
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
        case "number": cmp = a.number - b.number; break
        case "title": cmp = a.title.localeCompare(b.title); break
        case "priority": cmp = (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0); break
        case "createdAt": cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break
        case "startDate": {
          cmp = (a.startDate ? new Date(a.startDate).getTime() : 0) - (b.startDate ? new Date(b.startDate).getTime() : 0)
          break
        }
        case "dueDate": {
          cmp = (a.dueDate ? new Date(a.dueDate).getTime() : 0) - (b.dueDate ? new Date(b.dueDate).getTime() : 0)
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

  React.useEffect(() => { setPage(1) }, [issues.length])

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead field="number" label="#" currentSort={activeSort} currentDir={activeDir} onSort={handleSort} />
              <SortableHead field="title" label="Titre" currentSort={activeSort} currentDir={activeDir} onSort={handleSort} />
              <TableHead>Status</TableHead>
              <SortableHead field="priority" label="Priorité" currentSort={activeSort} currentDir={activeDir} onSort={handleSort} />
              <TableHead>Projet</TableHead>
              <TableHead>Assigné</TableHead>
              <SortableHead field="startDate" label="Début" currentSort={activeSort} currentDir={activeDir} onSort={handleSort} />
              <SortableHead field="dueDate" label="Échéance" currentSort={activeSort} currentDir={activeDir} onSort={handleSort} />
              <SortableHead field="createdAt" label="Créée le" currentSort={activeSort} currentDir={activeDir} onSort={handleSort} />
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  Aucune issue trouvée
                </TableCell>
              </TableRow>
            ) : (
              paged.map((issue) => (
                <IssueTableRow
                  key={issue.id}
                  issue={issue}
                  teamKey={team.key}
                  workflowStates={workflowStates}
                  members={team.members}
                  projects={team.projects}
                  onView={onView}
                  onSave={onSave}
                />
              ))
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
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
              Précédent
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export { IssueTable }
