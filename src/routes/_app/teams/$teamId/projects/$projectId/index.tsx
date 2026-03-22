import * as React from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { Plus, ArrowLeft, ChevronDown } from "lucide-react"
import { issuesQueryOptions, updateIssue, deleteIssue } from "#/server/issues"
import { projectsQueryOptions } from "#/server/projects"
import { teamQueryOptions } from "#/server/teams"
import { projectWorkflowStatesQueryOptions } from "#/server/workflow-states"
import { Button } from "#/components/ui/button"
import { ViewSwitcher, type View } from "#/components/shared/view-switcher"
import { IssueBoard } from "#/components/issues/IssueBoard"
import { IssueTable } from "#/components/issues/IssueTable"
import { IssueDialog } from "#/components/issues/IssueDialog"
import { IssueDetailModal } from "#/components/issues/IssueDetailModal"
import { FilterBar, type Filters, type DbPriority } from "#/components/shared/filter-bar"

// Types
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

export const Route = createFileRoute("/_app/teams/$teamId/projects/$projectId/")({
  validateSearch: z.object({
    view: z.enum(["board", "table"]).optional().default("board"),
  }).catch({ view: "board" }),
  loader: async ({ context, params }) => {
    const { queryClient } = context as { queryClient: { ensureQueryData: (opts: unknown) => Promise<unknown> } }
    await Promise.all([
      queryClient.ensureQueryData(teamQueryOptions(params.teamId)),
      queryClient.ensureQueryData(issuesQueryOptions(params.teamId)),
      queryClient.ensureQueryData(projectsQueryOptions(params.teamId)),
      queryClient.ensureQueryData(projectWorkflowStatesQueryOptions(params.teamId, params.projectId)),
    ])
  },
  pendingComponent: () => <div className="p-4 text-muted-foreground">Loading…</div>,
  component: ProjectDetailPage,
})

function ProjectDetailPage() {
  const { teamId, projectId } = Route.useParams()
  const { view } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()

  const { data: team } = useSuspenseQuery(teamQueryOptions(teamId))
  const { data: allIssues } = useSuspenseQuery(issuesQueryOptions(teamId))
  const { data: projects } = useSuspenseQuery(projectsQueryOptions(teamId))
  const { data: projectStates } = useSuspenseQuery(projectWorkflowStatesQueryOptions(teamId, projectId))

  const project = (projects as Array<{ id: string; name: string; color: string }>).find(
    (p) => p.id === projectId,
  )

  const projectIssues = React.useMemo(
    () => (allIssues as Issue[]).filter((i) => i.projectId === projectId),
    [allIssues, projectId],
  )

  const [filters, setFilters] = React.useState<Filters>({})
  const [sortBy, setSortBy] = React.useState<"none" | "startDate" | "dueDate">("none")
  const [addOpen, setAddOpen] = React.useState(false)
  const [viewIssue, setViewIssue] = React.useState<Issue | null>(null)
  const [editIssue, setEditIssue] = React.useState<Issue | null>(null)

  const filterMembers = (team.members as Array<{ userName: string; userEmail: string; image?: string | null }>).map((m) => ({
    id: m.userName,
    name: m.userName,
    email: m.userEmail,
    image: m.image ?? null,
  }))

  const filteredIssues = React.useMemo(() => {
    return projectIssues.filter((issue) => {
      if (filters.priorities?.length && !filters.priorities.includes(issue.priority as DbPriority)) return false
      if (filters.assigneeIds?.length) {
        const name = issue.assignee ?? ""
        if (!filters.assigneeIds.includes(name)) return false
      }
      return true
    })
  }, [projectIssues, filters])

  const sortedIssues = React.useMemo(() => {
    if (sortBy === "none") return filteredIssues
    return [...filteredIssues].sort((a, b) => {
      const aT = a[sortBy] ? new Date(a[sortBy] as string).getTime() : Infinity
      const bT = b[sortBy] ? new Date(b[sortBy] as string).getTime() : Infinity
      return aT - bT
    })
  }, [filteredIssues, sortBy])

  const moveMutation = useMutation({
    mutationFn: ({ issueId, workflowStateId }: { issueId: string; workflowStateId: string }) =>
      updateIssue({ data: { issueId, workflowStateId } }),
    onMutate: async ({ issueId, workflowStateId }) => {
      await queryClient.cancelQueries({ queryKey: issuesQueryOptions(teamId).queryKey })
      const prev = queryClient.getQueryData(issuesQueryOptions(teamId).queryKey)
      queryClient.setQueryData(
        issuesQueryOptions(teamId).queryKey,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => old?.map((i: any) => (i.id === issueId ? { ...i, workflowStateId } : i)) ?? [],
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(issuesQueryOptions(teamId).queryKey, ctx.prev)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: issuesQueryOptions(teamId).queryKey }),
  })

  const deleteMutation = useMutation({
    mutationFn: (issueId: string) => deleteIssue({ data: { issueId } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: issuesQueryOptions(teamId).queryKey }),
  })

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/teams/$teamId/projects"
            params={{ teamId }}
            className="!text-foreground hover:opacity-70 transition-opacity"
          >
            <ArrowLeft className="size-4" />
          </Link>
          {project && (
            <span
              className="size-3 rounded-full shrink-0"
              style={{ backgroundColor: project.color }}
            />
          )}
          <h1 className="text-lg font-semibold">{project?.name ?? "Project"}</h1>
          <span className="text-sm text-muted-foreground">({projectIssues.length})</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterBar
            filters={filters}
            onFilterChange={setFilters}
            members={filterMembers}
          />
          <div className="relative inline-flex h-7 items-center">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "none" | "startDate" | "dueDate")}
              className="h-7 appearance-none rounded-md border border-input bg-background pl-2.5 pr-7 text-xs outline-none hover:bg-muted cursor-pointer"
            >
              <option value="none">Trier par…</option>
              <option value="startDate">Date de début ↑</option>
              <option value="dueDate">Échéance ↑</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 size-3 text-muted-foreground" />
          </div>
          <ViewSwitcher
            currentView={view as View}
            available={["board", "table"]}
            onChange={(v) =>
              navigate({ search: (prev) => ({ ...prev, view: v as "board" | "table" }) })
            }
          />
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add issues
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {view === "board" && (
          <IssueBoard
            issues={sortedIssues}
            states={projectStates}
            team={team}
            teamId={teamId}
            projectId={projectId}
            onEdit={(issue) => setEditIssue(issue as Issue)}
            onDelete={(issueId) => deleteMutation.mutate(issueId)}
            onView={(issue) => setViewIssue(issue as Issue)}
            onMove={(issueId, workflowStateId) => moveMutation.mutate({ issueId, workflowStateId })}
          />
        )}
        {view === "table" && (
          <IssueTable
            issues={sortedIssues}
            team={team}
            onEdit={(issue) => setEditIssue(issue as Issue)}
            onView={(issue) => setViewIssue(issue as Issue)}
          />
        )}
      </div>

      <IssueDialog
        mode="create"
        teamId={teamId}
        team={team}
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultProjectId={projectId}
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
