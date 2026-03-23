import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { MoreHorizontal, Trash2, GitBranch, Check, EyeOff, Eye, GripVertical, ArrowUpDown, ArrowUpNarrowWide, CalendarDays, Calendar, X, ChevronDown, Plus, Link as LinkIcon } from "lucide-react"
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
import { Textarea } from "#/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select"
import { PriorityIcon, type Priority } from "#/components/shared/priority-icon"
import { DateSubPanel, formatDate, startOfDay } from "#/components/shared/date-picker"
import { cn } from "#/lib/utils"
import { authClient } from "#/lib/auth-client"

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
  note: string | null
  createdAt: string | Date
  attachments?: string[]
  links?: string[]
}

interface ConvertState {
  taskId: string
  content: string
  note?: string | null
  createdAt: string
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
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null)
  const [panelOpen, setPanelOpen] = React.useState(false)
  const closePanelTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  function openPanel(task: Task) {
    if (closePanelTimeout.current) clearTimeout(closePanelTimeout.current)
    setSelectedTask(task)
    setPanelOpen(true)
  }

  function closePanel() {
    setPanelOpen(false)
    closePanelTimeout.current = setTimeout(() => setSelectedTask(null), 200)
  }

  const { data: session } = authClient.useSession()
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
    onSuccess: (_, content) => {
      invalidate()
      sileo.success({
        title: "Tâche ajoutée",
        description: `"${content}" rejoint la liste. Elle ne va pas se faire toute seule… ou si ?`,
        fill: toastFill(),
      })
    },
    onError: (e: Error) => sileo.error({ title: "Aïe", description: e.message, fill: toastFill() }),
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => updateTask({ data: { id, completed: true } }),
    onSuccess: (_, id) => {
      const task = localTasksRef.current.find((t) => t.id === id)
      const descriptions = [
        "Un de moins sur la liste. Champion du monde.",
        "Terminée. La productivité, c'est ton truc.",
        "Coché. Dopamine débloquée.",
        "Done. Tu peux te vanter auprès de personne.",
        "Fini. On peut enfin passer à autre chose.",
      ]
      sileo.success({
        title: task ? `"${task.content}" ✓` : "Tâche terminée",
        description: descriptions[Math.floor(Math.random() * descriptions.length)],
        fill: toastFill(),
      })
      setTimeout(() => { removeLeaving(id); invalidate() }, 700)
    },
    onError: (e: Error, id) => {
      removeLeaving(id)
      sileo.error({ title: "Raté", description: e.message, fill: toastFill() })
    },
  })

  const uncompleteMutation = useMutation({
    mutationFn: (id: string) => updateTask({ data: { id, completed: false } }),
    onSuccess: (_, id) => {
      const task = localTasksRef.current.find((t) => t.id === id)
      sileo.success({
        title: "Retour en arrière",
        description: task ? `"${task.content}" ressuscite. Ça arrive aux meilleurs.` : "Pas de jugement ici.",
        fill: toastFill(),
      })
      setTimeout(() => { removeReturning(id); invalidate() }, 700)
    },
    onError: (e: Error, id) => {
      removeReturning(id)
      sileo.error({ title: "Raté", description: e.message, fill: toastFill() })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask({ data: { id } }),
    onSuccess: (_, id) => {
      const task = localTasksRef.current.find((t) => t.id === id)
      invalidate()
      sileo.success({
        title: "Supprimée",
        description: task ? `"${task.content}" n'a jamais existé. Chut.` : "Poof. Disparue.",
        fill: toastFill(),
      })
    },
    onError: (e: Error) => sileo.error({ title: "Raté", description: e.message, fill: toastFill() }),
  })

  const priorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: string }) =>
      updateTask({ data: { id, priority } }),
    onSuccess: (_, { priority }) => {
      invalidate()
      const labels: Record<string, string> = { urgent: "URGENT. Stress activé.", high: "Haute priorité. Sérieux maintenant.", medium: "Moyenne. Le juste milieu.", low: "Faible. Ça peut attendre… un peu.", none: "Sans priorité. La vie est belle." }
      sileo.success({
        title: "Priorité mise à jour",
        description: labels[priority] ?? "C'est noté.",
        fill: toastFill(),
      })
    },
    onError: (e: Error) => sileo.error({ title: "Raté", description: e.message, fill: toastFill() }),
  })

  const dateMutation = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: "startDate" | "dueDate"; value: string | null }) =>
      field === "startDate"
        ? updateTask({ data: { id, startDate: value } })
        : updateTask({ data: { id, dueDate: value } }),
    onSuccess: (_, { field, value }) => {
      invalidate()
      if (field === "startDate") {
        sileo.success({
          title: value ? "Date de début fixée" : "Date de début effacée",
          description: value ? "C'est officiel, ça commence." : "Libre comme l'air.",
          fill: toastFill(),
        })
      } else {
        sileo.success({
          title: value ? "Échéance fixée" : "Échéance effacée",
          description: value ? "Le compte à rebours est lancé. Bonne chance." : "L'urgence, c'est relatif.",
          fill: toastFill(),
        })
      }
    },
    onError: (e: Error) => sileo.error({ title: "Raté", description: e.message, fill: toastFill() }),
  })

  const reorderMutation = useMutation({
    mutationFn: (ordered: { id: string; position: number }[]) =>
      reorderTasks({ data: { tasks: ordered } }),
    onSuccess: invalidate,
    onError: (e: Error) => sileo.error({ title: "Raté", description: e.message, fill: toastFill() }),
  })

  const savePanelMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; note: string | null; priority: string; startDate: string | null; dueDate: string | null; attachments: string[]; links: string[] }) =>
      updateTask({ data: { id, note: data.note, priority: data.priority, startDate: data.startDate, dueDate: data.dueDate, attachments: data.attachments, links: data.links } }),
    onSuccess: () => {
      invalidate()
      sileo.success({
        title: "Modifications enregistrées",
        description: "Tout est bien noté. On vous fait confiance.",
        fill: toastFill(),
      })
    },
    onError: (e: Error) => sileo.error({ title: "Raté", description: e.message, fill: toastFill() }),
  })

  const convertMutation = useMutation({
    mutationFn: async ({ taskId, content, note, createdAt, dueDate }: ConvertState) => {
      const firstState = (team as { workflowStates: Array<{ id: string }> }).workflowStates[0]
      await createIssue({
        data: {
          teamId,
          title: content,
          description: note ?? undefined,
          projectId: selectedProjectId || undefined,
          workflowStateId: firstState?.id,
          assigneeId: session?.user.id,
          assignee: session?.user.name,
          startDate: createdAt,
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
      sileo.success({
        title: "Issue créée",
        description: "La tâche a grandi. Elle est maintenant une vraie issue.",
        fill: toastFill(),
      })
    },
    onError: (e: Error) => sileo.error({ title: "Raté", description: e.message, fill: toastFill() }),
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
              <TooltipTrigger
                onClick={() => setSortByPriority((v) => !v)}
                className={cn(
                  "inline-flex items-center justify-center size-7 rounded-md border transition-colors cursor-pointer",
                  sortByPriority
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {sortByPriority ? <ArrowUpNarrowWide className="size-3.5" /> : <ArrowUpDown className="size-3.5" />}
              </TooltipTrigger>
              <TooltipContent>
                {sortByPriority ? "Désactiver le tri par priorité" : "Trier par priorité"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                onClick={() => setSortByDate((v) => (v === "startDate" ? null : "startDate"))}
                className={cn(
                  "inline-flex items-center justify-center size-7 rounded-md border transition-colors cursor-pointer",
                  sortByDate === "startDate"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <CalendarDays className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>Trier par date de début</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                onClick={() => setSortByDate((v) => (v === "dueDate" ? null : "dueDate"))}
                className={cn(
                  "inline-flex items-center justify-center size-7 rounded-md border transition-colors cursor-pointer",
                  sortByDate === "dueDate"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <CalendarDays className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>Trier par échéance</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                onClick={() => setShowDoneInline((v) => !v)}
                className={cn(
                  "inline-flex items-center justify-center size-7 rounded-md border transition-colors cursor-pointer",
                  showDoneInline
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {showDoneInline ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
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

      <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-auto px-4 py-3" onClick={closePanel}>
        <div className="flex flex-col gap-0.5 max-w-3xl" onClick={(e) => e.stopPropagation()}>
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
                            onOpenDetails={() => openPanel(task)}
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
                            onConvert={() => setConvertState({ taskId: task.id, content: task.content, note: task.note, createdAt: String(task.createdAt), dueDate: task.dueDate ? String(task.dueDate) : null })}
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
            <div className="flex items-start gap-2.5 rounded-md px-1 py-1.5" onClick={closePanel}>
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
              <Select value={selectedProjectId} onValueChange={(v) => setSelectedProjectId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sans projet" />
                </SelectTrigger>
                <SelectContent side="bottom">
                  <SelectItem value="">Sans projet</SelectItem>
                  {(projects as Array<{ id: string; name: string }>).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="py-2 px-4">
            <Button
              onClick={() => convertState && convertMutation.mutate(convertState)}
              disabled={convertMutation.isPending}
            >
              Créer l'issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div
        className={cn(
          "shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out",
          panelOpen ? "w-96 border-l" : "w-0",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-96 h-full">
          {selectedTask && (
            <TaskDetailPanel
              task={selectedTask}
              onClose={closePanel}
              onSave={(data) => savePanelMutation.mutate({ id: selectedTask.id, ...data })}
              isSaving={savePanelMutation.isPending}
              onConvert={() => {
                closePanel()
                setConvertState({ taskId: selectedTask.id, content: selectedTask.content, note: selectedTask.note, createdAt: String(selectedTask.createdAt), dueDate: selectedTask.dueDate ? String(selectedTask.dueDate) : null })
              }}
              onDelete={() => {
                closePanel()
                deleteMutation.mutate(selectedTask.id)
              }}
            />
          )}
        </div>
      </div>

      </div>{/* end flex row */}
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
  onOpenDetails,
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
  onOpenDetails: () => void
}) {
  const priority = task.priority ? (DB_TO_PRIORITY[task.priority as DbPriority] ?? "NO_PRIORITY") : null
  const [menuOpen, setMenuOpen] = React.useState(false)
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
        "group flex items-center gap-2 rounded-md px-1 py-2.5 hover:bg-muted/50",
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
          "flex-1 text-sm transition-colors duration-150 cursor-pointer truncate whitespace-nowrap",
          isVisuallyCompleted && (showStrike || task.completed) && "line-through text-muted-foreground",
        )}
        onClick={onOpenDetails}
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

      <div className={cn("overflow-hidden transition-all duration-150 shrink-0", menuOpen ? "w-[22px]" : "w-0 group-hover:w-[22px]")}>
        <div className="w-[22px] flex items-center justify-center">
      <DropdownMenu onOpenChange={setMenuOpen}>
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

function TaskDetailPanel({
  task,
  onClose,
  onSave,
  isSaving,
  onConvert,
  onDelete,
}: {
  task: Task
  onClose: () => void
  onSave: (data: { note: string | null; priority: string; startDate: string | null; dueDate: string | null; attachments: string[]; links: string[] }) => void
  isSaving: boolean
  onConvert: () => void
  onDelete: () => void
}) {
  const [note, setNote] = React.useState(task.note ?? "")
  const [priority, setPriority] = React.useState(task.priority ?? "none")
  const [localStartDate, setLocalStartDate] = React.useState<Date | null>(
    task.startDate ? new Date(task.startDate) : null,
  )
  const [localDueDate, setLocalDueDate] = React.useState<Date | null>(
    task.dueDate ? new Date(task.dueDate) : null,
  )
  const [localAttachments, setLocalAttachments] = React.useState<string[]>(task.attachments ?? [])
  const [localLinks, setLocalLinks] = React.useState<string[]>(task.links ?? [])
  const [linkInput, setLinkInput] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setNote(task.note ?? "")
    setPriority(task.priority ?? "none")
    setLocalStartDate(task.startDate ? new Date(task.startDate) : null)
    setLocalDueDate(task.dueDate ? new Date(task.dueDate) : null)
    setLocalAttachments(task.attachments ?? [])
    setLocalLinks(task.links ?? [])
    setLinkInput('')
  }, [task.id])

  const today = startOfDay(new Date())
  const dueDateMin = localStartDate && startOfDay(localStartDate) > today ? startOfDay(localStartDate) : today

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        if (dataUrl) setLocalAttachments(prev => [...prev, dataUrl])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  function handleAddLink() {
    const trimmed = linkInput.trim()
    if (!trimmed) return
    const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
    setLocalLinks(prev => [...prev, url])
    setLinkInput('')
  }


  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 border-b">
        <p className="text-base font-semibold leading-snug">{task.content}</p>
        <div className="flex items-center shrink-0 gap-0.5 mt-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger className="p-0.5 rounded cursor-pointer text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              {!task.completed && (
                <DropdownMenuItem onClick={onConvert}>
                  <GitBranch className="size-4" />
                  Convertir en issue
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="size-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={onClose}
            className="p-0.5 rounded cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-20 shrink-0">Priorité</span>
          <div className="relative inline-flex h-7 items-center">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="h-7 appearance-none rounded-md border border-input bg-background pl-2.5 pr-7 text-xs outline-none hover:bg-muted cursor-pointer"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 size-3 text-muted-foreground" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-20 shrink-0">Début</span>
          <Popover>
            <PopoverTrigger className="h-7 rounded-md border border-input bg-background px-2.5 text-xs hover:bg-muted cursor-pointer inline-flex items-center gap-1.5">
              <Calendar className="size-3.5 text-muted-foreground" />
              {localStartDate ? (
                <span>{fmtDateBadge(localStartDate)}</span>
              ) : (
                <span className="text-muted-foreground/60">Non défini</span>
              )}
            </PopoverTrigger>
            <PopoverContent side="left" sideOffset={8} className="p-0 overflow-hidden w-auto">
              <DateSubPanel
                value={localStartDate}
                onSelect={setLocalStartDate}
                clearable={!!localStartDate}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-20 shrink-0">Échéance</span>
          <Popover>
            <PopoverTrigger className="h-7 rounded-md border border-input bg-background px-2.5 text-xs hover:bg-muted cursor-pointer inline-flex items-center gap-1.5">
              <Calendar className="size-3.5 text-muted-foreground" />
              {localDueDate ? (
                <span className={cn(
                  startOfDay(localDueDate).getTime() < today.getTime() ? "text-red-500 font-medium" : "",
                )}>
                  {fmtDateBadge(localDueDate)}
                </span>
              ) : (
                <span className="text-muted-foreground/60">Non défini</span>
              )}
            </PopoverTrigger>
            <PopoverContent side="left" sideOffset={8} className="p-0 overflow-hidden w-auto">
              <DateSubPanel
                value={localDueDate}
                onSelect={setLocalDueDate}
                minDate={dueDateMin}
                clearable={!!localDueDate}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <span className="text-xs text-muted-foreground">Liens</span>
          <div className="flex gap-1.5">
              <input
                type="url"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddLink()
                  }
                }}
                placeholder="https://..."
                className="flex-1 h-7 rounded-md border border-input bg-background px-2.5 text-xs outline-none focus:border-ring placeholder:text-muted-foreground/60"
              />
              <button
                onClick={handleAddLink}
                className="h-7 px-2 rounded-md border border-input bg-background text-xs hover:bg-muted transition-colors"
              >
                Ajouter
              </button>
            </div>
          {localLinks.map((link, i) => (
            <div key={i} className="flex items-center gap-1.5 group/link">
              <LinkIcon className="size-3 shrink-0 text-muted-foreground" />
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && window.__TAURI__) {
                    import('@tauri-apps/plugin-shell').then(({ open }) => open(link)).catch(() => window.open(link, '_blank'))
                  } else {
                    window.open(link, '_blank')
                  }
                }}
                className="flex-1 truncate text-left text-xs text-blue-500 hover:underline"
              >
                {link}
              </button>
              <button
                onClick={() => setLocalLinks(prev => prev.filter((_, j) => j !== i))}
                className="opacity-0 group-hover/link:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <span className="text-xs text-muted-foreground">Note</span>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ajouter une note…"
            className="min-h-32 resize-none text-sm"
          />
        </div>

        <div
          className="flex flex-col gap-2 pt-1"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
            files.forEach(file => {
              const reader = new FileReader()
              reader.onload = (ev) => {
                const dataUrl = ev.target?.result as string
                if (dataUrl) setLocalAttachments(prev => [...prev, dataUrl])
              }
              reader.readAsDataURL(file)
            })
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Photos</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Plus className="size-3" />
              Ajouter
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          {localAttachments.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {localAttachments.map((src, i) => (
                <div key={i} className="relative group/photo aspect-square">
                  <img src={src} alt="" className="w-full h-full object-cover rounded-md" />
                  <button
                    onClick={() => setLocalAttachments(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-0.5 right-0.5 size-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <div className="border-t px-4 py-3">
        <Button
          size="sm"
          onClick={() => {
            onSave({
              note: note.trim() || null,
              priority,
              startDate: localStartDate ? localStartDate.toISOString() : null,
              dueDate: localDueDate ? localDueDate.toISOString() : null,
              attachments: localAttachments,
              links: localLinks,
            })
          }}
          disabled={isSaving}
          className="w-full"
        >
          {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  )
}
