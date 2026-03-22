import { IssueRow } from "#/components/issues/IssueList"

interface WorkflowState {
  id: string
  name: string
  type: string
  color: string
  position: number
}

interface IssueLabel {
  id: string
  label: {
    id: string
    name: string
    color: string
  }
}

interface Issue {
  id: string
  title: string
  number: number
  priority: string
  assignee?: string | null
  workflowStateId: string
  workflowState?: WorkflowState | null
  labels?: IssueLabel[]
  project?: { id: string; name: string } | null
  dueDate?: Date | string | null
}

interface Team {
  key: string
}

interface IssueFlatListProps {
  issues: Issue[]
  team: Team
  onEdit: (issue: Issue) => void
  onDelete: (issueId: string) => void
  onView?: (issue: Issue) => void
}

function IssueFlatList({ issues, team, onEdit, onDelete, onView }: IssueFlatListProps) {
  const sorted = [...issues].sort((a, b) => b.number - a.number)
  return (
    <div>
      {sorted.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Aucune issue</div>
      ) : (
        sorted.map((issue) => (
          <IssueRow key={issue.id} issue={issue} teamKey={team.key} onEdit={onEdit} onDelete={onDelete} onView={onView} />
        ))
      )}
    </div>
  )
}

export { IssueFlatList }
