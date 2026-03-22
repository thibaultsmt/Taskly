import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar"

type AvatarSize = "sm" | "md" | "lg"

interface UserAvatarProps {
  name?: string
  image?: string
  size?: AvatarSize
  className?: string
}

function getInitials(name?: string): string {
  if (!name) return "?"
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

const sizeMap: Record<AvatarSize, "sm" | "default" | "lg"> = {
  sm: "sm",
  md: "default",
  lg: "lg",
}

function UserAvatar({ name, image, size = "md", className }: UserAvatarProps) {
  return (
    <Avatar size={sizeMap[size]} className={className}>
      {image && <AvatarImage src={image} alt={name ?? "User"} />}
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  )
}

export { UserAvatar, getInitials }
