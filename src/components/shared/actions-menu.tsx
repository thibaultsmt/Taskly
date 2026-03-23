import { MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "#/components/ui/dropdown-menu"

interface Action {
  label: string
  icon?: React.ElementType
  onClick: () => void
  variant?: "default" | "destructive"
  separator?: boolean
}

interface ActionsMenuProps {
  actions: Action[]
  className?: string
  onOpenChange?: (open: boolean) => void
}

function ActionsMenu({ actions, className, onOpenChange }: ActionsMenuProps) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        className={className}
        onClick={(e) => e.stopPropagation()}
        aria-label="Actions"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action, index) => (
          <span key={index}>
            {action.separator && index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              variant={action.variant === "destructive" ? "destructive" : "default"}
              onClick={(e) => {
                e.stopPropagation()
                action.onClick()
              }}
            >
              {action.icon && <action.icon className="size-4" />}
              {action.label}
            </DropdownMenuItem>
          </span>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { ActionsMenu, type Action }
