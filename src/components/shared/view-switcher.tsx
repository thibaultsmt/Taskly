import { List, Columns2, Table2, LayoutList } from "lucide-react"
import { Button } from "#/components/ui/button"
import { cn } from "#/lib/utils"

type View = "list" | "by-status" | "board" | "table"

interface ViewSwitcherProps {
  currentView: View
  onChange: (view: View) => void
  available?: View[]
}

const viewOptions: { id: View; icon: React.ElementType; label: string }[] = [
  { id: "list", icon: List, label: "Liste" },
  { id: "by-status", icon: LayoutList, label: "Par statut" },
  { id: "board", icon: Columns2, label: "Board" },
  { id: "table", icon: Table2, label: "Table" },
]

function ViewSwitcher({ currentView, onChange, available }: ViewSwitcherProps) {
  const options = available
    ? viewOptions.filter((v) => available.includes(v.id))
    : viewOptions

  return (
    <div className="flex items-center gap-0.5 rounded-lg border bg-muted/30 p-0.5">
      {options.map(({ id, icon: Icon, label }) => (
        <Button
          key={id}
          variant={currentView === id ? "secondary" : "ghost"}
          size="icon-sm"
          onClick={() => onChange(id)}
          aria-label={label}
          aria-pressed={currentView === id}
          className={cn(
            currentView === id && "shadow-sm"
          )}
        >
          <Icon className="size-3.5" />
        </Button>
      ))}
    </div>
  )
}

export { ViewSwitcher, type View }
