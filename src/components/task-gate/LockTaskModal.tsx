import { useState, useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createTask, tasksQueryOptions } from "#/server/tasks"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "#/components/ui/dialog"
import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"
import { Badge } from "#/components/ui/badge"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
}

export function LockTaskModal({ open, onOpenChange, teamId }: Props) {
  const [input, setInput] = useState("")
  const [tasks, setTasks] = useState<string[]>([])
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (content: string) => createTask({ data: { teamId, content } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tasksQueryOptions(teamId).queryKey })
    },
  })

  const addTask = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed) return
    if (tasks.includes(trimmed)) return
    setTasks((prev) => [...prev, trimmed])
    setInput("")
  }, [input, tasks])

  const removeTask = useCallback((index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index))
  }, [])

  async function emitConfirmLock() {
    if (typeof window !== "undefined" && window.__TAURI__) {
      const { emit } = await import("@tauri-apps/api/event")
      await emit("confirm-lock", {})
    }
    onOpenChange(false)
    setTasks([])
    setInput("")
  }

  const handleCreateAndLock = useCallback(async () => {
    const pending = [...tasks]
    const trimmed = input.trim()
    if (trimmed && !pending.includes(trimmed)) pending.push(trimmed)
    if (pending.length > 0) {
      await Promise.all(pending.map((t) => mutation.mutateAsync(t)))
    }
    await emitConfirmLock()
  }, [tasks, input, mutation])

  const handleLockOnly = useCallback(async () => {
    await emitConfirmLock()
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Avant de verrouiller…</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <p className="text-sm text-muted-foreground">
            Note tes tâches avant de partir (optionnel).
          </p>

          {tasks.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tasks.map((task, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="cursor-pointer text-sm"
                  onClick={() => removeTask(i)}
                >
                  {task} ✕
                </Badge>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addTask()
                }
              }}
              placeholder="Nouvelle tâche…"
              autoFocus
              className="flex-1"
            />
            <Button variant="outline" type="button" onClick={addTask}>
              +
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {tasks.length === 0
              ? "Appuie sur Entrée pour ajouter"
              : `${tasks.length} tâche${tasks.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleLockOnly}
            disabled={mutation.isPending}
          >
            Verrouiller quand même
          </Button>
          <Button
            onClick={() => void handleCreateAndLock()}
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? "…"
              : tasks.length > 0
                ? `Créer ${tasks.length} tâche${tasks.length > 1 ? "s" : ""} et verrouiller`
                : "Verrouiller"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
