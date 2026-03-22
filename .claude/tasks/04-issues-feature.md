# Agent 4 — Issues Feature (Rebuild complet)

## Contexte
Reconstruire la page Issues complète avec 3 vues (list, board, table), filtres, tri, et dialogs CRUD.

## Fichiers à créer/modifier

### `src/routes/_app/teams/$teamId/issues/index.tsx` — REFAIRE

```tsx
export const Route = createFileRoute("/_app/teams/$teamId/issues/")({
  validateSearch: z.object({
    view: z.enum(["list", "board", "table"]).optional().default("list"),
    // Filtres dans l'URL
    status: z.array(z.string()).optional(),
    priority: z.array(z.string()).optional(),
    assignee: z.array(z.string()).optional(),
    project: z.array(z.string()).optional(),
    label: z.array(z.string()).optional(),
    sort: z.string().optional(),
    dir: z.enum(["asc", "desc"]).optional(),
  }),
  loader: async ({ context: { queryClient }, params: { teamId } }) => {
    await Promise.all([
      queryClient.ensureQueryData(issuesQueryOptions(teamId)),
      queryClient.ensureQueryData(teamQueryOptions(teamId)),  // workflowStates, labels, members
    ])
  },
  component: IssuesPage,
})

function IssuesPage() {
  const { teamId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()

  const { data: issues } = useSuspenseQuery(issuesQueryOptions(teamId))
  const { data: team } = useSuspenseQuery(teamQueryOptions(teamId))

  const [createOpen, setCreateOpen] = useState(false)
  const [editIssue, setEditIssue] = useState<Issue | null>(null)

  // Filtrer les issues côté client selon search params
  const filteredIssues = useMemo(() => filterIssues(issues, search), [issues, search])

  return (
    <div className="flex flex-col h-full">
      {/* Header: titre + bouton New Issue + view switcher + filters */}
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-lg font-semibold">Issues</h1>
        <div className="flex items-center gap-2">
          <FilterBar filters={search} onChange={updateSearch} team={team} />
          <ViewSwitcher currentView={search.view} onChange={v => navigate({ search: s => ({ ...s, view: v }) })} />
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Issue
          </Button>
        </div>
      </div>

      {/* Contenu selon la vue */}
      <div className="flex-1 overflow-auto">
        {search.view === "list" && <IssueList issues={filteredIssues} states={team.workflowStates} onEdit={setEditIssue} />}
        {search.view === "board" && <IssueBoard issues={filteredIssues} states={team.workflowStates} onEdit={setEditIssue} teamId={teamId} />}
        {search.view === "table" && <IssueTable issues={filteredIssues} onEdit={setEditIssue} />}
      </div>

      {/* Dialogs */}
      <IssueDialog
        mode="create"
        teamId={teamId}
        team={team}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      {editIssue && (
        <IssueDialog
          mode="edit"
          issue={editIssue}
          teamId={teamId}
          team={team}
          open={!!editIssue}
          onOpenChange={open => !open && setEditIssue(null)}
        />
      )}
    </div>
  )
}
```

### `src/components/issues/IssueList.tsx`

```tsx
// Groupé par workflowState
// Props: issues, workflowStates, onEdit, onDelete
// Chaque groupe: header avec StatusBadge + count + bouton collapse
// Chaque issue: une ligne avec:
//   - PriorityIcon
//   - Numéro de l'issue (ENG-42)
//   - Titre (cliquable → onEdit)
//   - StatusBadge
//   - AssigneeAvatar (tooltip)
//   - Labels (LabelBadge x N, max 2 + "+N more")
//   - ActionsMenu (edit, delete)
// Hover: afficher ActionsMenu
// Empty state si aucune issue dans le groupe
```

### `src/components/issues/IssueBoard.tsx`

```tsx
// Kanban board
// Props: issues, workflowStates, teamId, onEdit
// Utiliser @hello-pangea/dnd (à installer: npm i @hello-pangea/dnd)
// Une colonne par workflowState (scroll horizontal si trop large)
// Header de colonne: StatusBadge + count
// Chaque carte: IssueCard
// Drop → updateIssue({ workflowStateId: newStateId }) avec optimistic update

// IMPORTANT: les colonnes ont un max-h et scroll vertical indépendant
// Width: min-w-[280px] par colonne
```

### `src/components/issues/IssueCard.tsx`

```tsx
// Carte pour le board kanban
// Props: issue, onEdit
// Affiche: ID, titre, PriorityIcon, AssigneeAvatar, LabelBadge[]
// Clickable → onEdit
// Loading state (overlay spinner) pendant drag/mutation optimiste
// Taille: padding confortable, ombre légère, hover slightly raised
```

### `src/components/issues/IssueTable.tsx`

```tsx
// Vue table avec colonnes triables
// Colonnes: #, Titre, Status, Priorité, Projet, Assigné, Labels, Date
// Cliquer sur une ligne → onEdit
// Cliquer sur header colonne → toggle sort (asc/desc)
// Indicateur de tri sur la colonne active
// Pagination: 20 issues par page
// Utiliser <Table> de shadcn/ui
```

### `src/components/issues/IssueDialog.tsx`

```tsx
// Dialog multi-mode: "create" | "edit"
// Props: mode, issue?, teamId, team, open, onOpenChange
// Champs:
//   - title (Input, required)
//   - description (Textarea, optionnel)
//   - project (Select avec projets de l'équipe)
//   - workflowState (Select avec états)
//   - priority (Select: NO_PRIORITY, LOW, MEDIUM, HIGH, URGENT)
//   - assignee (UserSelector)
//   - labels (multi-select via Command/Popover)
//   - estimate (Input number, optionnel)
// Validation zod: title requis, longueur max
// Mode create: bouton "Create" + checkbox "Create more"
// Mode edit: bouton "Save changes"
// Mutations:
//   create → createIssue + invalidate issues query
//   edit → updateIssue + invalidate
// Optimistic updates pour les mutations
```

## Mutations à utiliser (via useMutation)

```ts
// Créer une issue
const createMutation = useMutation({
  mutationFn: (data) => createIssue({ data }),
  onMutate: async (newIssue) => {
    await queryClient.cancelQueries({ queryKey: ["issues", teamId] })
    const prev = queryClient.getQueryData(["issues", teamId])
    queryClient.setQueryData(["issues", teamId], old => [...old, { ...newIssue, id: "temp", isOptimistic: true }])
    return { prev }
  },
  onError: (_, __, ctx) => queryClient.setQueryData(["issues", teamId], ctx.prev),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["issues", teamId] }),
})

// Drag & drop sur le board
const moveMutation = useMutation({
  mutationFn: ({ issueId, workflowStateId }) => updateIssue({ data: { issueId, workflowStateId } }),
  onMutate: async ({ issueId, workflowStateId }) => {
    await queryClient.cancelQueries({ queryKey: ["issues", teamId] })
    const prev = queryClient.getQueryData(["issues", teamId])
    queryClient.setQueryData(["issues", teamId], old =>
      old.map(i => i.id === issueId ? { ...i, workflowStateId } : i)
    )
    return { prev }
  },
  onError: (_, __, ctx) => queryClient.setQueryData(["issues", teamId], ctx.prev),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["issues", teamId] }),
})
```

## Packages à installer si manquants
```bash
npm i @hello-pangea/dnd
npm i react-hook-form @hookform/resolvers
```

## Résultat attendu
- Issues page 100% fonctionnelle
- 3 vues (list/board/table) avec toggle
- Filtres URL-based
- Create/edit dialogs avec toutes les options
- Drag & drop board avec optimistic updates
- Pagination sur la table
- Empty states appropriés
