import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#/components/ui/tooltip"
import { UserAvatar } from "#/components/shared/user-avatar"
import { cn } from "#/lib/utils"

interface Assignee {
  name: string
  email: string
  image?: string | null
  user?: { image?: string | null } | null
}

interface AssigneeAvatarProps {
  assignee?: Assignee | null
  className?: string
}

function AssigneeAvatar({ assignee, className }: AssigneeAvatarProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="cursor-default">
          {assignee ? (
            <UserAvatar
              name={assignee.name}
              image={assignee.image ?? assignee.user?.image ?? undefined}
              size="sm"
              className={className}
            />
          ) : (
            <span
              className={cn(
                "inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground",
                className
              )}
            >
              ?
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent>
          {assignee ? assignee.name : "Non assigné"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { AssigneeAvatar }
