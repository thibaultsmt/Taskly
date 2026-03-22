# Agent 7 — People Page & Invitation Flow

## Contexte
Créer la page People (membres + invitations) et la page publique d'acceptation d'invitation.

## Fichiers à créer

### `src/routes/_app/teams/$teamId/people/index.tsx`

```tsx
export const Route = createFileRoute("/_app/teams/$teamId/people/")({
  loader: async ({ context: { queryClient }, params: { teamId } }) => {
    await Promise.all([
      queryClient.ensureQueryData(teamMembersQueryOptions(teamId)),
      queryClient.ensureQueryData(invitationsQueryOptions(teamId)),
    ])
  },
  component: PeoplePage,
})

function PeoplePage() {
  const { teamId } = Route.useParams()
  const { data: members } = useSuspenseQuery(teamMembersQueryOptions(teamId))
  const { data: invitations } = useSuspenseQuery(invitationsQueryOptions(teamId))
  const [inviteOpen, setInviteOpen] = useState(false)

  // Récupérer le rôle de l'user courant pour vérifier les permissions
  const { data: session } = authClient.useSession()
  const currentMember = members.find(m => m.userId === session?.user?.id)
  const isAdmin = currentMember?.role === "ADMIN"

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">People</h1>
        {isAdmin && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Invite
          </Button>
        )}
      </div>

      {/* Members section */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Members ({members.length})
        </h2>
        <div className="space-y-2">
          {members.map(member => (
            <MemberRow
              key={member.id}
              member={member}
              isCurrentUser={member.userId === session?.user?.id}
              canRemove={isAdmin && member.userId !== session?.user?.id}
              onRemove={...}
            />
          ))}
        </div>
      </section>

      {/* Pending invitations */}
      {invitations.filter(i => i.status === "pending").length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Pending Invitations ({pendingCount})
          </h2>
          <div className="space-y-2">
            {pendingInvitations.map(inv => (
              <InvitationRow
                key={inv.id}
                invitation={inv}
                canManage={isAdmin}
                onResend={...}
                onDelete={...}
              />
            ))}
          </div>
        </section>
      )}

      <InviteDialog
        teamId={teamId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </div>
  )
}
```

### `MemberRow` component (inline ou séparé)

```tsx
function MemberRow({ member, isCurrentUser, canRemove, onRemove }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
      <div className="flex items-center gap-3">
        <UserAvatar name={member.name} image={member.user?.image} />
        <div>
          <p className="text-sm font-medium">
            {member.name}
            {isCurrentUser && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
          </p>
          <p className="text-xs text-muted-foreground">{member.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={member.role === "ADMIN" ? "default" : "secondary"}>
          {member.role.toLowerCase()}
        </Badge>
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onRemove(member.id)}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}
```

### `InvitationRow` component

```tsx
function InvitationRow({ invitation, canManage, onResend, onDelete }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg border border-dashed">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          <Mail className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm">{invitation.email}</p>
          <p className="text-xs text-muted-foreground">
            Expires {formatRelative(new Date(invitation.expiresAt), new Date())}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{invitation.role.toLowerCase()}</Badge>
        {canManage && (
          <>
            <Button variant="ghost" size="sm" onClick={() => onResend(invitation.id)}>
              Resend
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(invitation.id)}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
```

### `InviteDialog` component

```tsx
function InviteDialog({ teamId, open, onOpenChange }) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER")

  const mutation = useMutation({
    mutationFn: () => createInvitation({ data: { teamId, email, role } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations", teamId] })
      onOpenChange(false)
      toast.success(`Invitation sent to ${email}`)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to team</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Email address</Label>
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={v => setRole(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">Member</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Admins can manage members and settings.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!email || mutation.isPending}>
            {mutation.isPending ? "Sending..." : "Send invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### `src/routes/invite/$invitationId/index.tsx` — Page publique

```tsx
// Cette page est publique (pas sous /_app/)
// Elle affiche:
// 1. Loading: "Loading invitation..."
// 2. Erreur: "Invitation not found or expired"
// 3. Succès: "You've been invited to [team] by [person]"
//    - Bouton "Accept invitation" → createAcceptInvitation + redirect to /teams/$teamId
//    - Si not logged in → redirect to /login with redirect param

export const Route = createFileRoute("/invite/$invitationId/")({
  loader: async ({ params: { invitationId } }) =>
    getInvitationById({ data: { invitationId } }),  // no auth required
  component: InvitePage,
  errorComponent: InviteError,
})

function InvitePage() {
  const invitation = Route.useLoaderData()
  const { invitationId } = Route.useParams()
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()

  const acceptMutation = useMutation({
    mutationFn: () => acceptInvitation({ data: { invitationId } }),
    onSuccess: (data) => {
      navigate({ to: "/teams/$teamId/issues", params: { teamId: data.teamId } })
      toast.success("Welcome to the team!")
    },
  })

  if (invitation.status !== "pending") {
    return <InviteExpired />
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Team Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>You've been invited to join <strong>{invitation.team.name}</strong></p>
          <p className="text-sm text-muted-foreground">Role: {invitation.role}</p>
          {!session ? (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Please sign in to accept this invitation.
              </p>
              <Button asChild>
                <Link to="/login" search={{ redirect: `/invite/${invitationId}` }}>
                  Sign in to accept
                </Link>
              </Button>
            </div>
          ) : session.user.email !== invitation.email ? (
            <p className="text-sm text-destructive">
              This invitation was sent to {invitation.email}, but you're signed in as {session.user.email}.
            </p>
          ) : (
            <Button onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}>
              {acceptMutation.isPending ? "Accepting..." : "Accept invitation"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

## Mutations membres

```ts
const removeMutation = useMutation({
  mutationFn: (memberId) => removeTeamMember({ data: { teamId, memberId } }),
  onMutate: async (memberId) => {
    await queryClient.cancelQueries({ queryKey: ["members", teamId] })
    const prev = queryClient.getQueryData(["members", teamId])
    queryClient.setQueryData(["members", teamId], old => old.filter(m => m.id !== memberId))
    return { prev }
  },
  onError: (_, __, ctx) => queryClient.setQueryData(["members", teamId], ctx.prev),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["members", teamId] }),
})
```

## Package utilitaire

```bash
npm i date-fns
```
Pour `formatRelative`, `formatDistance` etc.

## Résultat attendu
- People page avec liste membres + invitations pending
- Dialog d'invitation avec email + rôle
- Remove member avec optimistic update
- Resend + cancel invitation
- Page publique /invite/$invitationId fonctionnelle
- Gestion des cas: non-connecté, mauvais email, invitation expirée
- Permissions admin/member respectées
