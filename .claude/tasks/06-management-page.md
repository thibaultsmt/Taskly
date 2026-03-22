# Agent 6 — Management Page (Stats & Analytics)

## Contexte
Créer la page de management avec statistiques d'équipe, graphiques, et configuration.

## Route à créer

### `src/routes/_app/teams/$teamId/management/index.tsx`

```tsx
export const Route = createFileRoute("/_app/teams/$teamId/management/")({
  loader: async ({ context: { queryClient }, params: { teamId } }) =>
    queryClient.ensureQueryData(teamStatsQueryOptions(teamId)),
  component: ManagementPage,
})
```

## Layout de la page

```
┌─────────────────────────────────────────────────────┐
│  Management                                          │
├──────────┬──────────┬──────────┬────────────────────┤
│  Members │ Projects │  Issues  │ Completion Rate     │
│    12    │    5     │   234    │      78%            │
├──────────┴──────────┴──────────┴────────────────────┤
│  Issues by Priority (bar)   │  Issues by Status (pie)│
│                              │                       │
├──────────────────────────────┴───────────────────────┤
│  Recent Issues (list of last 5)                      │
└─────────────────────────────────────────────────────┘
```

## Composants à créer

### StatCard
```tsx
function StatCard({ title, value, subtitle?, icon: Icon, trend? }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}
```

### Charts — Utiliser recharts
```bash
npm i recharts
```

```tsx
// PriorityBarChart: BarChart des issues par priorité
// Couleurs: NO_PRIORITY=gray, LOW=blue, MEDIUM=yellow, HIGH=orange, URGENT=red
// X axis: noms des priorités, Y axis: count

// StatusPieChart: PieChart des issues par status
// Couleurs selon le type: backlog=gray, unstarted=gray, started=blue, completed=green, canceled=red
// Legend avec noms + counts
```

### RecentIssuesList
```tsx
// Liste des 5 dernières issues
// Chaque ligne: PriorityIcon + numéro + titre + StatusBadge + date
// Cliquable → navigate to issues page
```

## Data (depuis `src/server/stats.ts`)

```ts
interface TeamStats {
  stats: {
    membersCount: number
    projectsCount: number
    totalIssues: number
    completedIssues: number
    completionRate: number  // 0-100
  }
  priorityBreakdown: Array<{ priority: string, count: number }>
  statusBreakdown: Array<{ type: string, name: string, count: number, color: string }>
  recentIssues: Array<{
    id: string, number: number, title: string, priority: string,
    workflowState: { name: string, type: string, color: string },
    project?: { name: string, color: string },
    createdAt: string
  }>
}
```

## Page complète

```tsx
function ManagementPage() {
  const { teamId } = Route.useParams()
  const stats = Route.useLoaderData()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Management</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Team Members" value={stats.stats.membersCount} icon={Users} />
        <StatCard title="Active Projects" value={stats.stats.projectsCount} icon={FolderOpen} />
        <StatCard
          title="Total Issues"
          value={stats.stats.totalIssues}
          subtitle={`${stats.stats.completedIssues} completed`}
          icon={CheckSquare}
        />
        <StatCard
          title="Completion Rate"
          value={`${Math.round(stats.stats.completionRate)}%`}
          subtitle={`${stats.stats.completedIssues} of ${stats.stats.totalIssues}`}
          icon={TrendingUp}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Issues by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <PriorityBarChart data={stats.priorityBreakdown} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Issues by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusPieChart data={stats.statusBreakdown} />
          </CardContent>
        </Card>
      </div>

      {/* Recent issues */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentIssuesList issues={stats.recentIssues} teamId={teamId} />
        </CardContent>
      </Card>
    </div>
  )
}
```

## Packages à installer
```bash
npm i recharts
```

## Résultat attendu
- Page management avec 4 stat cards
- 2 graphiques (bar + pie) avec recharts
- Liste des 5 dernières issues
- Loading skeletons (StatCardSkeleton)
- Empty state si aucune issue
