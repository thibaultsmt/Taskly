import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sileo } from "sileo"
import { Plus, Pencil, Trash2, Check, X } from "lucide-react"
import {
  workflowStatesQueryOptions,
  createWorkflowState,
  updateWorkflowState,
  deleteWorkflowState,
} from "#/server/workflow-states"
import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"

export const Route = createFileRoute("/_app/teams/$teamId/statuts/")({
  loader: ({ context, params }) => {
    const qc = (context as { queryClient: { ensureQueryData: (opts: unknown) => unknown } }).queryClient
    return qc.ensureQueryData(workflowStatesQueryOptions(params.teamId))
  },
  component: StatutsPage,
})

type WorkflowState = {
  id: string
  name: string
  type: string
  color: string
  position: number
  teamId: string
}

function StatutsPage() {
  const { teamId } = Route.useParams()
  const queryClient = useQueryClient()
  const { data: states } = useSuspenseQuery(workflowStatesQueryOptions(teamId))

  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState("")
  const [editColor, setEditColor] = React.useState("")

  const [newName, setNewName] = React.useState("")
  const [newColor, setNewColor] = React.useState("#6b7280")
  const [showNew, setShowNew] = React.useState(false)

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; name: string; color: string }) =>
      updateWorkflowState({ data: vars }),
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["workflow-states", teamId] })
      setEditingId(null)
      sileo.success({
        title: "Statut mis à jour",
        description: `"${vars.name}" fait peau neuve. On espère que personne n'était trop attaché à l'ancien.`,
      })
    },
    onError: (e: Error) => sileo.error({ title: "Raté", description: e.message }),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createWorkflowState({ data: { teamId, name: newName.trim(), color: newColor } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workflow-states", teamId] })
      setNewName("")
      setNewColor("#6b7280")
      setShowNew(false)
      sileo.success({
        title: "Statut créé",
        description: `"${newName.trim()}" est dans la place. Les issues ont hâte de l'utiliser.`,
      })
    },
    onError: (e: Error) => sileo.error({ title: "Raté", description: e.message }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWorkflowState({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workflow-states", teamId] })
      sileo.success({
        title: "Statut supprimé",
        description: "Disparu. Les issues orphelines pleurent en silence.",
      })
    },
    onError: (e: Error) => sileo.error({ title: "Raté", description: e.message }),
  })

  function startEdit(state: WorkflowState) {
    setEditingId(state.id)
    setEditName(state.name)
    setEditColor(state.color)
  }

  function submitEdit() {
    if (editingId && editName.trim()) {
      updateMutation.mutate({ id: editingId, name: editName.trim(), color: editColor })
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h1 className="text-lg font-semibold">Statuts</h1>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus className="size-4" />
          Nouveau statut
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6 max-w-2xl space-y-4">
        <div className="flex flex-col gap-1">
          {(states as WorkflowState[]).map((state) => (
            <div
              key={state.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50"
            >
              {editingId === state.id ? (
                <>
                  <label className="size-4 shrink-0 cursor-pointer rounded-full" style={{ backgroundColor: editColor }}>
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="sr-only"
                    />
                  </label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitEdit()
                      if (e.key === "Escape") setEditingId(null)
                    }}
                    className="h-7 flex-1 text-sm"
                    autoFocus
                  />
                  <Button variant="ghost" size="icon-sm" onClick={submitEdit} disabled={updateMutation.isPending}>
                    <Check className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditingId(null)}>
                    <X className="size-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: state.color }}
                  />
                  <span className="flex-1 text-sm font-medium">{state.name}</span>
                  <Button variant="ghost" size="icon-sm" onClick={() => startEdit(state)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(state.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        {showNew && (
          <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
            <label className="size-4 shrink-0 cursor-pointer rounded-full" style={{ backgroundColor: newColor }}>
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="sr-only"
              />
            </label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) createMutation.mutate()
                if (e.key === "Escape") setShowNew(false)
              }}
              placeholder="Nom du statut"
              className="h-7 flex-1 text-sm"
              autoFocus
            />
            <Button variant="ghost" size="icon-sm" onClick={() => createMutation.mutate()} disabled={!newName.trim() || createMutation.isPending}>
              <Check className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setShowNew(false)}>
              <X className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
