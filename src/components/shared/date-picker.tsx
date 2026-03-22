import * as React from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { cn } from "#/lib/utils"

const MONTH_NAMES = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
const DAY_NAMES = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"]

export function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}

export function parseDate(s: string): Date | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const day = Number(m[1]), month = Number(m[2]), year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(year, month - 1, day)
  if (d.getDate() !== day || d.getMonth() !== month - 1) return null
  return d
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function MiniCalendar({
  value,
  onSelect,
  minDate,
}: {
  value: Date | null
  onSelect: (d: Date) => void
  minDate?: Date
}) {
  const [view, setView] = React.useState(() => {
    const base = value ?? new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const year = view.getFullYear()
  const month = view.getMonth()
  const today = startOfDay(new Date())
  const minNorm = minDate ? startOfDay(minDate) : undefined

  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const pad = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < pad; i++) cells.push(null)
  for (let i = 1; i <= daysInMonth; i++) cells.push(i)

  return (
    <div className="p-2 w-52 select-none">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setView(new Date(year, month - 1, 1))}
          className="p-0.5 rounded hover:bg-accent cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="text-xs font-medium">{MONTH_NAMES[month]} {year}</span>
        <button
          type="button"
          onClick={() => setView(new Date(year, month + 1, 1))}
          className="p-0.5 rounded hover:bg-accent cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[10px] text-muted-foreground py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const date = new Date(year, month, day)
          const dateNorm = startOfDay(date)
          const disabled = minNorm ? dateNorm < minNorm : false
          const selected = value && startOfDay(value).getTime() === dateNorm.getTime()
          const isToday = dateNorm.getTime() === today.getTime()
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onSelect(date)}
              className={cn(
                "text-[11px] rounded py-0.5 text-center transition-colors cursor-pointer",
                selected && "bg-primary text-primary-foreground",
                !selected && isToday && "bg-accent text-accent-foreground font-medium",
                !selected && !disabled && "hover:bg-accent hover:text-accent-foreground",
                disabled && "opacity-30 cursor-not-allowed",
              )}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DateSubPanel({
  value,
  onSelect,
  minDate,
  clearable = true,
}: {
  value: Date | null
  onSelect: (d: Date | null) => void
  minDate?: Date
  clearable?: boolean
}) {
  const [text, setText] = React.useState(value ? formatDate(value) : "")
  React.useEffect(() => { setText(value ? formatDate(value) : "") }, [value])

  function commitText(raw: string) {
    if (!raw.trim()) { onSelect(null); return }
    const parsed = parseDate(raw)
    if (!parsed) { setText(value ? formatDate(value) : ""); return }
    if (minDate && startOfDay(parsed) < startOfDay(minDate)) { setText(value ? formatDate(value) : ""); return }
    onSelect(parsed)
  }

  return (
    <div>
      <div className="px-2 pt-2 pb-1.5 border-b flex items-center gap-1">
        <input
          type="text"
          value={text}
          placeholder="JJ/MM/AAAA"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === "Enter") commitText((e.target as HTMLInputElement).value)
          }}
          onBlur={(e) => commitText(e.target.value)}
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
        />
        {clearable && value && (
          <button
            type="button"
            onClick={() => { onSelect(null); setText("") }}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
      <MiniCalendar value={value} onSelect={onSelect} minDate={minDate} />
    </div>
  )
}

export { DateSubPanel, MiniCalendar }
