import * as React from "react"
import { Edit2, Copy, Trash2 } from "lucide-react"
import { Badge } from "#/components/ui/badge"
import { Button } from "#/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "#/components/ui/dialog"
import { ActionsMenu } from "#/components/shared/actions-menu"

interface Project {
  id: string
  name: string
  key: string
  description: string | null
  color: string
  status: string
  createdAt: string | Date
  _count: { issues: number }
}

interface ProjectListProps {
  projects: Project[]
  onEdit: (project: Project) => void
  onDelete: (projectId: string) => void
  onDuplicate: (projectId: string) => void
  onSelect?: (project: Project) => void
}

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toLowerCase()) {
    case "active":
      return "default"
    case "completed":
      return "secondary"
    case "canceled":
      return "destructive"
    default:
      return "outline"
  }
}

function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Delete this project? This action is irreversible.
        </p>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProjectListItem({
  project,
  onEdit,
  onDelete,
  onDuplicate,
  onSelect,
}: {
  project: Project
  onEdit: (project: Project) => void
  onDelete: (projectId: string) => void
  onDuplicate: (projectId: string) => void
  onSelect?: (project: Project) => void
}) {
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  const actions = [
    {
      label: "Edit",
      icon: Edit2,
      onClick: () => onEdit(project),
    },
    {
      label: "Duplicate",
      icon: Copy,
      onClick: () => onDuplicate(project.id),
    },
    {
      label: "Delete",
      icon: Trash2,
      onClick: () => setDeleteOpen(true),
      variant: "destructive" as const,
      separator: true,
    },
  ]

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/30 transition-colors">
        {/* Color dot */}
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: project.color }}
        />

        {/* Name */}
        <button
          className="flex-1 text-left text-sm font-medium hover:underline cursor-pointer"
          onClick={() => onSelect ? onSelect(project) : onEdit(project)}
        >
          {project.name}
        </button>

        {/* Key badge */}
        <Badge variant="outline" className="font-mono text-xs">
          {project.key}
        </Badge>

        {/* Status badge */}
        <Badge
          variant={statusBadgeVariant(project.status)}
          className="capitalize"
        >
          {project.status}
        </Badge>

        {/* Issues count */}
        <span className="text-xs text-muted-foreground w-16 text-right">
          {project._count.issues}{" "}
          {project._count.issues === 1 ? "issue" : "issues"}
        </span>

        {/* Actions */}
        <ActionsMenu actions={actions} className="ml-1 rounded-md p-1 hover:bg-muted" />
      </div>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => onDelete(project.id)}
      />
    </>
  )
}

function ProjectList({
  projects,
  onEdit,
  onDelete,
  onDuplicate,
  onSelect,
}: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No projects yet. Create your first project.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 p-4">
      {projects.map((project) => (
        <ProjectListItem
          key={project.id}
          project={project}
          onEdit={onEdit}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

export { ProjectList, type Project as ProjectType }
