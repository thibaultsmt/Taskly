import * as React from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { Plus, Search, ChevronDown } from "lucide-react"
import { sileo } from "sileo"
import { issuesQueryOptions, deleteIssue } from "#/server/issues"
import { teamQueryOptions } from "#/server/teams"
import { Button } from "#/components/ui/button"
import { FilterBar, type Filters } from "#/components/shared/filter-bar"
import { ViewSwitcher } from "#/components/shared/view-switcher"
import { IssueList } from "#/components/issues/IssueList"
import { IssueFlatList } from "#/components/issues/IssueFlatList"
import { IssueDialog } from "#/components/issues/IssueDialog"
import { IssueDetailModal } from "#/components/issues/IssueDetailModal"

// ─── Types ───────────────────────────────────────────────────────────────────

interface IssueLabel {
  id: string
  labelId: string
  label: { id: string; name: string; color: string }
}

interface Issue {
  id: string
  title: string
  description?: string | null
  number: number
  priority: string
  assignee?: string | null
  workflowStateId: string
  workflowState?: { id: string; name: string; type: string; color: string; position: number } | null
  projectId?: string | null
  project?: { id: string; name: string } | null
  labels?: IssueLabel[]
  estimate?: number | null
  startDate?: Date | string | null
  dueDate?: Date | string | null
  createdAt: Date | string
}

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_app/teams/$teamId/issues/")({
  validateSearch: z.object({
    view: z.enum(["list", "by-status"]).optional().default("list"),
    status: z.array(z.string()).optional(),
    priority: z.array(z.string()).optional(),
    assignee: z.array(z.string()).optional(),
    project: z.array(z.string()).optional(),
    label: z.array(z.string()).optional(),
    sort: z.string().optional(),
    dir: z.enum(["asc", "desc"]).optional(),
  }).catch({ view: "list" }),
  loader: async ({ context, params }) => {
    const { queryClient } = context as {
      queryClient: { ensureQueryData: (opts: unknown) => Promise<unknown> }
    }
    await Promise.all([
      queryClient.ensureQueryData(issuesQueryOptions(params.teamId)),
      queryClient.ensureQueryData(teamQueryOptions(params.teamId)),
    ])
  },
  pendingComponent: () => <div className="p-4 text-muted-foreground">Chargement des issues…</div>,
  errorComponent: ({ error }) => (
    <div className="p-4 text-destructive">Erreur : {(error as Error).message}</div>
  ),
  component: IssuesPage,
})

// ─── Sort helpers ────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 4, high: 3, medium: 2, low: 1, none: 0,
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

function filterIssues(
  issues: Issue[],
  search: {
    status?: string[]
    priority?: string[]
    assignee?: string[]
    project?: string[]
    label?: string[]
  },
): Issue[] {
  return issues.filter((issue) => {
    if (search.status?.length) {
      if (!search.status.includes(issue.workflowStateId)) return false
    }
    if (search.priority?.length) {
      if (!search.priority.includes(issue.priority)) return false
    }
    if (search.assignee?.length) {
      const name = issue.assignee ?? ""
      if (!search.assignee.includes(name)) return false
    }
    if (search.project?.length) {
      const pid = issue.projectId ?? ""
      if (!search.project.includes(pid)) return false
    }
    if (search.label?.length) {
      const issueLabels = issue.labels?.map((il) => il.labelId) ?? []
      const hasMatch = search.label.some((lid) => issueLabels.includes(lid))
      if (!hasMatch) return false
    }
    return true
  })
}

// ─── Page component ───────────────────────────────────────────────────────────

function IssuesPage() {
  const { teamId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()

  const { data: issues } = useSuspenseQuery(issuesQueryOptions(teamId))
  const { data: team } = useSuspenseQuery(teamQueryOptions(teamId))

  const [createOpen, setCreateOpen] = React.useState(false)
  const [viewIssue, setViewIssue] = React.useState<Issue | null>(null)
  const [editIssue, setEditIssue] = React.useState<Issue | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Current view (default to "list")
  const currentView = search.view ?? "list"

  // Build FilterBar-compatible filters from URL search params
  const filters: Filters = {
    workflowStateIds: search.status,
    priorities: search.priority as Filters["priorities"],
    assigneeIds: search.assignee,
    projectIds: search.project,
    labelIds: search.label,
  }

  function updateFilters(next: Filters) {
    navigate({
      search: (prev) => ({
        ...prev,
        status: next.workflowStateIds?.length ? next.workflowStateIds : undefined,
        priority: next.priorities?.length ? (next.priorities as string[]) : undefined,
        assignee: next.assigneeIds?.length ? next.assigneeIds : undefined,
        project: next.projectIds?.length ? next.projectIds : undefined,
        label: next.labelIds?.length ? next.labelIds : undefined,
      }),
    })
  }

  // Filtered + sorted issues (client-side)
  const filteredIssues = React.useMemo(() => {
    let list = filterIssues(issues as Issue[], search)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (i) => i.title.toLowerCase().includes(q) || String(i.number).includes(q),
      )
    }
    const sort = search.sort ?? "number"
    const dir = search.dir ?? "desc"
    list.sort((a, b) => {
      let cmp = 0
      switch (sort) {
        case "number": cmp = a.number - b.number; break
        case "priority": cmp = (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0); break
        case "startDate": {
          const aT = a.startDate ? new Date(a.startDate as string).getTime() : (dir === "asc" ? Infinity : -Infinity)
          const bT = b.startDate ? new Date(b.startDate as string).getTime() : (dir === "asc" ? Infinity : -Infinity)
          cmp = aT - bT; break
        }
        case "dueDate": {
          const aT = a.dueDate ? new Date(a.dueDate as string).getTime() : (dir === "asc" ? Infinity : -Infinity)
          const bT = b.dueDate ? new Date(b.dueDate as string).getTime() : (dir === "asc" ? Infinity : -Infinity)
          cmp = aT - bT; break
        }
      }
      return dir === "asc" ? cmp : -cmp
    })
    return list
  }, [issues, search, searchQuery])

  function toastFill() {
    return document.documentElement.classList.contains("dark") ? "#1a1a1a" : "#f9f9f9"
  }

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (issueId: string) => deleteIssue({ data: { issueId } }),
    onSuccess: () => {
      sileo.success({
        title: "Issue supprimée",
        description: "Elle retourne au néant d'où elle vient. Repose en paix.",
        fill: toastFill(),
      })
    },
    onError: (e: Error) => {
      sileo.error({
        title: "Raté",
        description: e.message,
        fill: toastFill(),
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: issuesQueryOptions(teamId).queryKey })
    },
  })

  // Build members list for FilterBar (name-based assignee filter)
  const filterMembers = team.members.map((m) => ({
    id: m.userName,
    name: m.userName,
    email: m.userEmail,
    image: m.image ?? null,
  }))

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Issues</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-44 rounded-lg border border-input bg-transparent pl-8 pr-3 text-sm outline-none focus:border-ring focus:w-56 transition-all placeholder:text-muted-foreground"
            />
          </div>
          <div className="relative inline-flex h-7 items-center">
            <select
              value={`${search.sort ?? "number"}:${search.dir ?? "desc"}`}
              onChange={(e) => {
                const [s, d] = e.target.value.split(":")
                navigate({ search: (prev) => ({ ...prev, sort: s, dir: d as "asc" | "desc" }) })
              }}
              className="h-7 appearance-none rounded-md border border-input bg-background pl-2.5 pr-7 text-xs outline-none hover:bg-muted cursor-pointer"
            >
              <option value="number:desc">Par numéro</option>
              <option value="priority:desc">Par priorité</option>
              <option value="startDate:asc">Date de début ↑</option>
              <option value="startDate:desc">Date de début ↓</option>
              <option value="dueDate:asc">Échéance ↑</option>
              <option value="dueDate:desc">Échéance ↓</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 size-3 text-muted-foreground" />
          </div>
          <FilterBar
            filters={filters}
            onFilterChange={updateFilters}
            workflowStates={currentView === "by-status" ? undefined : team.workflowStates}
            labels={team.labels}
            members={filterMembers}
            projects={team.projects}
          />
          <ViewSwitcher
            currentView={currentView}
            available={["list", "by-status"]}
            onChange={(v) =>
              navigate({ search: (prev) => ({ ...prev, view: v as "list" | "by-status" }) })
            }
          />
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Nouvelle issue
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {currentView === "list" && (
          <IssueFlatList
            issues={filteredIssues}
            team={team}
            onEdit={(issue) => setEditIssue(issue as Issue)}
            onDelete={(id) => deleteMutation.mutate(id)}
            onView={(issue) => setViewIssue(issue as Issue)}
          />
        )}

        {currentView === "by-status" && (
          <IssueList
            issues={filteredIssues}
            states={team.workflowStates}
            team={team}
            onEdit={(issue) => setEditIssue(issue as Issue)}
            onDelete={(id) => deleteMutation.mutate(id)}
            onView={(issue) => setViewIssue(issue as Issue)}
          />
        )}
      </div>

      <IssueDialog
        mode="create"
        teamId={teamId}
        team={team}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <IssueDetailModal
        issue={viewIssue}
        team={team}
        open={!!viewIssue}
        onOpenChange={(open) => { if (!open) setViewIssue(null) }}
        onEdit={(issue) => { setViewIssue(null); setEditIssue(issue) }}
      />

      {editIssue && (
        <IssueDialog
          mode="edit"
          issue={editIssue}
          teamId={teamId}
          team={team}
          open={!!editIssue}
          onOpenChange={(open) => { if (!open) setEditIssue(null) }}
        />
      )}
    </div>
  )
}
