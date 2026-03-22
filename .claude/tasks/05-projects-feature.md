# Agent 5 — Projects Feature (Rebuild complet)

## Contexte
Reconstruire la page Projects complète avec 2 vues (list, table), dialogs CRUD, et actions sur les projets.

## Fichiers à créer/modifier

### `src/routes/_app/teams/$teamId/projects/index.tsx` — REFAIRE

```tsx
export const Route = createFileRoute("/_app/teams/$teamId/projects/")({
  validateSearch: z.object({
    view: z.enum(["list", "table"]).optional().default("list"),
    status: z.enum(["active", "completed", "canceled", "all"]).optional().default("active"),
  }),
  loader: async ({ context: { queryClient }, params: { teamId } }) =>
    queryClient.ensureQueryData(projectsQueryOptions(teamId)),
  component: ProjectsPage,
})

function ProjectsPage() {
  const { teamId } = Route.useParams()
  const { view, status } = Route.useSearch()
  const navigate = useNavigate()

  const { data: projects } = useSuspenseQuery(projectsQueryOptions(teamId))
  const [createOpen, setCreateOpen] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)

  const filteredProjects = useMemo(() =>
    status === "all" ? projects : projects.filter(p => p.status.toLowerCase() === status),
    [projects, status]
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-lg font-semibold">Projects</h1>
        <div className="flex items-center gap-2">
          {/* Status filter tabs */}
          <StatusTabs value={status} onChange={s => navigate({ search: old => ({ ...old, status: s }) })} />
          {/* View switcher: list only (pas board) */}
          <ViewSwitcher
            currentView={view}
            available={["list", "table"]}
            onChange={v => navigate({ search: old => ({ ...old, view: v }) })}
          />
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Project
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {view === "list" && (
          <ProjectList
            projects={filteredProjects}
            onEdit={setEditProject}
            onDelete={...}
            onDuplicate={...}
          />
        )}
        {view === "table" && (
          <ProjectTable
            projects={filteredProjects}
            onEdit={setEditProject}
            onDelete={...}
            onDuplicate={...}
          />
        )}
      </div>

      <ProjectDialog
        mode="create"
        teamId={teamId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      {editProject && (
        <ProjectDialog
          mode="edit"
          project={editProject}
          teamId={teamId}
          open={!!editProject}
          onOpenChange={open => !open && setEditProject(null)}
        />
      )}
    </div>
  )
}
```

### `src/components/projects/ProjectList.tsx`

```tsx
// Liste de projets avec actions
// Props: projects, onEdit, onDelete, onDuplicate
// Chaque ligne:
//   - Point coloré (project.color)
//   - Nom du projet (cliquable)
//   - Badge status (active=green, completed=gray, canceled=red)
//   - Key badge (ex: "ENG")
//   - Count d'issues (_count.issues)
//   - ActionsMenu: Edit, Duplicate, Archive/Unarchive, Delete
// Grouped par status si view="all"
// Empty state: "No projects yet. Create your first project."
```

### `src/components/projects/ProjectTable.tsx`

```tsx
// Table view pour les projets
// Colonnes: Name, Key, Status, Issues count, Created, Actions
// Chaque ligne cliquable → onEdit
// ActionsMenu sur chaque ligne: Edit, Duplicate, Archive, Delete
// Tri sur les colonnes
// Pagination: 20 par page
```

### `src/components/projects/ProjectDialog.tsx`

```tsx
// Dialog create/edit pour les projets
// Props: mode, project?, teamId, open, onOpenChange
// Champs:
//   - name (Input, required, min 2)
//   - key (Input, 3 caractères majuscules, auto-générés depuis le nom)
//     → auto-fill: prendre les 3 premières lettres du nom en majuscules
//   - description (Textarea, optionnel)
//   - color (ColorPicker: palette de 12 couleurs prédéfinies)
//     couleurs: rouge, orange, jaune, vert, bleu, violet, rose, cyan, etc.
//   - status (Select: active, completed, canceled) — mode edit seulement

// ColorPicker inline:
//   <div className="flex gap-1 flex-wrap">
//     {COLORS.map(color => (
//       <button
//         key={color}
//         style={{ backgroundColor: color }}
//         className={cn("h-6 w-6 rounded-full border-2", selected === color ? "border-foreground" : "border-transparent")}
//         onClick={() => setColor(color)}
//       />
//     ))}
//   </div>

// Mutations:
//   create → createProject + invalidate
//   edit → updateProject + invalidate

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4",
  "#14b8a6", "#6366f1", "#f43f5e", "#84cc16"
]
```

## Mutations

```ts
const createMutation = useMutation({
  mutationFn: (data) => createProject({ data }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["projects", teamId] })
    onOpenChange(false)
    toast.success("Project created")
  },
})

const deleteMutation = useMutation({
  mutationFn: (projectId) => deleteProject({ data: { projectId } }),
  onMutate: async (projectId) => {
    await queryClient.cancelQueries({ queryKey: ["projects", teamId] })
    const prev = queryClient.getQueryData(["projects", teamId])
    queryClient.setQueryData(["projects", teamId], old => old.filter(p => p.id !== projectId))
    return { prev }
  },
  onError: (_, __, ctx) => queryClient.setQueryData(["projects", teamId], ctx.prev),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["projects", teamId] }),
})

const duplicateMutation = useMutation({
  mutationFn: (projectId) => duplicateProject({ data: { projectId } }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", teamId] }),
})
```

## StatusTabs component (inline dans la page)

```tsx
// Tabs simples: All | Active | Completed | Canceled
// Styled comme des pills/badges
// Active tab: fond opaque
function StatusTabs({ value, onChange }) {
  const tabs = ["all", "active", "completed", "canceled"]
  return (
    <div className="flex rounded-md border p-0.5 gap-0.5">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn("px-2.5 py-1 text-sm rounded capitalize", value === tab ? "bg-accent" : "hover:bg-muted")}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}
```

## Résultat attendu
- Projects page 100% fonctionnelle
- Vues list et table
- Filtres par status (tabs)
- Dialog create/edit avec color picker et key auto-fill
- Actions: edit, delete (avec confirm dialog), duplicate
- Optimistic updates pour delete
- Empty states
- Toasts de confirmation via sonner
