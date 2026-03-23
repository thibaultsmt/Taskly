import * as React from "react"
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, GripVertical } from "lucide-react"
import { IssueCard } from "#/components/issues/IssueCard"
import { StatusBadge } from "#/components/shared/status-badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "#/components/ui/dialog"
import { Button } from "#/components/ui/button"
import {
  createWorkflowState,
  updateWorkflowState,
  deleteWorkflowState,
  reorderWorkflowStates,
  projectWorkflowStatesQueryOptions,
} from "#/server/workflow-states"
import { teamQueryOptions } from "#/server/teams"
import type { WorkflowStateType } from "#/components/shared/status-badge"

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkflowState {
  id: string
  name: string
  type: string
  color: string
  position: number
}

interface IssueLabel {
  id: string
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
  labels?: IssueLabel[]
  project?: { name: string } | null
  dueDate?: Date | string | null
}

interface Team {
  key: string
}

interface IssueBoardProps {
  issues: Issue[]
  states: WorkflowState[]
  team: Team
  teamId: string
  projectId?: string
  onEdit: (issue: Issue) => void
  onDelete?: (issueId: string) => void
  onView?: (issue: Issue) => void
  onMove: (issueId: string, workflowStateId: string) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  "#94a3b8", "#6b7280", "#3b82f6", "#22c55e", "#ef4444",
  "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#14b8a6",
]

// ─── StateFormDialog ──────────────────────────────────────────────────────────

function StateFormDialog({
  open,
  onOpenChange,
  initial,
  teamId,
  projectId,
  mode,
  issueCount = 0,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial?: { id: string; name: string; color: string; projectId?: string | null }
  teamId: string
  projectId?: string
  mode: "create" | "edit"
  issueCount?: number
}) {
  const queryClient = useQueryClient()
  const [name, setName] = React.useState(initial?.name ?? "")
  const [color, setColor] = React.useState(initial?.color ?? "#6b7280")

  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? "")
      setColor(initial?.color ?? "#6b7280")
    }
  }, [open, initial?.name, initial?.color])

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: teamQueryOptions(teamId).queryKey })
    if (projectId) {
      queryClient.invalidateQueries({
        queryKey: projectWorkflowStatesQueryOptions(teamId, projectId).queryKey,
      })
    }
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createWorkflowState({ data: { teamId, name: name.trim(), color, projectId } }),
    onSuccess: () => { invalidate(); onOpenChange(false) },
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      updateWorkflowState({ data: { id: initial!.id, name: name.trim(), color } }),
    onSuccess: () => { invalidate(); onOpenChange(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkflowState({ data: { id: initial!.id } }),
    onSuccess: () => { invalidate(); onOpenChange(false) },
  })

  function submit() {
    if (mode === "create" && name.trim()) createMutation.mutate()
    else if (mode === "edit" && name.trim()) updateMutation.mutate()
  }

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm gap-4">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nouveau statut" : "Modifier le statut"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <input
            autoFocus
            type="text"
            placeholder="Nom du statut…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit() }}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring"
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Couleur</span>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="size-6 rounded-full transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `2px solid ${c}` : "none",
                    outlineOffset: 2,
                  }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>

        {mode === "edit" && issueCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {issueCount} issue{issueCount > 1 ? "s" : ""} sera{issueCount > 1 ? "ont" : ""} déplacée{issueCount > 1 ? "s" : ""} vers le statut suivant.
          </p>
        )}

        <DialogFooter>
          {mode === "edit" && (
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={isPending}
            >
              Supprimer
            </Button>
          )}
          <Button disabled={!name.trim() || isPending} onClick={submit}>
            {mode === "create" ? "Créer" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── AddStateColumn ───────────────────────────────────────────────────────────

function AddStateColumn({ teamId, projectId }: { teamId: string; projectId?: string }) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <div
        className="flex min-w-[280px] max-w-[280px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 cursor-pointer hover:border-muted-foreground/40 hover:bg-muted/10 transition-colors"
        onClick={() => setOpen(true)}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Plus className="size-6" />
          <span className="text-sm">Nouveau statut</span>
        </div>
      </div>
      <StateFormDialog
        open={open}
        onOpenChange={setOpen}
        teamId={teamId}
        projectId={projectId}
        mode="create"
      />
    </>
  )
}

// ─── ColumnHeader ─────────────────────────────────────────────────────────────

function ColumnHeader({
  state,
  count,
  teamId,
  projectId,
  dragHandleProps,
}: {
  state: WorkflowState
  count: number
  teamId: string
  projectId?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragHandleProps: any
}) {
  const [editOpen, setEditOpen] = React.useState(false)

  return (
    <>
      <div className="flex items-center justify-between border-b px-3 py-2.5 gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span
            {...dragHandleProps}
            className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="size-3.5" />
          </span>
          <button className="min-w-0 truncate cursor-pointer" onClick={() => setEditOpen(true)}>
            <StatusBadge
              type={state.type as WorkflowStateType}
              name={state.name}
              color={state.color}
              className="text-sm font-medium"
            />
          </button>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{count}</span>
      </div>

      <StateFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={{ id: state.id, name: state.name, color: state.color }}
        teamId={teamId}
        projectId={projectId}
        mode="edit"
        issueCount={count}
      />
    </>
  )
}

// ─── IssueBoard ───────────────────────────────────────────────────────────────

function IssueBoard({ issues, states, team, teamId, projectId, onEdit, onDelete, onView, onMove }: IssueBoardProps) {
  const queryClient = useQueryClient()
  const [localStates, setLocalStates] = React.useState(states)

  React.useEffect(() => {
    setLocalStates(states)
  }, [states])

  const sortedStates = [...localStates].sort((a, b) => a.position - b.position)

  const grouped = React.useMemo(() => {
    const map = new Map<string, Issue[]>()
    for (const state of sortedStates) map.set(state.id, [])
    for (const issue of issues) {
      const existing = map.get(issue.workflowStateId)
      if (existing) {
        existing.push(issue)
      } else {
        const fallback = map.get(sortedStates[0]?.id ?? "")
        if (fallback) fallback.push(issue)
      }
    }
    return map
  }, [issues, sortedStates])

  const reorderMutation = useMutation({
    mutationFn: (ordered: { id: string; position: number }[]) =>
      reorderWorkflowStates({ data: { states: ordered } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: teamQueryOptions(teamId).queryKey }),
  })

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return

    if (result.type === "COLUMN") {
      const newOrder = [...sortedStates]
      const [removed] = newOrder.splice(result.source.index, 1)
      newOrder.splice(result.destination.index, 0, removed)
      const reordered = newOrder.map((s, i) => ({ ...s, position: i }))
      setLocalStates(reordered)
      reorderMutation.mutate(reordered.map((s) => ({ id: s.id, position: s.position })))
      return
    }

    const { draggableId, destination } = result
    const newStateId = destination.droppableId
    const issue = issues.find((i) => i.id === draggableId)
    if (!issue || issue.workflowStateId === newStateId) return
    onMove(draggableId, newStateId)
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="board" direction="horizontal" type="COLUMN">
        {(boardProvided) => (
          <div
            ref={boardProvided.innerRef}
            {...boardProvided.droppableProps}
            className="flex h-full gap-4 overflow-x-auto p-4"
          >
            {sortedStates.map((state, index) => {
              const columnIssues = grouped.get(state.id) ?? []

              return (
                <Draggable key={state.id} draggableId={state.id} index={index}>
                  {(colProvided) => (
                    <div
                      ref={colProvided.innerRef}
                      {...colProvided.draggableProps}
                      className="flex min-w-[280px] max-w-[280px] flex-col rounded-xl border bg-muted/20"
                    >
                      <ColumnHeader
                        state={state}
                        count={columnIssues.length}
                        teamId={teamId}
                        projectId={projectId}
                        dragHandleProps={colProvided.dragHandleProps}
                      />

                      <Droppable droppableId={state.id} type="ISSUE">
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors ${
                              snapshot.isDraggingOver ? "bg-primary/5" : ""
                            }`}
                            style={{ minHeight: 80 }}
                          >
                            {columnIssues.map((issue, i) => (
                              <Draggable key={issue.id} draggableId={issue.id} index={i}>
                                {(dragProvided, dragSnapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                  >
                                    <IssueCard
                                      issue={issue}
                                      teamKey={team.key}
                                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                      onEdit={onEdit as any}
                                      onDelete={onDelete}
                                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                      onView={onView as any}
                                      isDragging={dragSnapshot.isDragging}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                            {columnIssues.length === 0 && !snapshot.isDraggingOver && (
                              <div className="flex flex-1 items-center justify-center py-8 text-xs text-muted-foreground">
                                Aucune issue
                              </div>
                            )}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )}
                </Draggable>
              )
            })}

            {boardProvided.placeholder}

            <AddStateColumn teamId={teamId} projectId={projectId} />
          </div>
        )}
      </Droppable>
    </DragDropContext>
  )
}

export { IssueBoard }
