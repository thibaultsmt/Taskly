import { X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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

function FilterButton({
  label,
  count,
}: {
  label: string
  count?: number
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md border border-input bg-background px-2.5 text-xs transition-colors hover:bg-muted cursor-pointer"
      )}
    >
      {label}
      {count ? (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
          {count}
        </span>
      ) : null}
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
    <div className="flex flex-wrap items-center gap-2">

      {workflowStates && workflowStates.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger>
            <FilterButton label="Status" count={filters.workflowStateIds?.length} />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-[180px] w-auto">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
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
                className="w-full"
              >
                <span className="flex items-center justify-between gap-4 w-full">
                  <span>{state.name}</span>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: state.color }} />
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger>
          <FilterButton label="Priorité" count={filters.priorities?.length} />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[180px] w-auto">
          <DropdownMenuLabel>Priorité</DropdownMenuLabel>
          <DropdownMenuSeparator />
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
              className="w-full"
            >
              <span className="flex items-center justify-between gap-4 w-full">
                <span>{p.label}</span>
                <PriorityIcon priority={DB_TO_PRIORITY[p.value]} />
              </span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {members && members.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger>
            <FilterButton label="Assigné" count={filters.assigneeIds?.length} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Assigné</DropdownMenuLabel>
            <DropdownMenuSeparator />
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
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {projects && projects.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger>
            <FilterButton label="Projet" count={filters.projectIds?.length} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Projet</DropdownMenuLabel>
            <DropdownMenuSeparator />
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
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {labels && labels.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger>
            <FilterButton label="Label" count={filters.labelIds?.length} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Label</DropdownMenuLabel>
            <DropdownMenuSeparator />
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
                <span
                  className="mr-1 inline-block size-2 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                {label.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {activeCount > 0 && (
        <button
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
          onClick={clearAll}
        >
          <X className="size-3" />
          Clear
        </button>
      )}
    </div>
  )
}

export { FilterBar, type Filters, type DbPriority }
