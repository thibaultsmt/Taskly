import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Eye, EyeOff, ShieldCheck, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "#/components/ui/dialog"
import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"
import { Label } from "#/components/ui/label"
import { updateTeam } from "#/server/teams"

interface ApiKeyDialogProps {
  teamId: string
  currentKey?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ApiKeyDialog({ teamId, currentKey, open, onOpenChange }: ApiKeyDialogProps) {
  const [key, setKey] = React.useState(currentKey ?? "")
  const [showKey, setShowKey] = React.useState(false)
  const queryClient = useQueryClient()

  React.useEffect(() => {
    if (open) {
      setKey(currentKey ?? "")
      setShowKey(false)
    }
  }, [open, currentKey])

  const mutation = useMutation({
    mutationFn: (groqApiKey: string | null | undefined) =>
      updateTeam({ data: { teamId, groqApiKey } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["teams", teamId] })
      onOpenChange(false)
    },
  })

  function handleSave() {
    mutation.mutate(key.trim() || undefined)
  }

  function handleDelete() {
    mutation.mutate(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Groq API Key</DialogTitle>
          <DialogDescription>
            Configurez votre clé API Groq pour activer les fonctionnalités IA.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="api-key">Clé API</Label>
            <div className="relative flex items-center">
              <Input
                id="api-key"
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !mutation.isPending && key.trim() !== (currentKey ?? "")) {
                    handleSave()
                  }
                }}
                placeholder="gsk_..."
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2.5 text-muted-foreground hover:text-foreground"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? "Masquer la clé" : "Afficher la clé"}
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0" />
            Votre clé est chiffrée et stockée de manière sécurisée.
          </div>
        </div>

        <DialogFooter>
          {currentKey && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={mutation.isPending}
            >
              <Trash2 className="size-4" />
              Supprimer
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={mutation.isPending || key.trim() === (currentKey ?? "")}
          >
            {mutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ApiKeyDialog }
