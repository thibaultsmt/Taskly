import * as React from "react"
import { Edit2, Copy, MoreHorizontal, Trash2 } from "lucide-react"
import { cn } from "#/lib/utils"
import { Badge } from "#/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "#/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu"
import { Button } from "#/components/ui/button"

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

interface ProjectCardProps {
  project: Project
  onEdit: (project: Project) => void
  onDelete: (projectId: string) => void
  onDuplicate: (projectId: string) => void
  onSelect?: (project: Project) => void
}

function statusBadgeVariant(
  status: string,
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
          <DialogTitle>Supprimer le projet</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Cette action est irréversible.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProjectCard({ project, onEdit, onDelete, onDuplicate, onSelect }: ProjectCardProps) {
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)

  const actions = [
    { label: "Modifier", icon: Edit2, onClick: () => onEdit(project) },
    { label: "Dupliquer", icon: Copy, onClick: () => onDuplicate(project.id) },
    {
      label: "Supprimer",
      icon: Trash2,
      onClick: () => setDeleteOpen(true),
      variant: "destructive" as const,
      separator: true,
    },
  ]

  return (
    <>
      <div
        className="group flex rounded-xl border bg-card overflow-hidden cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => (onSelect ? onSelect(project) : onEdit(project))}
      >
        {/* Color accent bar */}
        <div className="w-1 shrink-0" style={{ backgroundColor: project.color }} />

        <div className="flex flex-col flex-1 p-4 gap-3 min-w-0">
          {/* Top row: name + status + actions */}
          <div className="flex items-center gap-2">
            <span className="flex-1 min-w-0 truncate font-semibold text-sm leading-snug">
              {project.name}
            </span>
            <Badge
              variant={statusBadgeVariant(project.status)}
              className="capitalize text-xs cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {project.status}
              <div className={cn("overflow-hidden transition-all duration-150", menuOpen ? "w-[16px]" : "w-0 group-hover:w-[16px]")}>
                <DropdownMenu onOpenChange={setMenuOpen}>
                  <DropdownMenuTrigger className="w-[16px] flex items-center justify-center cursor-pointer">
                    <MoreHorizontal className="size-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {actions.map((action, i) => (
                      <span key={i}>
                        {action.separator && i > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                          variant={action.variant === "destructive" ? "destructive" : "default"}
                          onClick={(e) => { e.stopPropagation(); action.onClick() }}
                        >
                          <action.icon className="size-4" />
                          {action.label}
                        </DropdownMenuItem>
                      </span>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Badge>
          </div>

          {/* Description */}
          {project.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {project.description}
            </p>
          )}

          {/* Footer: key + count */}
          <div className="flex items-center gap-2 flex-wrap mt-auto pt-1">
            <Badge variant="outline" className="font-mono text-xs">
              {project.key}
            </Badge>
            <span className="ml-auto text-xs text-muted-foreground">
              {project._count.issues} issue{project._count.issues !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => onDelete(project.id)}
      />
    </>
  )
}

export { ProjectCard }
export type { Project as ProjectCardType }
