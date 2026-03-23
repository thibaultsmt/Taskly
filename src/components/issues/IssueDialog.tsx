import * as React from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, Check, ChevronDown } from "lucide-react"
import { createIssue, updateIssue, issuesQueryOptions } from "#/server/issues"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "#/components/ui/dialog"
import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"
import { Textarea } from "#/components/ui/textarea"
import { Label } from "#/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover"
import { UserSelector } from "#/components/shared/user-selector"
import { DateSubPanel, formatDate, startOfDay } from "#/components/shared/date-picker"
import { LabelBadge } from "#/components/shared/label-badge"
import { cn } from "#/lib/utils"
import { sileo } from "sileo"

const issueSchema = z.object({
  title: z.string().min(1, "Le titre est requis").max(255, "Titre trop long"),
  description: z.string().optional(),
  workflowStateId: z.string().min(1, "L'état est requis"),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]).default("none"),
  projectId: z.string().optional(),
  assigneeMemberId: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  estimate: z.coerce.number().int().min(0).nullable().optional(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
})

type IssueFormValues = z.infer<typeof issueSchema>

interface WorkflowState {
  id: string
  name: string
  type: string
  color: string
}

interface TeamLabel {
  id: string
  name: string
  color: string
}

interface TeamMember {
  id: string
  userId: string
  userName: string
  userEmail: string
  image?: string | null
}

interface Project {
  id: string
  name: string
}

interface Team {
  workflowStates: WorkflowState[]
  labels: TeamLabel[]
  members: TeamMember[]
  projects: Project[]
}

interface IssueLabel {
  id: string
  labelId: string
  label: {
    id: string
    name: string
    color: string
  }
}

interface Issue {
  id: string
  title: string
  description?: string | null
  number: number
  priority: string
  workflowStateId: string
  assignee?: string | null
  projectId?: string | null
  labels?: IssueLabel[]
  estimate?: number | null
  startDate?: string | Date | null
  dueDate?: string | Date | null
}

interface IssueDialogProps {
  mode: "create" | "edit"
  issue?: Issue
  teamId: string
  team: Team
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultProjectId?: string
}

const PRIORITIES: { value: IssueFormValues["priority"]; label: string }[] = [
  { value: "none", label: "Aucune priorité" },
  { value: "low", label: "Faible" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Haute" },
  { value: "urgent", label: "Urgente" },
]

function LabelMultiSelect({
  teamLabels,
  value,
  onChange,
}: {
  teamLabels: TeamLabel[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = React.useState(false)

  function toggleLabel(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  const selectedLabels = teamLabels.filter((l) => value.includes(l.id))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-muted cursor-pointer">
        {selectedLabels.length === 0 ? (
          <span className="text-muted-foreground">Sélectionner des labels</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selectedLabels.slice(0, 3).map((l) => (
              <LabelBadge key={l.id} name={l.name} color={l.color} />
            ))}
            {selectedLabels.length > 3 && (
              <span className="text-xs text-muted-foreground">+{selectedLabels.length - 3}</span>
            )}
          </div>
        )}
        <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {teamLabels.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">Aucun label disponible</p>
        ) : (
          teamLabels.map((label) => {
            const checked = value.includes(label.id)
            return (
              <button
                key={label.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted cursor-pointer",
                )}
                onClick={() => toggleLabel(label.id)}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
                  )}
                >
                  {checked && <Check className="size-3" />}
                </span>
                <LabelBadge name={label.name} color={label.color} />
              </button>
            )
          })
        )}
      </PopoverContent>
    </Popover>
  )
}

function IssueDialog({ mode, issue, teamId, team, open, onOpenChange, defaultProjectId }: IssueDialogProps) {
  const queryClient = useQueryClient()

  function toastFill() {
    return document.documentElement.classList.contains("dark") ? "#1a1a1a" : "#f9f9f9"
  }

  const [createMore, setCreateMore] = React.useState(false)

  // Map members for UserSelector — value tracked as member.id, but we save userName
  const selectorMembers = team.members.map((m) => ({
    id: m.id,
    name: m.userName,
    email: m.userEmail,
    image: m.image,
  }))

  // When editing, find the member whose userName matches issue.assignee
  const defaultAssigneeMemberId =
    mode === "edit" && issue?.assignee
      ? (team.members.find((m) => m.userName === issue.assignee)?.id ?? null)
      : null

  const defaultLabelIds =
    mode === "edit" && issue?.labels ? issue.labels.map((il) => il.labelId) : []

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<IssueFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(issueSchema) as any,
    defaultValues: {
      title: mode === "edit" ? (issue?.title ?? "") : "",
      description: mode === "edit" ? (issue?.description ?? "") : "",
      workflowStateId: mode === "edit" ? (issue?.workflowStateId ?? "") : (team.workflowStates[0]?.id ?? ""),
      priority: mode === "edit" ? ((issue?.priority as IssueFormValues["priority"]) ?? "none") : "none",
      projectId: mode === "edit" ? (issue?.projectId ?? undefined) : (defaultProjectId ?? undefined),
      assigneeMemberId: defaultAssigneeMemberId,
      labelIds: defaultLabelIds,
      estimate: mode === "edit" ? (issue?.estimate ?? null) : null,
      startDate: mode === "edit" ? (issue?.startDate ? new Date(issue.startDate as string).toISOString().slice(0, 10) : null) : null,
      dueDate: mode === "edit" ? (issue?.dueDate ? new Date(issue.dueDate as string).toISOString().slice(0, 10) : null) : null,
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: {
      title: string
      description?: string
      workflowStateId: string
      priority: string
      projectId?: string
      assignee?: string
      estimate?: number
      startDate?: string | null
      dueDate?: string | null
    }) => createIssue({ data: { teamId, ...data } }),
    onSuccess: () => {
      sileo.success({
        title: "Issue créée",
        description: "Elle rejoint officiellement le backlog. Courage.",
        fill: toastFill(),
      })
    },
    onError: () => {
      sileo.error({
        title: "Raté",
        description: "L'issue refuse de naître. Réessayez.",
        fill: toastFill(),
      })
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: issuesQueryOptions(teamId).queryKey })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: issuesQueryOptions(teamId).queryKey })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: {
      issueId: string
      title?: string
      description?: string
      workflowStateId?: string
      priority?: string
      projectId?: string
      assignee?: string
      estimate?: number
      startDate?: string | null
      dueDate?: string | null
    }) => updateIssue({ data }),
    onSuccess: () => {
      sileo.success({
        title: "Issue mise à jour",
        description: "Modifiée. Comme si ce n'était jamais arrivé.",
        fill: toastFill(),
      })
    },
    onError: () => {
      sileo.error({
        title: "Raté",
        description: "La mise à jour a échoué. L'issue résiste.",
        fill: toastFill(),
      })
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: issuesQueryOptions(teamId).queryKey })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: issuesQueryOptions(teamId).queryKey })
    },
  })

  function onSubmit(values: IssueFormValues) {
    // Resolve assignee name from member id
    const assigneeName = values.assigneeMemberId
      ? team.members.find((m) => m.id === values.assigneeMemberId)?.userName
      : undefined

    const payload = {
      title: values.title,
      description: values.description || undefined,
      workflowStateId: values.workflowStateId,
      priority: values.priority,
      projectId: values.projectId || undefined,
      assignee: assigneeName,
      estimate: values.estimate ?? undefined,
      startDate: values.startDate || null,
      dueDate: values.dueDate || null,
    }

    if (mode === "create") {
      createMutation.mutate(payload, {
        onSuccess: () => {
          if (!createMore) {
            onOpenChange(false)
          } else {
            reset({
              title: "",
              description: "",
              workflowStateId: values.workflowStateId,
              priority: values.priority,
              projectId: values.projectId,
              assigneeMemberId: null,
              labelIds: [],
              estimate: null,
              startDate: null,
              dueDate: null,
            })
          }
        },
      })
    } else if (issue) {
      updateMutation.mutate(
        { issueId: issue.id, ...payload },
        {
          onSuccess: () => {
            onOpenChange(false)
          },
        },
      )
    }
  }

  const watchedStartDate = watch("startDate")
  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg gap-5">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nouvelle issue" : `Modifier l'issue`}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit as Parameters<typeof handleSubmit>[0])} className="flex flex-col gap-5">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              placeholder="Titre de l'issue"
              aria-invalid={!!errors.title}
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Description optionnelle…"
              rows={3}
              {...register("description")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* WorkflowState */}
            <div className="flex flex-col gap-1.5">
              <Label>État</Label>
              <Controller
                name="workflowStateId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(val: string) => {
                          const ws = team.workflowStates.find((s) => s.id === val)
                          if (!ws) return <span className="text-muted-foreground">Sélectionner un état</span>
                          return (
                            <span className="flex items-center gap-2">
                              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: ws.color }} />
                              {ws.name}
                            </span>
                          )
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {team.workflowStates.map((ws) => (
                        <SelectItem key={ws.id} value={ws.id}>
                          <span className="flex items-center gap-2">
                            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: ws.color }} />
                            {ws.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1.5">
              <Label>Priorité</Label>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(val: string) => {
                          const p = PRIORITIES.find((x) => x.value === val)
                          return p?.label ?? <span className="text-muted-foreground">Priorité</span>
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Project */}
          {team.projects.length > 0 && !defaultProjectId && (
            <div className="flex flex-col gap-1.5">
              <Label>Projet</Label>
              <Controller
                name="projectId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(val: string) => {
                          if (!val || val === "__none__") return <span className="text-muted-foreground">Aucun projet</span>
                          const p = team.projects.find((x) => x.id === val)
                          return p?.name ?? <span className="text-muted-foreground">Aucun projet</span>
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun projet</SelectItem>
                      {team.projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {/* Assignee */}
          <div className="flex flex-col gap-1.5">
            <Label>Assigné</Label>
            <Controller
              name="assigneeMemberId"
              control={control}
              render={({ field }) => (
                <UserSelector
                  members={selectorMembers}
                  value={field.value ?? null}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          {/* Labels */}
          {team.labels.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Labels</Label>
              <Controller
                name="labelIds"
                control={control}
                render={({ field }) => (
                  <LabelMultiSelect
                    teamLabels={team.labels}
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          )}

          {/* Estimate */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="estimate">Estimation (points)</Label>
            <Input
              id="estimate"
              type="number"
              min={0}
              placeholder="0"
              className="w-32"
              {...register("estimate")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Date de début</Label>
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => {
                  const dateVal = field.value ? new Date(field.value) : null
                  return (
                    <Popover>
                      <PopoverTrigger className="inline-flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-muted cursor-pointer text-left">
                        <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className={dateVal ? "" : "text-muted-foreground"}>
                          {dateVal ? formatDate(dateVal) : "JJ/MM/AAAA"}
                        </span>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 overflow-hidden w-auto" align="start">
                        <DateSubPanel
                          value={dateVal}
                          onSelect={(d) => field.onChange(d ? startOfDay(d).toISOString() : null)}
                          clearable={!!dateVal}
                        />
                      </PopoverContent>
                    </Popover>
                  )
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Échéance</Label>
              <Controller
                name="dueDate"
                control={control}
                render={({ field }) => {
                  const dateVal = field.value ? new Date(field.value) : null
                  const today = startOfDay(new Date())
                  const startParsed = watchedStartDate ? startOfDay(new Date(watchedStartDate)) : null
                  const minDate = startParsed && startParsed > today ? startParsed : today
                  return (
                    <Popover>
                      <PopoverTrigger className="inline-flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-muted cursor-pointer text-left">
                        <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className={dateVal ? "" : "text-muted-foreground"}>
                          {dateVal ? formatDate(dateVal) : "JJ/MM/AAAA"}
                        </span>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 overflow-hidden w-auto" align="start">
                        <DateSubPanel
                          value={dateVal}
                          onSelect={(d) => field.onChange(d ? startOfDay(d).toISOString() : null)}
                          clearable={!!dateVal}
                          minDate={minDate}
                        />
                      </PopoverContent>
                    </Popover>
                  )
                }}
              />
            </div>
          </div>

          <DialogFooter>
            {mode === "create" && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer mr-auto">
                <input
                  type="checkbox"
                  checked={createMore}
                  onChange={(e) => setCreateMore(e.target.checked)}
                  className="size-4 rounded border-input"
                />
                Créer encore
              </label>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "En cours…"
                : mode === "create"
                  ? "Créer"
                  : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { IssueDialog }
