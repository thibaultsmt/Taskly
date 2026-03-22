import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  Plus,
  FolderPlus,
  ListTodo,
  FolderOpen,
  Settings,
  Users,
} from "lucide-react"
import {
  CommandDialog,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  CommandSeparator,
} from "#/components/ui/command"

interface CommandPaletteProps {
  teamId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: (actionId: string) => void
}

type NavTarget =
  | { to: "/teams/"; params?: Record<string, string> }
  | { to: "/teams/$teamId"; params: { teamId: string } }
  | { to: "/teams/$teamId/issues/"; params: { teamId: string } }
  | { to: "/teams/$teamId/projects/"; params: { teamId: string } }

interface CommandAction {
  id: string
  label: string
  icon: React.ElementType
  shortcut?: string
  group: string
  nav?: NavTarget
}

function CommandPalette({ teamId, open, onOpenChange, onAction }: CommandPaletteProps) {
  const navigate = useNavigate()

  const actions: CommandAction[] = [
    {
      id: "create-issue",
      label: "Créer une issue",
      icon: Plus,
      shortcut: "C",
      group: "Actions",
    },
    {
      id: "create-project",
      label: "Créer un projet",
      icon: FolderPlus,
      shortcut: "P",
      group: "Actions",
    },
    {
      id: "nav-issues",
      label: "Aller aux Issues",
      icon: ListTodo,
      group: "Navigation",
      nav: { to: "/teams/$teamId/issues/", params: { teamId } },
    },
    {
      id: "nav-projects",
      label: "Aller aux Projets",
      icon: FolderOpen,
      group: "Navigation",
      nav: { to: "/teams/$teamId/projects/", params: { teamId } },
    },
    {
      id: "nav-team",
      label: "Aller à l'équipe",
      icon: Settings,
      group: "Navigation",
      nav: { to: "/teams/$teamId", params: { teamId } },
    },
    {
      id: "nav-teams",
      label: "Aller aux Équipes",
      icon: Users,
      group: "Navigation",
      nav: { to: "/teams/" },
    },
  ]

  function handleSelect(action: CommandAction) {
    onOpenChange(false)
    if (action.nav) {
      void navigate(action.nav as Parameters<typeof navigate>[0])
    } else {
      onAction(action.id)
    }
  }

  const groups = Array.from(new Set(actions.map((a) => a.group)))

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Palette de commandes">
      <Command>
        <CommandInput placeholder="Rechercher une action..." />
        <CommandList>
          <CommandEmpty>Aucune action trouvée.</CommandEmpty>
          {groups.map((group, idx) => (
            <React.Fragment key={group}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={group}>
                {actions
                  .filter((a) => a.group === group)
                  .map((action) => (
                    <CommandItem
                      key={action.id}
                      onSelect={() => handleSelect(action)}
                    >
                      <action.icon className="size-4" />
                      {action.label}
                      {action.shortcut && (
                        <CommandShortcut>{action.shortcut}</CommandShortcut>
                      )}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </React.Fragment>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

export { CommandPalette }
