import { X, SlidersHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuItem,
} from "#/components/ui/dropdown-menu"
import { cn } from "#/lib/utils"
import { PriorityIcon, type Priority } from "#/components/shared/priority-icon"
import { UserAvatar } from "#/components/shared/user-avatar"

type DbPriority = "none" | "low" | "medium" | "high" | "urgent"

const DB_TO_PRIORITY: Record<DbPriority, Priority> = {
  none: "NO_PRIORITY",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  urgent: "URGENT",
}

interface Filters {
  workflowStateIds?: string[]
  priorities?: DbPriority[]
  assigneeIds?: string[]
  projectIds?: string[]
  labelIds?: string[]
  search?: string
}

interface WorkflowState {
  id: string
  name: string
  type: string
  color: string
}

interface Label {
  id: string
  name: string
  color: string
}

interface Member {
  id: string
  name: string
  email: string
  image?: string | null
}

interface Project {
  id: string
  name: string
}

interface FilterBarProps {
  filters: Filters
  onFilterChange: (filters: Filters) => void
  workflowStates?: WorkflowState[]
  labels?: Label[]
  members?: Member[]
  projects?: Project[]
}

const PRIORITIES: { value: DbPriority; label: string }[] = [
  { value: "none", label: "Sans priorité" },
  { value: "low", label: "Faible" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Haute" },
  { value: "urgent", label: "Urgente" },
]

function countActiveFilters(filters: Filters): number {
  let count = 0
  if (filters.workflowStateIds?.length) count++
  if (filters.priorities?.length) count++
  if (filters.assigneeIds?.length) count++
  if (filters.projectIds?.length) count++
  if (filters.labelIds?.length) count++
  return count
}

function toggle<T>(arr: T[] | undefined, value: T): T[] {
  if (!arr) return [value]
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

function CountBadge({ n }: { n: number }) {
  return (
    <span
      className={cn(
        "overflow-hidden transition-[width,opacity] duration-150 shrink-0 inline-flex",
        n > 0 ? "w-4 opacity-100" : "w-0 opacity-0",
      )}
    >
      <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
        {n}
      </span>
    </span>
  )
}

function FilterBar({
  filters,
  onFilterChange,
  workflowStates,
  labels,
  members,
  projects,
}: FilterBarProps) {
  const activeCount = countActiveFilters(filters)

  function clearAll() {
    onFilterChange({
      workflowStateIds: [],
      priorities: [],
      assigneeIds: [],
      projectIds: [],
      labelIds: [],
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <span
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs transition-colors hover:bg-muted cursor-pointer",
            activeCount > 0 && "border-primary/40 bg-primary/5 text-primary",
          )}
        >
          <SlidersHorizontal className="size-3" />
          Filtres
          <CountBadge n={activeCount} />
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[200px]">

        {workflowStates && workflowStates.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="flex-1">Statut</span>
              <CountBadge n={filters.workflowStateIds?.length ?? 0} />
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent sideOffset={10}>
              {workflowStates.map((state) => (
                <DropdownMenuCheckboxItem
                  key={state.id}
                  checked={filters.workflowStateIds?.includes(state.id)}
                  onCheckedChange={() =>
                    onFilterChange({
                      ...filters,
                      workflowStateIds: toggle(filters.workflowStateIds, state.id),
                    })
                  }
                >
                  <span className="flex items-center justify-between gap-4 w-full">
                    <span>{state.name}</span>
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: state.color }} />
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <span className="flex-1">Priorité</span>
            <CountBadge n={filters.priorities?.length ?? 0} />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent sideOffset={10}>
            {PRIORITIES.map((p) => (
              <DropdownMenuCheckboxItem
                key={p.value}
                checked={filters.priorities?.includes(p.value)}
                onCheckedChange={() =>
                  onFilterChange({
                    ...filters,
                    priorities: toggle(filters.priorities, p.value),
                  })
                }
              >
                <span className="flex items-center justify-between gap-4 w-full">
                  <span>{p.label}</span>
                  <PriorityIcon priority={DB_TO_PRIORITY[p.value]} />
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {members && members.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="flex-1">Assigné</span>
              <CountBadge n={filters.assigneeIds?.length ?? 0} />
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent sideOffset={10}>
              {members.map((member) => (
                <DropdownMenuCheckboxItem
                  key={member.id}
                  checked={filters.assigneeIds?.includes(member.id)}
                  onCheckedChange={() =>
                    onFilterChange({
                      ...filters,
                      assigneeIds: toggle(filters.assigneeIds, member.id),
                    })
                  }
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <UserAvatar name={member.name} image={member.image ?? undefined} size="sm" />
                    <span className="truncate max-w-[140px]">{member.name}</span>
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {projects && projects.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="flex-1">Projet</span>
              <CountBadge n={filters.projectIds?.length ?? 0} />
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent sideOffset={10}>
              {projects.map((project) => (
                <DropdownMenuCheckboxItem
                  key={project.id}
                  checked={filters.projectIds?.includes(project.id)}
                  onCheckedChange={() =>
                    onFilterChange({
                      ...filters,
                      projectIds: toggle(filters.projectIds, project.id),
                    })
                  }
                >
                  {project.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {labels && labels.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="flex-1">Label</span>
              <CountBadge n={filters.labelIds?.length ?? 0} />
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent sideOffset={10}>
              {labels.map((label) => (
                <DropdownMenuCheckboxItem
                  key={label.id}
                  checked={filters.labelIds?.includes(label.id)}
                  onCheckedChange={() =>
                    onFilterChange({
                      ...filters,
                      labelIds: toggle(filters.labelIds, label.id),
                    })
                  }
                >
                  <span className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: label.color }} />
                    {label.name}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {activeCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={clearAll}>
              <X className="size-4" />
              Effacer les filtres
            </DropdownMenuItem>
          </>
        )}

      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { FilterBar, type Filters, type DbPriority }
