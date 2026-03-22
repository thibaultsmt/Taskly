import * as React from "react"
import { ChevronsUpDown } from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "#/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover"
import { UserAvatar } from "#/components/shared/user-avatar"
import { cn } from "#/lib/utils"

interface Member {
  id: string
  name: string
  email: string
  image?: string | null
}

interface UserSelectorProps {
  members: Member[]
  value?: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  className?: string
}

function UserSelector({ members, value, onChange, placeholder = "Assigner...", className }: UserSelectorProps) {
  const [open, setOpen] = React.useState(false)

  const selectedMember = members.find((m) => m.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-expanded={open}
        className={cn("inline-flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-2.5 text-sm transition-colors hover:bg-muted", className)}
      >
        {selectedMember ? (
          <span className="flex min-w-0 items-center gap-2">
            <UserAvatar
              name={selectedMember.name}
              image={selectedMember.image ?? undefined}
              size="sm"
            />
            <span className="truncate">{selectedMember.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronsUpDown className="ml-auto size-3.5 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0">
        <Command>
          <CommandInput placeholder="Rechercher..." />
          <CommandList>
            <CommandEmpty>Aucun membre trouvé.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="unassigned"
                onSelect={() => {
                  onChange(null)
                  setOpen(false)
                }}
                data-checked={value === null || value === undefined}
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                    ?
                  </span>
                  Non assigné
                </span>
              </CommandItem>
              {members.map((member) => (
                <CommandItem
                  key={member.id}
                  value={member.name}
                  onSelect={() => {
                    onChange(member.id)
                    setOpen(false)
                  }}
                  data-checked={value === member.id}
                >
                  <span className="flex items-center gap-2">
                    <UserAvatar
                      name={member.name}
                      image={member.image ?? undefined}
                      size="sm"
                    />
                    <span className="truncate">{member.name}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { UserSelector }
