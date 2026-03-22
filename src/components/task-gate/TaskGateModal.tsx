import { useState, useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createDailyTask } from "../../server/daily-tasks"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Badge } from "../ui/badge"

interface Props {
  onComplete: () => void
}

export function TaskGateModal({ onComplete }: Props) {
  const [input, setInput] = useState("")
  const [tasks, setTasks] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (content: string) => createDailyTask({ data: { content } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["daily-tasks"] })
    },
  })

  const addTask = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed) return
    if (tasks.includes(trimmed)) {
      setError("Cette tâche est déjà dans la liste")
      return
    }
    setTasks((prev) => [...prev, trimmed])
    setInput("")
    setError(null)
  }, [input, tasks])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addTask()
    }
  }

  const handleSubmit = async () => {
    if (tasks.length === 0) {
      setError("Ajoute au moins une tâche pour continuer")
      return
    }
    await Promise.all(tasks.map((t) => mutation.mutateAsync(t)))
    onComplete()
  }

  const removeTask = (index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-2xl">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">Bienvenue 👋</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <p className="mt-3 text-base text-foreground">Quelles sont tes tâches du jour ?</p>
        </div>

        {tasks.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
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
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex : Terminer le rapport Q2…"
            className="flex-1"
          />
          <Button variant="outline" onClick={addTask} type="button">
            +
          </Button>
        </div>

        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {tasks.length === 0
              ? "Au moins 1 tâche requise"
              : `${tasks.length} tâche${tasks.length > 1 ? "s" : ""}`}
          </p>
          <Button
            onClick={() => void handleSubmit()}
            disabled={tasks.length === 0 || mutation.isPending}
            className="min-w-[120px]"
          >
            {mutation.isPending ? "Sauvegarde…" : "Commencer →"}
          </Button>
        </div>
      </div>
    </div>
  )
}
