import * as React from "react"
import { Edit2, Copy, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "#/components/ui/table"
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

const PAGE_SIZE = 20

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

interface ProjectTableProps {
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

function ProjectTableRow({
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

  const createdAt = new Date(project.createdAt)
  const formattedDate = createdAt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => onSelect ? onSelect(project) : onEdit(project)}
      >
        {/* Name */}
        <TableCell>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <span className="font-medium">{project.name}</span>
          </div>
        </TableCell>

        {/* Key */}
        <TableCell>
          <Badge variant="outline" className="font-mono text-xs">
            {project.key}
          </Badge>
        </TableCell>

        {/* Status */}
        <TableCell>
          <Badge
            variant={statusBadgeVariant(project.status)}
            className="capitalize"
          >
            {project.status}
          </Badge>
        </TableCell>

        {/* Issues */}
        <TableCell className="text-muted-foreground">
          {project._count.issues}
        </TableCell>

        {/* Date */}
        <TableCell className="text-muted-foreground text-xs">
          {formattedDate}
        </TableCell>

        {/* Actions */}
        <TableCell
          onClick={(e) => e.stopPropagation()}
          className="text-right"
        >
          <ActionsMenu
            actions={actions}
            className="rounded-md p-1 hover:bg-muted"
          />
        </TableCell>
      </TableRow>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => onDelete(project.id)}
      />
    </>
  )
}

function ProjectTable({
  projects,
  onEdit,
  onDelete,
  onDuplicate,
  onSelect,
}: ProjectTableProps) {
  const [page, setPage] = React.useState(1)

  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  const paginated = projects.slice(start, end)

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
    <div className="flex flex-col gap-2 p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Issues</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.map((project) => (
            <ProjectTableRow
              key={project.id}
              project={project}
              onEdit={onEdit}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onSelect={onSelect}
            />
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
          <span>
            {start + 1}–{Math.min(end, projects.length)} of {projects.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-1">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export { ProjectTable }
