import * as React from "react"
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import { Users, FolderOpen, CheckSquare, TrendingUp } from "lucide-react"
import { teamStatsQueryOptions } from "#/server/stats"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "#/components/ui/card"
import { StatCardSkeleton } from "#/components/ui/skeletons"
import { PriorityIcon, type Priority } from "#/components/shared/priority-icon"
import { StatusBadge, type WorkflowStateType } from "#/components/shared/status-badge"
import { cn } from "#/lib/utils"

export const Route = createFileRoute("/_app/teams/$teamId/management/")({
  loader: ({ context: { queryClient }, params: { teamId } }) =>
    queryClient.ensureQueryData(teamStatsQueryOptions(teamId)),
  pendingComponent: ManagementPageSkeleton,
  errorComponent: ({ error }) => (
    <div className="p-6 text-destructive">Error: {(error as Error).message}</div>
  ),
  component: ManagementPage,
})

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload?: { fill?: string; name?: string } }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  const fill = entry.payload?.fill
  const displayLabel = label || entry.payload?.name || entry.name

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="flex items-center gap-2">
        {fill && (
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: fill }} />
        )}
        <span className="font-medium text-popover-foreground">{displayLabel}</span>
        <span className="tabular-nums text-muted-foreground">{entry.value}</span>
      </div>
    </div>
  )
}

// ── Priority helpers ──────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<string, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
}

const PRIORITY_COLORS: Record<string, string> = {
  none: "#94a3b8",
  low: "#3b82f6",
  medium: "#eab308",
  high: "#f97316",
  urgent: "#ef4444",
}

function dbPriorityToEnum(priority: string): Priority {
  const map: Record<string, Priority> = {
    none: "NO_PRIORITY",
    low: "LOW",
    medium: "MEDIUM",
    high: "HIGH",
    urgent: "URGENT",
  }
  return map[priority] ?? "NO_PRIORITY"
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  backlog: "#94a3b8",
  unstarted: "#6b7280",
  started: "#3b82f6",
  completed: "#22c55e",
  canceled: "#ef4444",
}

// ── StatCard ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
}

function StatCard({ title, value, subtitle, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

// ── PriorityBarChart ──────────────────────────────────────────────────────────

interface PriorityBreakdownItem {
  priority: string
  count: number
}

function PriorityBarChart({ data }: { data: PriorityBreakdownItem[] }) {
  const chartData = data.map((item) => ({
    name: PRIORITY_LABELS[item.priority] ?? item.priority,
    count: item.count,
    fill: PRIORITY_COLORS[item.priority] ?? "#94a3b8",
  }))

  if (data.every((d) => d.count === 0)) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No issues yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip cursor={{ fill: "rgba(100,116,139,0.08)" }} content={<ChartTooltip />} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── StatusPieChart ────────────────────────────────────────────────────────────

interface StatusBreakdownItem {
  type: string
  name: string
  count: number
  color: string
}

function StatusPieChart({ data }: { data: StatusBreakdownItem[] }) {
  const filtered = data.filter((d) => d.count > 0)

  if (filtered.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No issues yet
      </div>
    )
  }

  const chartData = filtered.map((item) => ({
    name: item.name,
    value: item.count,
    type: item.type,
    fill: STATUS_COLORS[item.type] ?? item.color,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={70}
          label={false}
        >
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend
          formatter={(value: string) => value}
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── RecentIssuesList ──────────────────────────────────────────────────────────

interface RecentIssue {
  id: string
  number: number
  title: string
  priority: string
  workflowState: { name: string; type: string; color: string }
  project?: { name: string; color: string } | null
  createdAt: string | Date
}

function RecentIssuesList({
  issues,
  teamId,
}: {
  issues: RecentIssue[]
  teamId: string
}) {
  const navigate = useNavigate()

  if (issues.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No issues yet.</p>
    )
  }

  return (
    <ul className="flex flex-col gap-1">
      {issues.map((issue) => (
        <li
          key={issue.id}
          className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors"
          onClick={() =>
            void navigate({
              to: "/teams/$teamId/tasks",
              params: { teamId },
            })
          }
        >
          <PriorityIcon priority={dbPriorityToEnum(issue.priority)} />
          <span className="shrink-0 text-xs text-muted-foreground font-mono">
            #{issue.number}
          </span>
          <span className="flex-1 truncate text-sm">{issue.title}</span>
          <StatusBadge
            type={issue.workflowState.type as WorkflowStateType}
            name={issue.workflowState.name}
            className="shrink-0 text-xs"
          />
        </li>
      ))}
    </ul>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ManagementPageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="h-7 w-36 rounded bg-muted animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4 h-60 animate-pulse" />
        <div className="rounded-xl border bg-card p-4 h-60 animate-pulse" />
      </div>
      <div className="rounded-xl border bg-card p-4 h-48 animate-pulse" />
    </div>
  )
}

// ── ManagementPage ────────────────────────────────────────────────────────────

function ManagementPage() {
  const { teamId } = Route.useParams()
  const { data: stats } = useSuspenseQuery(teamStatsQueryOptions(teamId))
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [chartsVisible, setChartsVisible] = React.useState(true)
  const leftRef = React.useRef(false)

  React.useEffect(() => {
    const isHere = pathname.includes("/management")
    if (!isHere) { leftRef.current = true; return }
    if (!leftRef.current) return
    leftRef.current = false
    setChartsVisible(false)
    const id = requestAnimationFrame(() => setChartsVisible(true))
    return () => cancelAnimationFrame(id)
  }, [pathname])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h1 className="text-lg font-semibold">Management</h1>
      </div>
      <div className="flex-1 overflow-auto p-6 space-y-6">

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Team Members"
          value={stats.stats.membersCount}
          icon={Users}
        />
        <StatCard
          title="Active Projects"
          value={stats.stats.projectsCount}
          icon={FolderOpen}
        />
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
            {chartsVisible && <PriorityBarChart data={stats.priorityBreakdown} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Issues by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {chartsVisible && <StatusPieChart data={stats.statusBreakdown} />}
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

      {typeof window !== "undefined" && !!window.__TAURI__ && (
        <DesktopPreferences />
      )}
      </div>
    </div>
  )
}

// ── ToggleRow ─────────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  storageKey,
  defaultOn = false,
}: {
  label: string
  description: string
  storageKey: string
  defaultOn?: boolean
}) {
  const [enabled, setEnabled] = React.useState(() => {
    if (typeof window === "undefined") return defaultOn
    const val = localStorage.getItem(storageKey)
    return val === null ? defaultOn : val === "true"
  })

  function toggle() {
    const next = !enabled
    setEnabled(next)
    localStorage.setItem(storageKey, String(next))
  }

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={toggle}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
          enabled ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            enabled ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
    </div>
  )
}

// ── DesktopPreferences ────────────────────────────────────────────────────────

function DesktopPreferences() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Préférences desktop</CardTitle>
        <p className="text-sm text-muted-foreground">
          Paramètres spécifiques à l'application Tauri.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <ToggleRow
          label="Fermer l'application complètement"
          description="Par défaut, fermer la fenêtre minimise l'app en tâche de fond. Activez pour quitter vraiment."
          storageKey="tauri-close-behavior"
          defaultOn={false}
        />
        <ToggleRow
          label="Désactiver la fenêtre de tâche au verrouillage"
          description="Désactive la modal qui apparaît quand vous verrouillez votre PC avec ⌘+Ctrl+Q ou Win+L."
          storageKey="disable-lock-modal"
          defaultOn={false}
        />
      </CardContent>
    </Card>
  )
}
