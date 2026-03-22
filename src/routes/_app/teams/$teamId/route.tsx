import * as React from "react"
import {
  createFileRoute,
  Outlet,
  Link,
  useRouter,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router"
import {
  Files,
  FolderOpen,
  BarChart2,
  Users,
  CircleDot,
  KeyRound,
  PanelLeft,
  MessageSquare,
  Menu,
  LogOut,
  LayoutGrid,
  ChevronDown,
  Pencil,
  Trash2,
  Check,
  Plus,
  ListTodo,
} from "lucide-react"
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sileo } from "sileo"
import { teamQueryOptions, teamsQueryOptions, createTeam, deleteTeam, updateTeam } from "../../../../server/teams"
import { authClient } from "#/lib/auth-client"
import { Button } from "#/components/ui/button"
import { Separator } from "#/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "#/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "#/components/ui/dialog"
import { Input } from "#/components/ui/input"
import { Label } from "#/components/ui/label"
import { ApiKeyDialog } from "#/components/shared/api-key-dialog"
import { ChatSheet } from "#/components/chat/ChatSheet"
import { cn } from "#/lib/utils"

export const Route = createFileRoute("/_app/teams/$teamId")({
  loader: ({ context: { queryClient }, params: { teamId } }) =>
    Promise.all([
      queryClient.ensureQueryData(teamQueryOptions(teamId)),
      queryClient.ensureQueryData(teamsQueryOptions),
    ]),
  component: TeamLayout,
})

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { to: "/teams/$teamId/tasks", icon: ListTodo, label: "Tasks" },
  { to: "/teams/$teamId/issues", icon: Files, label: "Issues" },
  { to: "/teams/$teamId/projects", icon: FolderOpen, label: "Projects" },
  { to: "/teams/$teamId/statuts", icon: CircleDot, label: "Statuts" },
  { to: "/teams/$teamId/management", icon: BarChart2, label: "Management" },
  { to: "/teams/$teamId/people", icon: Users, label: "People" },
]

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function useCurrentPageLabel(teamId: string): string {
  const location = useRouterState({ select: (s) => s.location })
  const pathname = location.pathname

  for (const item of NAV_ITEMS) {
    const resolved = item.to.replace("$teamId", teamId)
    if (pathname.startsWith(resolved)) {
      return item.label
    }
  }
  return ""
}

function CreateTeamDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = React.useState("")
  const [key, setKey] = React.useState("")

  const mutation = useMutation({
    mutationFn: () => createTeam({ data: { name: name.trim(), key: key.toUpperCase() } }),
    onSuccess: (team) => {
      void queryClient.invalidateQueries({ queryKey: ["teams"] })
      onOpenChange(false)
      setName("")
      setKey("")
      void navigate({ to: "/teams/$teamId/issues", params: { teamId: team.id } })
    },
    onError: (e: Error) => sileo.error({ title: e.message }),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim() && key.length === 3) mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Créer une équipe</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-name">Nom</Label>
            <Input
              id="ct-name"
              placeholder="My Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-key">Clé (3 lettres)</Label>
            <Input
              id="ct-key"
              placeholder="ENG"
              maxLength={3}
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !name.trim() || key.length !== 3}
            >
              {mutation.isPending ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface SidebarNavProps {
  teamId: string
  teamName: string
  teamKey: string
  teams: Array<{ id: string; name: string; key: string }>
  collapsed: boolean
  hasApiKey: boolean
  onApiKey: () => void
  onTeamsManagement: () => void
}

function SidebarNav({
  teamId,
  teamName,
  teamKey,
  teams,
  collapsed,
  hasApiKey,
  onApiKey,
  onTeamsManagement,
}: SidebarNavProps) {
  const navigate = useNavigate()
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [createOpen, setCreateOpen] = React.useState(false)

  const userInitials = session?.user.name ? getInitials(session.user.name) : "?"

  function handleSignOut() {
    void authClient.signOut({
      fetchOptions: { onSuccess: () => void router.navigate({ to: "/login" }) },
    })
  }

  return (
    <TooltipProvider delay={300}>
      <div className="flex h-full flex-col">
        {/* Team header / switcher */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            render={
              <button className={cn(
                "flex h-12 w-full items-center border-b border-sidebar-border text-left hover:bg-sidebar-accent/60 transition-colors",
                collapsed ? "justify-center px-2" : "gap-2.5 px-3"
              )} />
            }
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              {teamKey.slice(0, 2)}
            </div>
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-sm font-semibold text-sidebar-foreground">{teamName}</span>
                <ChevronDown className="size-3.5 text-sidebar-foreground/50" />
              </>
            )}
          </DropdownMenuTrigger>
          {collapsed ? (
            <DropdownMenuContent side="bottom" align="start" sideOffset={4} className="w-48">
              {teams.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() =>
                    void navigate({ to: "/teams/$teamId/issues", params: { teamId: t.id } })
                  }
                >
                  <div className="flex size-5 shrink-0 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
                    {t.key.slice(0, 2)}
                  </div>
                  <span className="flex-1 truncate">{t.name}</span>
                  {t.id === teamId && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Nouvelle équipe
              </DropdownMenuItem>
            </DropdownMenuContent>
          ) : (
            <DropdownMenuContent side="bottom" align="start" collisionPadding={0} className="w-(--anchor-width)">
              {teams.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() =>
                    void navigate({ to: "/teams/$teamId/issues", params: { teamId: t.id } })
                  }
                >
                  <div className="flex size-5 shrink-0 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
                    {t.key.slice(0, 2)}
                  </div>
                  <span className="flex-1 truncate">{t.name}</span>
                  {t.id === teamId && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Nouvelle équipe
              </DropdownMenuItem>
            </DropdownMenuContent>
          )}
        </DropdownMenu>

        <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} />

        {/* Nav items */}
        <nav className="flex flex-1 flex-col gap-0.5 p-2 text-white">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const linkEl = (
              <Link
                to={item.to}
                params={{ teamId }}
                activeProps={{ className: "bg-sidebar-accent" }}
                inactiveProps={{ className: "opacity-70 hover:opacity-100 hover:bg-sidebar-accent/60" }}
                className={cn(
                  "flex items-center rounded-md text-sm text-white transition-colors",
                  collapsed
                    ? "justify-center p-2"
                    : "gap-2.5 px-3 py-2"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger render={linkEl} />
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              )
            }

            return (
              <React.Fragment key={item.to}>{linkEl}</React.Fragment>
            )
          })}
        </nav>

        <Separator />

        {/* API Key button */}
        <div className="p-2">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-full text-white"
                    onClick={onApiKey}
                    aria-label="API Key"
                  >
                    <KeyRound className="size-4" />
                  </Button>
                }
              />
              <TooltipContent side="right">API Key</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2.5 text-white"
              onClick={onApiKey}
            >
              <KeyRound className="size-4 shrink-0" />
              <span>API Key</span>
              {hasApiKey && (
                <span className="ml-auto size-1.5 rounded-full bg-white/70" />
              )}
            </Button>
          )}
        </div>

        <Separator />

        {/* User section */}
        <div className="p-2">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              render={
                <button
                  className={cn(
                    "flex w-full items-center rounded-md transition-colors hover:bg-sidebar-accent/60",
                    collapsed ? "justify-center p-2" : "gap-2.5 px-2 py-2"
                  )}
                  aria-label="User menu"
                >
                  <Avatar size="sm" className="shrink-0">
                    {session?.user.image && (
                      <AvatarImage src={session.user.image} alt={session.user.name ?? ""} />
                    )}
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="flex min-w-0 flex-1 flex-col text-left">
                      {session?.user.name && (
                        <span className="truncate text-xs font-medium text-sidebar-foreground">
                          {session.user.name}
                        </span>
                      )}
                      <span className="truncate text-[11px] text-sidebar-foreground/50">
                        {session?.user.email}
                      </span>
                    </div>
                  )}
                </button>
              }
            />
            <DropdownMenuContent side="right" align="end" sideOffset={8} alignOffset={-8} className="ml-2 min-w-52">
              <DropdownMenuItem onClick={onTeamsManagement}>
                <LayoutGrid className="size-4" />
                Teams
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TooltipProvider>
  )
}

interface TeamHeaderProps {
  teamId: string
  teamName: string
  onDesktopToggle: () => void
  onMobileMenuOpen: () => void
  onChat: () => void
}

function TeamHeader({
  teamId,
  teamName,
  onDesktopToggle,
  onMobileMenuOpen,
  onChat,
}: TeamHeaderProps) {
  const currentPage = useCurrentPageLabel(teamId)

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
      {/* Desktop sidebar toggle */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="hidden md:inline-flex"
        onClick={onDesktopToggle}
        aria-label="Toggle sidebar"
      >
        <PanelLeft className="size-4" />
      </Button>

      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={onMobileMenuOpen}
        aria-label="Open menu"
      >
        <Menu className="size-4" />
      </Button>

      {/* Breadcrumb */}
      <nav className="flex flex-1 items-center gap-1.5 text-sm">
        <span className="font-medium text-foreground">{teamName}</span>
        {currentPage && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{currentPage}</span>
          </>
        )}
      </nav>

      {/* Chat button */}
      <Button
        variant="outline"
        size="sm"
        className="hidden gap-1.5 sm:inline-flex"
        onClick={onChat}
        aria-label="Open AI chat"
      >
        <MessageSquare className="size-3.5" />
        <span>Chat</span>
        <kbd className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="sm:hidden"
        onClick={onChat}
        aria-label="Open AI chat"
      >
        <MessageSquare className="size-4" />
      </Button>
    </header>
  )
}

function TeamsManagementDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: teams } = useSuspenseQuery(teamsQueryOptions)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState("")

  const updateMutation = useMutation({
    mutationFn: (vars: { teamId: string; name: string }) =>
      updateTeam({ data: { teamId: vars.teamId, name: vars.name } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["teams"] })
      setEditingId(null)
    },
    onError: (e: Error) => sileo.error({ title: e.message }),
  })

  const deleteMutation = useMutation({
    mutationFn: (teamId: string) => deleteTeam({ data: { teamId } }),
    onSuccess: (_data, teamId) => {
      void queryClient.invalidateQueries({ queryKey: ["teams"] })
      const remaining = teams.filter((t) => t.id !== teamId)
      if (remaining.length > 0) {
        void navigate({ to: "/teams/$teamId/issues", params: { teamId: remaining[0].id } })
      }
    },
    onError: (e: Error) => sileo.error({ title: e.message }),
  })

  function startEdit(team: { id: string; name: string }) {
    setEditingId(team.id)
    setEditName(team.name)
  }

  function submitEdit(teamId: string) {
    if (editName.trim()) {
      updateMutation.mutate({ teamId, name: editName.trim() })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gérer les équipes</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {teams.map((team) => (
            <div key={team.id} className="flex items-center gap-2 rounded-lg border p-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                {team.key.slice(0, 2)}
              </div>
              {editingId === team.id ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitEdit(team.id)
                    if (e.key === "Escape") setEditingId(null)
                  }}
                  className="h-7 flex-1 text-sm"
                  autoFocus
                />
              ) : (
                <span className="flex-1 truncate text-sm font-medium">{team.name}</span>
              )}
              {team.isDefault && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  défaut
                </span>
              )}
              <div className="flex items-center gap-1">
                {editingId === team.id ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => submitEdit(team.id)}
                    disabled={updateMutation.isPending}
                  >
                    <Check className="size-3.5" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => startEdit(team)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                )}
                {!team.isDefault && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(team.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TeamLayout() {
  const { teamId } = Route.useParams()
  const { data: teamData } = useSuspenseQuery(teamQueryOptions(teamId))
  const { data: teams } = useSuspenseQuery(teamsQueryOptions)

  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [chatOpen, setChatOpen] = React.useState(false)
  const [apiKeyOpen, setApiKeyOpen] = React.useState(false)
  const [teamsManagementOpen, setTeamsManagementOpen] = React.useState(false)

  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setChatOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden border-r bg-sidebar transition-all duration-200 md:flex md:flex-col",
          sidebarOpen ? "md:w-60" : "md:w-14"
        )}
      >
        <SidebarNav
          teamId={teamId}
          teamName={teamData.name}
          teamKey={teamData.key}
          teams={teams}
          collapsed={!sidebarOpen}
          hasApiKey={Boolean(teamData.groqApiKey)}
          onApiKey={() => setApiKeyOpen(true)}
          onTeamsManagement={() => setTeamsManagementOpen(true)}
        />
      </aside>

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" showCloseButton className="w-60 bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarNav
            teamId={teamId}
            teamName={teamData.name}
            teamKey={teamData.key}
            teams={teams}
            collapsed={false}
            hasApiKey={Boolean(teamData.groqApiKey)}
            onApiKey={() => {
              setMobileOpen(false)
              setApiKeyOpen(true)
            }}
            onTeamsManagement={() => {
              setMobileOpen(false)
              setTeamsManagementOpen(true)
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TeamHeader
          teamId={teamId}
          teamName={teamData.name}
          onDesktopToggle={() => setSidebarOpen((v) => !v)}
          onMobileMenuOpen={() => setMobileOpen(true)}
          onChat={() => setChatOpen(true)}
        />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Chat sheet */}
      <ChatSheet
        teamId={teamId}
        groqApiKey={teamData.groqApiKey}
        open={chatOpen}
        onOpenChange={setChatOpen}
        onApiKeyClick={() => setApiKeyOpen(true)}
      />

      {/* API Key dialog */}
      <ApiKeyDialog
        teamId={teamId}
        currentKey={teamData.groqApiKey}
        open={apiKeyOpen}
        onOpenChange={setApiKeyOpen}
      />

      {/* Teams management dialog */}
      <TeamsManagementDialog
        open={teamsManagementOpen}
        onOpenChange={setTeamsManagementOpen}
      />
    </div>
  )
}
