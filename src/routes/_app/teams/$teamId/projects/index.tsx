import * as React from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { Plus, Search } from "lucide-react"
import { sileo } from "sileo"
import { Button } from "#/components/ui/button"
import { ProjectCard } from "#/components/projects/ProjectCard"
import { ProjectDialog } from "#/components/projects/ProjectDialog"
import {
  projectsQueryOptions,
  deleteProject,
  duplicateProject,
} from "#/server/projects"
import { cn } from "#/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "active" | "completed" | "canceled"

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

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_app/teams/$teamId/projects/")({
  validateSearch: z.object({
    status: z
      .enum(["all", "active", "completed", "canceled"])
      .optional()
      .default("all"),
  }),
  loader: async ({ context, params }) => {
    const { queryClient } = context as {
      queryClient: { ensureQueryData: (opts: unknown) => Promise<unknown> }
    }
    return queryClient.ensureQueryData(projectsQueryOptions(params.teamId))
  },
  pendingComponent: () => (
    <div className="p-4 text-muted-foreground">Loading projects…</div>
  ),
  component: ProjectsPage,
})

// ─── StatusTabs ───────────────────────────────────────────────────────────────

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actif" },
  { value: "completed", label: "Terminé" },
]

function StatusTabs({
  value,
  onChange,
}: {
  value: StatusFilter
  onChange: (v: StatusFilter) => void
}) {
  return (
    <div className="flex rounded-md border p-0.5 gap-0.5">
      {STATUS_TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "px-2.5 py-1 text-xs rounded capitalize transition-colors cursor-pointer",
            value === tab.value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ─── ProjectsPage ─────────────────────────────────────────────────────────────

function ProjectsPage() {
  const { teamId } = Route.useParams()
  const { status } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()

  const { data: projects } = useSuspenseQuery(projectsQueryOptions(teamId))

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editProject, setEditProject] = React.useState<Project | null>(null)
  const [search, setSearch] = React.useState("")

  // ── Filtered projects ──────────────────────────────────────────────────────
  const filteredProjects = React.useMemo(() => {
    let list = projects as Project[]
    if (status !== "all") list = list.filter((p) => p.status.toLowerCase() === status)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }
    return list
  }, [projects, status, search])

  // ── Delete mutation (optimistic) ───────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => deleteProject({ data: { projectId } }),
    onMutate: async (projectId) => {
      await queryClient.cancelQueries({
        queryKey: projectsQueryOptions(teamId).queryKey,
      })
      const prev = queryClient.getQueryData(
        projectsQueryOptions(teamId).queryKey
      )
      queryClient.setQueryData(
        projectsQueryOptions(teamId).queryKey,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => old?.filter((p: any) => p.id !== projectId) ?? []
      )
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      queryClient.setQueryData(
        projectsQueryOptions(teamId).queryKey,
        ctx?.prev
      )
      sileo.error({
        title: "Raté",
        description: "Le projet refuse de mourir. Réessayez.",
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: projectsQueryOptions(teamId).queryKey,
      })
    },
    onSuccess: () => {
      sileo.success({
        title: "Projet supprimé",
        description: "Et voilà. Comme s'il n'avait jamais existé.",
      })
    },
  })

  // ── Duplicate mutation ─────────────────────────────────────────────────────
  const duplicateMutation = useMutation({
    mutationFn: (projectId: string) =>
      duplicateProject({ data: { projectId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: projectsQueryOptions(teamId).queryKey,
      })
      sileo.success({
        title: "Projet dupliqué",
        description: "Le clone est parmi nous. On espère qu'il se comportera bien.",
      })
    },
    onError: () => {
      sileo.error({
        title: "Raté",
        description: "La duplication a échoué. Le projet est unique, apparemment.",
      })
    },
  })

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleDelete = (projectId: string) => {
    deleteMutation.mutate(projectId)
  }

  const handleDuplicate = (projectId: string) => {
    duplicateMutation.mutate(projectId)
  }

  const handleEdit = (project: Project) => {
    setEditProject(project)
  }

  const handleSelect = (project: Project) => {
    void navigate({ to: "/teams/$teamId/projects/$projectId", params: { teamId, projectId: project.id } })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b gap-2">
        <h1 className="text-lg font-semibold">Projects</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 w-44 rounded-lg border border-input bg-transparent pl-8 pr-3 text-sm outline-none focus:border-ring focus:w-56 transition-all placeholder:text-muted-foreground"
            />
          </div>
          <StatusTabs
            value={status as StatusFilter}
            onChange={(s) =>
              navigate({ search: (prev) => ({ ...prev, status: s }) })
            }
          />
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouveau
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {filteredProjects.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">
              {search ? "Aucun projet ne correspond à votre recherche." : "Aucun projet. Créez votre premier projet."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <ProjectDialog
        mode="create"
        teamId={teamId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      {/* Edit dialog */}
      {editProject && (
        <ProjectDialog
          mode="edit"
          teamId={teamId}
          project={editProject}
          open={!!editProject}
          onOpenChange={(open) => !open && setEditProject(null)}
        />
      )}
    </div>
  )
}
