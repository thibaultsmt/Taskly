# Agent 2 — Shared UI Components

## Contexte
Construire tous les composants partagés réutilisables dans `src/components/`. Ces composants seront utilisés par toutes les pages de l'app.

## Composants à créer

### `src/components/ui/spinner.tsx`
```tsx
// Simple spinner SVG animé
// Usage: <Spinner className="h-4 w-4" />
```

### `src/components/ui/skeletons.tsx`
```tsx
// Utiliser le composant Skeleton de shadcn/ui (src/components/ui/skeleton.tsx)
export function IssueListSkeleton()    // ~5 lignes skeleton
export function IssueBoardSkeleton()   // 3 colonnes avec cartes skeleton
export function IssueTableSkeleton()   // Table avec ~5 rows skeleton
export function ProjectListSkeleton()
export function StatCardSkeleton()
export function MemberListSkeleton()
```

### `src/components/shared/priority-icon.tsx`
```tsx
// Affiche une icône colorée selon la priorité
// Props: priority: "NO_PRIORITY" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"
// Couleurs: NO_PRIORITY=gray, LOW=blue, MEDIUM=yellow, HIGH=orange, URGENT=red
// Icônes Lucide: Minus, ChevronDown, ChevronUp, ArrowUp, AlertCircle (ou similaires)
```

### `src/components/shared/status-badge.tsx`
```tsx
// Badge coloré selon le type de workflow state
// Props: type: "backlog"|"unstarted"|"started"|"completed"|"canceled", name: string
// Couleurs: backlog=gray, unstarted=gray, started=blue, completed=green, canceled=red
// Affiche un point coloré + le nom
```

### `src/components/shared/label-badge.tsx`
```tsx
// Badge coloré pour une label
// Props: name: string, color: string (hex)
// Affiche un point de la couleur + le nom
// Petit, utilisable en liste
```

### `src/components/shared/user-avatar.tsx`
```tsx
// Avatar utilisateur avec fallback initiales
// Props: name?: string, image?: string, size?: "sm"|"md"|"lg"
// Utilise Avatar de shadcn/ui
```

### `src/components/shared/assignee-avatar.tsx`
```tsx
// Wrapper de UserAvatar pour les assignees d'issues
// Props: assignee?: { name: string, email: string, user?: { image?: string } } | null
// Si null: affiche un cercle gris avec "?" (non assigné)
// Tooltip au hover avec le nom
```

### `src/components/shared/view-switcher.tsx`
```tsx
// Toggle list/board/table view
// Props: currentView: "list"|"board"|"table", onChange: (view) => void, available?: views[]
// 3 boutons icônes: List, Columns2, Table2
// Bouton actif avec bg highlighted
```

### `src/components/shared/filter-bar.tsx`
```tsx
// Barre de filtres avec dropdowns
// Props: filters, onFilterChange, workflowStates, labels, members, projects
// Affiche: "Filtres (N)" si filtres actifs, badge count
// Dropdowns: Status, Priority, Assignee, Project, Label
// Bouton "Clear" si filtres actifs
// Chaque dropdown: liste checkable avec couleurs

interface Filters {
  workflowStateIds?: string[]
  priorities?: Priority[]
  assigneeIds?: string[]
  projectIds?: string[]
  labelIds?: string[]
  search?: string
}
```

### `src/components/shared/actions-menu.tsx`
```tsx
// DropdownMenu avec actions contextuelles
// Props: actions: Array<{ label, icon?, onClick, variant?: "destructive" }>
// Trigger: button avec MoreHorizontal icon (apparaît au hover)
// Utilise DropdownMenu de shadcn/ui
```

### `src/components/shared/user-selector.tsx`
```tsx
// Sélecteur de membre d'équipe
// Props: members, value, onChange, placeholder?
// Dropdown avec search input
// Affiche avatar + nom de chaque membre
// Option "Unassigned" en premier
// Utilise Popover + Command de shadcn/ui
```

### `src/components/shared/command-palette.tsx`
```tsx
// Palette de commandes (Cmd+K / Ctrl+K)
// S'ouvre via Dialog
// Actions disponibles:
//   - Créer une issue (ouvre IssueDialog en mode CREATE)
//   - Créer un projet (ouvre ProjectDialog)
//   - Naviguer vers Issues / Projects / Management / People
// Input de recherche qui filtre les actions
// Navigation clavier (flèches, enter, escape)
// Affiche icônes et raccourcis
// Props: teamId, open, onOpenChange, onAction(actionId)
```

### `src/components/shared/api-key-dialog.tsx`
```tsx
// Dialog pour configurer la Groq API key d'une équipe
// Props: teamId, currentKey?, open, onOpenChange
// Input masqué (type="password") avec toggle show/hide
// Bouton sauvegarder → updateTeam({ groqApiKey })
// Bouton supprimer la clé
// Info: "Votre clé est chiffrée et stockée de manière sécurisée"
```

## Règles importantes
- Tous les composants en TypeScript strict
- Utiliser les composants shadcn/ui existants dans `src/components/ui/`
- Icônes via `lucide-react`
- Classes Tailwind v4 (pas de config, classes inline)
- Pas de console.log, pas de commentaires inutiles
- Export nommé pour chaque composant

## Shadcn/ui disponibles
Les fichiers suivants existent déjà dans `src/components/ui/`:
avatar, badge, button, card, command, dialog, dropdown-menu, input, input-group, label, popover, scroll-area, select, separator, sheet, skeleton, sonner, table, textarea, tooltip

## Résultat attendu
Tous les composants ci-dessus créés dans `src/components/shared/` et `src/components/ui/`.
Chaque composant doit être importable et fonctionnel, prêt à être utilisé par les pages.
