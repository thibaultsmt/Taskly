import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sileo } from "sileo"
import { UserPlus, Mail } from "lucide-react"
import {
  teamMembersQueryOptions,
  removeTeamMember,
} from "#/server/members"
import {
  invitationsQueryOptions,
  createInvitation,
  resendInvitation,
  deleteInvitation,
} from "#/server/invitations"
import { authClient } from "#/lib/auth-client"
import { UserAvatar } from "#/components/shared/user-avatar"
import { Badge } from "#/components/ui/badge"
import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "#/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select"

export const Route = createFileRoute("/_app/teams/$teamId/people/")({
  loader: async ({ context, params }) => {
    const qc = (context as { queryClient: { ensureQueryData: (opts: unknown) => unknown } }).queryClient
    await Promise.all([
      qc.ensureQueryData(teamMembersQueryOptions(params.teamId)),
      qc.ensureQueryData(invitationsQueryOptions(params.teamId)),
    ])
  },
  pendingComponent: () => (
    <div className="p-4 text-muted-foreground">Loading people…</div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-4 text-destructive">Error: {(error as Error).message}</div>
  ),
  component: PeoplePage,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamMember = {
  id: string
  userId: string
  userEmail: string
  userName: string
  role: string
  teamId: string
  createdAt: Date
  updatedAt: Date
  image?: string | null
}

type Invitation = {
  id: string
  email: string
  role: string
  status: string
  expiresAt: Date
  teamId: string
  invitedBy: string
  createdAt: Date
  team: { id: string; name: string }
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

interface MemberRowProps {
  member: TeamMember
  isCurrentUser: boolean
  canRemove: boolean
  onRemove: (memberId: string) => void
  isRemoving: boolean
}

function MemberRow({ member, isCurrentUser, canRemove, onRemove, isRemoving }: MemberRowProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
      <div className="flex items-center gap-3">
        <UserAvatar name={member.userName} image={member.image ?? undefined} size="sm" />
        <div>
          <p className="text-sm font-medium">
            {member.userName}
            {isCurrentUser && (
              <span className="text-xs text-muted-foreground ml-1">(you)</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{member.userEmail}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={member.role === "admin" ? "default" : "secondary"}>
          {member.role}
        </Badge>
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onRemove(member.id)}
            disabled={isRemoving}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── InvitationRow ────────────────────────────────────────────────────────────

interface InvitationRowProps {
  invitation: Invitation
  canManage: boolean
  onResend: (invitationId: string) => void
  onDelete: (invitationId: string) => void
  isResending: boolean
  isDeleting: boolean
}

function InvitationRow({
  invitation,
  canManage,
  onResend,
  onDelete,
  isResending,
  isDeleting,
}: InvitationRowProps) {
  const expiresAt = new Date(invitation.expiresAt)
  const expiresLabel = expiresAt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg border border-dashed">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          <Mail className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm">{invitation.email}</p>
          <p className="text-xs text-muted-foreground">Expires {expiresLabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{invitation.role}</Badge>
        {canManage && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onResend(invitation.id)}
              disabled={isResending || isDeleting}
            >
              Resend
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(invitation.id)}
              disabled={isResending || isDeleting}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── InviteDialog ─────────────────────────────────────────────────────────────

type InviteRole = "developer" | "admin" | "viewer"

interface InviteDialogProps {
  teamId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function InviteDialog({ teamId, open, onOpenChange }: InviteDialogProps) {
  const queryClient = useQueryClient()
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<InviteRole>("developer")

  React.useEffect(() => {
    if (!open) {
      setEmail("")
      setRole("developer")
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: () => createInvitation({ data: { teamId, email, role } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invitations", teamId] })
      sileo.success({ title: `Invitation sent to ${email}` })
      onOpenChange(false)
    },
    onError: (error: Error) => {
      sileo.error({ title: error.message ?? "Failed to send invitation" })
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite to team</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Email address</label>
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Role</label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as InviteRole)}
              disabled={mutation.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="developer">Developer</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Admins can manage members and settings.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!email || mutation.isPending}
          >
            {mutation.isPending ? "Sending…" : "Send invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── PeoplePage ───────────────────────────────────────────────────────────────

function PeoplePage() {
  const { teamId } = Route.useParams()
  const queryClient = useQueryClient()
  const { data: members } = useSuspenseQuery(teamMembersQueryOptions(teamId))
  const { data: invitations } = useSuspenseQuery(invitationsQueryOptions(teamId))
  const [inviteOpen, setInviteOpen] = React.useState(false)

  const { data: session } = authClient.useSession()
  const currentMember = (members as TeamMember[]).find(
    (m) => m.userId === session?.user?.id,
  )
  const isAdmin = currentMember?.role === "admin"

  const pendingInvitations = (invitations as Invitation[]).filter(
    (i) => i.status === "pending",
  )

  // ── Remove member mutation ──
  const removeMutation = useMutation({
    mutationFn: (memberId: string) =>
      removeTeamMember({ data: { teamId, memberId } }),
    onMutate: async (memberId) => {
      await queryClient.cancelQueries({ queryKey: ["team-members", teamId] })
      const prev = queryClient.getQueryData<TeamMember[]>(["team-members", teamId])
      queryClient.setQueryData<TeamMember[]>(["team-members", teamId], (old) =>
        old ? old.filter((m) => m.id !== memberId) : [],
      )
      return { prev }
    },
    onError: (_err, _memberId, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["team-members", teamId], ctx.prev)
      }
      sileo.error({ title: "Failed to remove member" })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["team-members", teamId] })
    },
  })

  // ── Resend invitation mutation ──
  const resendMutation = useMutation({
    mutationFn: (invitationId: string) =>
      resendInvitation({ data: { invitationId } }),
    onSuccess: () => {
      sileo.success({ title: "Invitation resent" })
      void queryClient.invalidateQueries({ queryKey: ["invitations", teamId] })
    },
    onError: () => sileo.error({ title: "Failed to resend invitation" }),
  })

  // ── Delete invitation mutation ──
  const deleteMutation = useMutation({
    mutationFn: (invitationId: string) =>
      deleteInvitation({ data: { invitationId } }),
    onSuccess: () => {
      sileo.success({ title: "Invitation cancelled" })
      void queryClient.invalidateQueries({ queryKey: ["invitations", teamId] })
    },
    onError: () => sileo.error({ title: "Failed to cancel invitation" }),
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h1 className="text-lg font-semibold">People</h1>
        {isAdmin && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" />
            Invite
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-8 max-w-3xl">

      {/* Members section */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Members ({(members as TeamMember[]).length})
        </h2>
        <div className="space-y-1">
          {(members as TeamMember[]).map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isCurrentUser={member.userId === session?.user?.id}
              canRemove={isAdmin && member.userId !== session?.user?.id}
              onRemove={(id) => removeMutation.mutate(id)}
              isRemoving={
                removeMutation.isPending && removeMutation.variables === member.id
              }
            />
          ))}
        </div>
      </section>

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Pending Invitations ({pendingInvitations.length})
          </h2>
          <div className="space-y-2">
            {pendingInvitations.map((inv) => (
              <InvitationRow
                key={inv.id}
                invitation={inv}
                canManage={isAdmin}
                onResend={(id) => resendMutation.mutate(id)}
                onDelete={(id) => deleteMutation.mutate(id)}
                isResending={
                  resendMutation.isPending && resendMutation.variables === inv.id
                }
                isDeleting={
                  deleteMutation.isPending && deleteMutation.variables === inv.id
                }
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
    </div>
  )
}
