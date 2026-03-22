import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { MoreHorizontal, Trash2, GitBranch, Check, EyeOff, Eye, GripVertical, ArrowUpDown, ArrowUpNarrowWide, CalendarDays } from "lucide-react"
import { sileo } from "sileo"
import { createTask, updateTask, deleteTask, reorderTasks, tasksQueryOptions } from "#/server/tasks"
import { createIssue } from "#/server/issues"
import { teamQueryOptions } from "#/server/teams"
import { projectsQueryOptions } from "#/server/projects"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "#/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#/components/ui/tooltip"
import { Button } from "#/components/ui/button"
import { PriorityIcon, type Priority } from "#/components/shared/priority-icon"
import { DateSubPanel, formatDate, startOfDay } from "#/components/shared/date-picker"
import { cn } from "#/lib/utils"

function fmtDateBadge(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
}

type DbPriority = "none" | "low" | "medium" | "high" | "urgent"

const DB_TO_PRIORITY: Record<DbPriority, Priority> = {
  none: "NO_PRIORITY",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  urgent: "URGENT",
}

const PRIORITIES: { value: DbPriority; label: string }[] = [
  { value: "none", label: "Sans priorité" },
  { value: "low", label: "Faible" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Haute" },
  { value: "urgent", label: "Urgente" },
]

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
}

export const Route = createFileRoute("/_app/teams/$teamId/tasks/")({
  loader: async ({ context, params }) => {
    const { queryClient } = context as { queryClient: { ensureQueryData: (opts: unknown) => Promise<unknown> } }
    await Promise.all([
      queryClient.ensureQueryData(tasksQueryOptions(params.teamId)),
      queryClient.ensureQueryData(projectsQueryOptions(params.teamId)),
    ])
  },
  component: TasksPage,
})

type Tab = "active" | "done"

interface Task {
  id: string
  content: string
  completed: boolean
  position: number
  priority: string | null
  startDate: string | Date | null
  dueDate: string | Date | null
  createdAt: string | Date
}

interface ConvertState {
  taskId: string
  content: string
  startDate?: string | null
  dueDate?: string | null
}

function TasksPage() {
  const { teamId } = Route.useParams()
  const queryClient = useQueryClient()

  const [tab, setTab] = React.useState<Tab>("active")
  const [showDoneInline, setShowDoneInline] = React.useState(false)
  const [sortByPriority, setSortByPriority] = React.useState(false)
  const [sortByDate, setSortByDate] = React.useState<"startDate" | "dueDate" | null>(null)
  const [leavingIds, setLeavingIds] = React.useState<Set<string>>(new Set())
  const [returningIds, setReturningIds] = React.useState<Set<string>>(new Set())
  const [newContent, setNewContent] = React.useState("")
  const [convertState, setConvertState] = React.useState<ConvertState | null>(null)
  const [selectedProjectId, setSelectedProjectId] = React.useState("")
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  const { data: tasks } = useSuspenseQuery(tasksQueryOptions(teamId))
  const { data: team } = useSuspenseQuery(teamQueryOptions(teamId))
  const { data: projects } = useSuspenseQuery(projectsQueryOptions(teamId))

  const [localTasks, setLocalTasks] = React.useState<Task[]>(tasks as Task[])
  React.useEffect(() => { setLocalTasks(tasks as Task[]) }, [tasks])
  const localTasksRef = React.useRef(localTasks)
  React.useEffect(() => { localTasksRef.current = localTasks }, [localTasks])

  const activeTasks = localTasks.filter((t) => !t.completed)
  const doneTasks = localTasks.filter((t) => t.completed)

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["tasks", teamId] })
  }

  function toastFill() {
    // Sidebar dark mode = oklch(0.145 0 0) ≈ #1a1a1a — texte blanc (sileo theme="light")
    // Sidebar light mode = oklch(0.985 0 0) ≈ #f9f9f9 — texte sombre (sileo theme="dark")
    return document.documentElement.classList.contains("dark") ? "#1a1a1a" : "#f9f9f9"
  }

  function removeLeaving(id: string) {
    setLeavingIds((prev) => { const n = new Set(prev); n.delete(id); return n })
  }

  function removeReturning(id: string) {
    setReturningIds((prev) => { const n = new Set(prev); n.delete(id); return n })
  }

  const createMutation = useMutation({
    mutationFn: (content: string) => createTask({ data: { teamId, content } }),
    onSuccess: invalidate,
    onError: (e: Error) => sileo.error({ title: e.message }),
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => updateTask({ data: { id, completed: true } }),
    onSuccess: (_, id) => {
      const task = localTasksRef.current.find((t) => t.id === id)
      sileo.success({
        title: "Tâche validée",
        description: task ? `"${task.content}" est bien terminée.` : undefined,
        fill: toastFill(),
      })
      setTimeout(() => { removeLeaving(id); invalidate() }, 700)
    },
    onError: (e: Error, id) => {
      removeLeaving(id)
      sileo.error({ title: "Erreur", description: e.message, fill: toastFill() })
    },
  })

  const uncompleteMutation = useMutation({
    mutationFn: (id: string) => updateTask({ data: { id, completed: false } }),
    onSuccess: (_, id) => {
      const task = localTasksRef.current.find((t) => t.id === id)
      sileo.success({
        title: "Tâche remise en cours",
        description: task ? `"${task.content}" repart dans En cours.` : undefined,
        fill: toastFill(),
      })
      setTimeout(() => { removeReturning(id); invalidate() }, 700)
    },
    onError: (e: Error, id) => {
      removeReturning(id)
      sileo.error({ title: "Erreur", description: e.message, fill: toastFill() })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask({ data: { id } }),
    onSuccess: invalidate,
    onError: (e: Error) => sileo.error({ title: e.message }),
  })

  const priorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: string }) =>
      updateTask({ data: { id, priority } }),
    onSuccess: invalidate,
    onError: (e: Error) => sileo.error({ title: e.message }),
  })

  const dateMutation = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: "startDate" | "dueDate"; value: string | null }) =>
      field === "startDate"
        ? updateTask({ data: { id, startDate: value } })
        : updateTask({ data: { id, dueDate: value } }),
    onSuccess: invalidate,
    onError: (e: Error) => sileo.error({ title: "Erreur", description: e.message, fill: toastFill() }),
  })

  const reorderMutation = useMutation({
    mutationFn: (ordered: { id: string; position: number }[]) =>
      reorderTasks({ data: { tasks: ordered } }),
    onSuccess: invalidate,
    onError: (e: Error) => sileo.error({ title: e.message }),
  })

  const convertMutation = useMutation({
    mutationFn: async ({ taskId, content, startDate, dueDate }: ConvertState) => {
      const firstState = (team as { workflowStates: Array<{ id: string }> }).workflowStates[0]
      await createIssue({
        data: {
          teamId,
          title: content,
          projectId: selectedProjectId || undefined,
          workflowStateId: firstState?.id,
          startDate: startDate ?? undefined,
          dueDate: dueDate ?? undefined,
        },
      })
      await deleteTask({ data: { id: taskId } })
    },
    onSuccess: () => {
      invalidate()
      void queryClient.invalidateQueries({ queryKey: ["issues", teamId] })
      setConvertState(null)
      setSelectedProjectId("")
      sileo.success({ title: "Issue créée" })
    },
    onError: (e: Error) => sileo.error({ title: e.message }),
  })

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      if (newContent.trim()) {
        e.preventDefault()
        createMutation.mutate(newContent.trim())
        setNewContent("")
        if (inputRef.current) inputRef.current.style.height = "auto"
      } else {
        e.preventDefault()
      }
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setNewContent(e.target.value)
    const el = e.target
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    const list = tab === "active" ? [...activeTasks] : [...doneTasks]
    const [moved] = list.splice(result.source.index, 1)
    list.splice(result.destination.index, 0, moved)
    const reordered = list.map((t, i) => ({ ...t, position: i }))
    const reorderedIds = new Set(reordered.map((t) => t.id))
    setLocalTasks((prev) => [
      ...prev.filter((t) => !reorderedIds.has(t.id)),
      ...reordered,
    ].sort((a, b) => a.position - b.position))
    reorderMutation.mutate(reordered.map((t) => ({ id: t.id, position: t.position })))
  }

  const baseShownTasks =
    tab === "active"
      ? showDoneInline
        ? localTasks
        : activeTasks
      : doneTasks

  const shownTasks = React.useMemo(() => {
    let list = sortByPriority
      ? [...baseShownTasks].sort(
          (a, b) =>
            (PRIORITY_ORDER[b.priority ?? "none"] ?? 0) -
            (PRIORITY_ORDER[a.priority ?? "none"] ?? 0),
        )
      : [...baseShownTasks]
    if (sortByDate) {
      list = [...list].sort((a, b) => {
        const aVal = a[sortByDate] ? new Date(a[sortByDate] as string | Date).getTime() : Infinity
        const bVal = b[sortByDate] ? new Date(b[sortByDate] as string | Date).getTime() : Infinity
        return aVal - bVal
      })
    }
    return list
  }, [baseShownTasks, sortByPriority, sortByDate])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h1 className="text-lg font-semibold">Tasks</h1>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <button
                  onClick={() => setSortByPriority((v) => !v)}
                  className={cn(
                    "inline-flex items-center justify-center size-7 rounded-md border transition-colors cursor-pointer",
                    sortByPriority
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-input text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {sortByPriority ? <ArrowUpNarrowWide className="size-3.5" /> : <ArrowUpDown className="size-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {sortByPriority ? "Désactiver le tri par priorité" : "Trier par priorité"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <button
                  onClick={() => setSortByDate((v) => (v === "startDate" ? null : "startDate"))}
                  className={cn(
                    "inline-flex items-center justify-center size-7 rounded-md border transition-colors cursor-pointer",
                    sortByDate === "startDate"
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-input text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <CalendarDays className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Trier par date de début</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <button
                  onClick={() => setSortByDate((v) => (v === "dueDate" ? null : "dueDate"))}
                  className={cn(
                    "inline-flex items-center justify-center size-7 rounded-md border transition-colors cursor-pointer",
                    sortByDate === "dueDate"
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-input text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <CalendarDays className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Trier par échéance</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <button
                  onClick={() => setShowDoneInline((v) => !v)}
                  className={cn(
                    "inline-flex items-center justify-center size-7 rounded-md border transition-colors cursor-pointer",
                    showDoneInline
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-input text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {showDoneInline ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {showDoneInline ? "Masquer les terminées" : "Afficher les terminées"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
            <button
              onClick={() => setTab("active")}
              className={cn(
                "px-3 py-1 text-xs rounded-md transition-colors cursor-pointer",
                tab === "active"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              En cours
            </button>
            <button
              onClick={() => setTab("done")}
              className={cn(
                "px-3 py-1 text-xs rounded-md transition-colors cursor-pointer",
                tab === "done"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Terminées
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-3">
        <div className="flex flex-col gap-0.5 max-w-2xl">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="tasks">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {shownTasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={sortByPriority}>
                      {(drag, snapshot) => (
                        <div
                          ref={drag.innerRef}
                          {...drag.draggableProps}
                          className={cn(snapshot.isDragging && "opacity-80")}
                        >
                          <TaskRow
                            task={task}
                            isLeaving={leavingIds.has(task.id)}
                            isReturning={returningIds.has(task.id)}
                            dragHandleProps={sortByPriority ? null : drag.dragHandleProps}
                            onToggle={() => {
                              if (task.completed) {
                                setReturningIds((prev) => new Set([...prev, task.id]))
                                uncompleteMutation.mutate(task.id)
                              } else {
                                setLeavingIds((prev) => new Set([...prev, task.id]))
                                completeMutation.mutate(task.id)
                              }
                            }}
                            onDelete={() => deleteMutation.mutate(task.id)}
                            onConvert={() => setConvertState({ taskId: task.id, content: task.content, startDate: task.startDate ? String(task.startDate) : null, dueDate: task.dueDate ? String(task.dueDate) : null })}
                            onSetPriority={(priority) => priorityMutation.mutate({ id: task.id, priority })}
                            onSetStartDate={(value) => dateMutation.mutate({ id: task.id, field: "startDate", value })}
                            onSetDueDate={(value) => dateMutation.mutate({ id: task.id, field: "dueDate", value })}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {tab === "active" && (
            <div className="flex items-start gap-2.5 rounded-md px-1 py-1.5">
              <div className="size-3.5 shrink-0 mt-0.5" />
              <div className="size-4 shrink-0 mt-0.5" />
              <textarea
                ref={inputRef}
                rows={1}
                value={newContent}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Nouvelle tâche…"
                className="flex-1 resize-none overflow-hidden bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 leading-5"
              />
            </div>
          )}

          {shownTasks.length === 0 && tab === "done" && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Aucune tâche terminée
            </p>
          )}
        </div>
      </div>

      <Dialog
        open={!!convertState}
        onOpenChange={(o) => {
          if (!o) {
            setConvertState(null)
            setSelectedProjectId("")
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Convertir en issue</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground truncate">{convertState?.content}</p>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Projet (optionnel)</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring cursor-pointer"
              >
                <option value="">Sans projet</option>
                {(projects as Array<{ id: string; name: string }>).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConvertState(null)
                setSelectedProjectId("")
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={() => convertState && convertMutation.mutate(convertState)}
              disabled={convertMutation.isPending}
            >
              Créer l'issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TaskRow({
  task,
  isLeaving,
  isReturning,
  dragHandleProps,
  onToggle,
  onDelete,
  onConvert,
  onSetPriority,
  onSetStartDate,
  onSetDueDate,
}: {
  task: Task
  isLeaving?: boolean
  isReturning?: boolean
  dragHandleProps: object | null | undefined
  onToggle: () => void
  onDelete: () => void
  onConvert: () => void
  onSetPriority: (priority: string) => void
  onSetStartDate: (iso: string | null) => void
  onSetDueDate: (iso: string | null) => void
}) {
  const priority = task.priority ? (DB_TO_PRIORITY[task.priority as DbPriority] ?? "NO_PRIORITY") : null
  const [showStrike, setShowStrike] = React.useState(false)
  const [isFading, setIsFading] = React.useState(false)
  const [showUnstrike, setShowUnstrike] = React.useState(false)

  React.useEffect(() => {
    if (!isLeaving) { setShowStrike(false); setIsFading(false); return }
    const t1 = setTimeout(() => setShowStrike(true), 80)
    const t2 = setTimeout(() => setIsFading(true), 350)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [isLeaving])

  React.useEffect(() => {
    if (!isReturning) { setShowUnstrike(false); setIsFading(false); return }
    const t1 = setTimeout(() => setShowUnstrike(true), 80)
    const t2 = setTimeout(() => setIsFading(true), 350)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [isReturning])

  const isVisuallyCompleted = (task.completed || isLeaving) && !showUnstrike

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/50",
        isFading && "animate-out fade-out duration-300 fill-mode-forwards",
      )}
    >
      <span
        {...(dragHandleProps ?? {})}
        className="text-muted-foreground/30 hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100"
      >
        <GripVertical className="size-3.5" />
      </span>

      <button
        onClick={onToggle}
        className={cn(
          "size-4 shrink-0 rounded border transition-colors cursor-pointer flex items-center justify-center",
          isVisuallyCompleted
            ? "bg-primary border-primary"
            : "border-muted-foreground/40 hover:border-primary",
        )}
      >
        {isVisuallyCompleted && <Check className="size-2.5 text-primary-foreground" />}
      </button>

      <span
        className={cn(
          "flex-1 text-sm transition-colors duration-150",
          isVisuallyCompleted && (showStrike || task.completed) && "line-through text-muted-foreground",
        )}
      >
        {task.content}
      </span>

      {priority && priority !== "NO_PRIORITY" && (
        <span className="shrink-0 text-muted-foreground">
          <PriorityIcon priority={priority} className="size-3.5" />
        </span>
      )}

      {task.dueDate !== null && (() => {
        const isOverdue = startOfDay(new Date(task.dueDate)).getTime() < startOfDay(new Date()).getTime()
        return (
          <span className={cn("shrink-0 text-xs", isOverdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
            {fmtDateBadge(new Date(task.dueDate))}
          </span>
        )
      })()}

      <div className="overflow-hidden w-0 group-hover:w-[22px] transition-all duration-150 shrink-0">
        <div className="w-[22px] flex items-center justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger className="p-0.5 rounded cursor-pointer text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          {!task.completed && (
            <DropdownMenuItem onClick={onConvert}>
              <GitBranch className="size-4" />
              Convertir en issue
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />

          {/* Priorité → sous-menu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {priority && priority !== "NO_PRIORITY"
                ? <PriorityIcon priority={priority} />
                : <PriorityIcon priority="NO_PRIORITY" />}
              Priorité
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent sideOffset={10}>
              {PRIORITIES.map((p) => (
                <DropdownMenuItem
                  key={p.value}
                  onClick={() => onSetPriority(p.value)}
                  className={cn(priority !== null && priority === DB_TO_PRIORITY[p.value] && "bg-accent text-accent-foreground")}
                >
                  <PriorityIcon priority={DB_TO_PRIORITY[p.value]} />
                  {p.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          {/* Créée le → sous-menu calendrier */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="items-start py-2">
              <CalendarDays className="size-4 mt-0.5 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span>Créée le</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(new Date(task.startDate ?? task.createdAt))}
                </span>
              </div>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="p-0 overflow-hidden" sideOffset={10}>
              <DateSubPanel
                value={new Date(task.startDate ?? task.createdAt)}
                onSelect={(d) => onSetStartDate(d ? d.toISOString() : null)}
                clearable={task.startDate !== null}
              />
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Échéance → sous-menu calendrier */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="items-start py-2">
              <CalendarDays className="size-4 mt-0.5 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span>Échéance</span>
                {task.dueDate && (
                  <span className="text-xs text-muted-foreground">
                    {formatDate(new Date(task.dueDate))}
                  </span>
                )}
              </div>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="p-0 overflow-hidden" sideOffset={10}>
              <DateSubPanel
                value={task.dueDate ? new Date(task.dueDate) : null}
                onSelect={(d) => onSetDueDate(d ? d.toISOString() : null)}
                minDate={(() => {
                  const today = startOfDay(new Date())
                  const sd = startOfDay(new Date(task.startDate ?? task.createdAt))
                  return sd > today ? sd : today
                })()}
              />
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="size-4" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
