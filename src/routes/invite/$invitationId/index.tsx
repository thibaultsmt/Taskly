import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { sileo } from "sileo"
import { getInvitationById, acceptInvitation } from "#/server/invitations"
import { authClient } from "#/lib/auth-client"
import { Button } from "#/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "#/components/ui/card"

export const Route = createFileRoute("/invite/$invitationId/")({
  loader: ({ params: { invitationId } }) =>
    getInvitationById({ data: { invitationId } }),
  component: InvitePage,
  errorComponent: () => (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-destructive">Invitation introuvable ou expirée.</p>
    </div>
  ),
})

function InvitePage() {
  const invitation = Route.useLoaderData()
  const { invitationId } = Route.useParams()
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()

  const acceptMutation = useMutation({
    mutationFn: () => acceptInvitation({ data: { invitationId } }),
    onSuccess: (result) => {
      sileo.success({ title: "Welcome to the team!" })
      void navigate({
        to: "/teams/$teamId/issues",
        params: { teamId: result.teamId },
      })
    },
    onError: (error: Error) => {
      sileo.error({ title: error.message ?? "Failed to accept invitation" })
    },
  })

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This invitation could not be found or has already been processed.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (invitation.status !== "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation expired or already used</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This invitation is no longer valid. Please ask a team admin to
              send a new invitation.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const expiresAt = new Date(invitation.expiresAt)
  const isExpired = expiresAt < new Date()

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation expired</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This invitation expired on{" "}
              {expiresAt.toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              . Please ask a team admin to send a new invitation.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Team Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            You've been invited to join{" "}
            <strong>{invitation.team.name}</strong>.
          </p>
          <p className="text-xs text-muted-foreground">
            Role: {invitation.role}
          </p>

          {!session ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Please sign in to accept this invitation.
              </p>
              <Button onClick={() => void navigate({ to: "/login" })}>
                Sign in to accept
              </Button>
            </div>
          ) : session.user.email !== invitation.email ? (
            <p className="text-sm text-destructive">
              This invitation was sent to <strong>{invitation.email}</strong>,
              but you're signed in as <strong>{session.user.email}</strong>.
              Please sign in with the correct account.
            </p>
          ) : (
            <Button
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending ? "Accepting…" : "Accept invitation"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
