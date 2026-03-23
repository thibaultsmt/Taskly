import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sileo } from "sileo"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "#/components/ui/dialog"
import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"
import { Textarea } from "#/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select"
import { cn } from "#/lib/utils"
import {
  createProject,
  updateProject,
  projectsQueryOptions,
} from "#/server/projects"

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#14b8a6",
  "#6366f1",
  "#f43f5e",
  "#84cc16",
]

type ProjectStatus = "active" | "completed" | "canceled"

interface Project {
  id: string
  name: string
  key: string
  description: string | null
  color: string
  status: string
}

interface ProjectDialogProps {
  mode: "create" | "edit"
  teamId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project
}

function ProjectDialog({
  mode,
  teamId,
  open,
  onOpenChange,
  project,
}: ProjectDialogProps) {
  const queryClient = useQueryClient()

  const [name, setName] = React.useState(project?.name ?? "")
  const [key, setKey] = React.useState(project?.key ?? "")
  const [description, setDescription] = React.useState(
    project?.description ?? ""
  )
  const [color, setColor] = React.useState(project?.color ?? COLORS[4])
  const [status, setStatus] = React.useState<ProjectStatus>(
    (project?.status as ProjectStatus) ?? "active"
  )
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // Reset form when dialog opens/closes or project changes
  React.useEffect(() => {
    if (open) {
      setName(project?.name ?? "")
      setKey(project?.key ?? "")
      setDescription(project?.description ?? "")
      setColor(project?.color ?? COLORS[4])
      setStatus((project?.status as ProjectStatus) ?? "active")
      setErrors({})
    }
  }, [open, project])

  // Auto-generate key from name (first 3 letters uppercase)
  const handleNameChange = (value: string) => {
    setName(value)
    if (mode === "create" || !project?.key) {
      const autoKey = value
        .replace(/[^a-zA-Z]/g, "")
        .slice(0, 3)
        .toUpperCase()
      setKey(autoKey)
    }
  }

  const handleKeyChange = (value: string) => {
    setKey(value.toUpperCase().slice(0, 3))
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters"
    }
    if (key.length !== 3) {
      newErrors.key = "Key must be exactly 3 characters"
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const createMutation = useMutation({
    mutationFn: (data: {
      teamId: string
      name: string
      key: string
      description?: string
      color?: string
    }) => createProject({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: projectsQueryOptions(teamId).queryKey,
      })
      sileo.success({
        title: "Projet créé",
        description: "Un nouveau projet. Les ambitions sont infinies, le temps un peu moins.",
      })
      onOpenChange(false)
    },
    onError: (error: Error) => {
      if (
        error.message.toLowerCase().includes("unique") ||
        error.message.toLowerCase().includes("duplicate")
      ) {
        setErrors({ key: "This key is already used in this team" })
      } else {
        sileo.error({
          title: "Raté",
          description: "Le projet n'a pas pu être créé. Dommage.",
        })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: {
      projectId: string
      name?: string
      description?: string
      status?: string
      color?: string
    }) => updateProject({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: projectsQueryOptions(teamId).queryKey,
      })
      sileo.success({
        title: "Projet mis à jour",
        description: "Peaufiné. La perfection, c'est un processus.",
      })
      onOpenChange(false)
    },
    onError: () => {
      sileo.error({
        title: "Raté",
        description: "La mise à jour a échoué. Le projet résiste au changement.",
      })
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    if (mode === "create") {
      createMutation.mutate({
        teamId,
        name: name.trim(),
        key,
        description: description.trim() || undefined,
        color,
      })
    } else if (project) {
      updateMutation.mutate({
        projectId: project.id,
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        color,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New Project" : "Edit Project"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Project"
              aria-invalid={!!errors.name}
              disabled={isPending}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Key{" "}
              <span className="text-muted-foreground font-normal">
                (3 characters)
              </span>
            </label>
            <Input
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder="PRJ"
              maxLength={3}
              aria-invalid={!!errors.key}
              disabled={isPending || mode === "edit"}
              className="uppercase"
            />
            {errors.key && (
              <p className="text-xs text-destructive">{errors.key}</p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Description{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              disabled={isPending}
            />
          </div>

          {/* Color picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Color</label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  style={{ backgroundColor: c }}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                    color === c
                      ? "border-foreground scale-110"
                      : "border-transparent"
                  )}
                  onClick={() => setColor(c)}
                  disabled={isPending}
                />
              ))}
            </div>
          </div>

          {/* Status — edit only */}
          {mode === "edit" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as ProjectStatus)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? mode === "create"
                  ? "Creating…"
                  : "Saving…"
                : mode === "create"
                  ? "Create"
                  : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { ProjectDialog }
