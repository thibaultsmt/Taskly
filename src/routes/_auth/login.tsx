import { createFileRoute, redirect } from "@tanstack/react-router"
import { signIn } from "../../lib/auth-client"
import { getSession } from "../../server/auth"
import { Button } from "../../components/ui/button"
import { sileo } from "sileo"

export const Route = createFileRoute("/_auth/login")({
  beforeLoad: async () => {
    const session = await getSession()
    if (session) throw redirect({ to: "/teams" })
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-8 shadow-lg">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Taskly</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>
        <Button
          className="w-full cursor-pointer"
          onClick={async () => {
            try {
              const result = await signIn.social({
                provider: "google",
                callbackURL: `${import.meta.env.VITE_APP_URL ?? "http://localhost:3000"}/teams`,
              })
              if (result?.error) {
                sileo.error({ title: result.error.message ?? `Authentication failed (${result.error.status ?? "unknown"})` })
              }
            } catch (err) {
              sileo.error({ title: err instanceof Error ? err.message : "An unexpected error occurred" })
            }
          }}
        >
          Continue with Google
        </Button>
      </div>
    </div>
  )
}
