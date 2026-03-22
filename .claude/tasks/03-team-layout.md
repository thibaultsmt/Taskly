# Agent 3 — Team Layout & Navigation

## Contexte
Reconstruire le layout complet de la section team (`/_app/teams/$teamId`) avec sidebar, header, navigation, et intégration du chat AI.

## Fichiers à modifier/créer

### `src/routes/_app/teams/$teamId/route.tsx` — REFAIRE COMPLÈTEMENT

Layout attendu (desktop):
```
┌─────────────┬──────────────────────────────────────┐
│  SIDEBAR    │  HEADER                               │
│  (240px)    │  [Breadcrumb]   [Chat] [Avatar]        │
│  ─────────  ├──────────────────────────────────────┤
│  Issues     │                                       │
│  Projects   │  <Outlet />                           │
│  ─────────  │                                       │
│  Mgmt       │                                       │
│  People     │                                       │
│  ─────────  │                                       │
│  [API Key]  │                                       │
└─────────────┴──────────────────────────────────────┘
```

Mobile: sidebar en Sheet (drawer) avec bouton hamburger dans le header.

```tsx
// src/routes/_app/teams/$teamId/route.tsx
import { createFileRoute, Outlet, Link, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { teamQueryOptions } from "../../../../server/teams"
import { useQueryClient } from "@tanstack/react-query"

export const Route = createFileRoute("/_app/teams/$teamId")({
  loader: ({ context: { queryClient }, params: { teamId } }) =>
    queryClient.ensureQueryData(teamQueryOptions(teamId)),
  component: TeamLayout,
})

function TeamLayout() {
  const { teamId } = Route.useParams()
  const team = Route.useLoaderData()
  const [sidebarOpen, setSidebarOpen] = useState(true)  // desktop
  const [mobileOpen, setMobileOpen] = useState(false)   // mobile
  const [chatOpen, setChatOpen] = useState(false)
  const [apiKeyOpen, setApiKeyOpen] = useState(false)

  // Sidebar nav items
  const navItems = [
    { to: "/teams/$teamId/issues", icon: Files, label: "Issues" },
    { to: "/teams/$teamId/projects", icon: FolderOpen, label: "Projects" },
    { to: "/teams/$teamId/management", icon: BarChart2, label: "Management" },
    { to: "/teams/$teamId/people", icon: Users, label: "People" },
  ]

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar desktop */}
      <TeamSidebar
        team={team}
        navItems={navItems}
        collapsed={!sidebarOpen}
        onApiKey={() => setApiKeyOpen(true)}
      />

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left">
          <TeamSidebar ... />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TeamHeader
          team={team}
          onMenuToggle={() => setSidebarOpen(v => !v)}
          onMobileMenu={() => setMobileOpen(true)}
          onChat={() => setChatOpen(true)}
        />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Chat sidebar */}
      <ChatSheet teamId={teamId} open={chatOpen} onOpenChange={setChatOpen} />

      {/* API Key dialog */}
      <ApiKeyDialog teamId={teamId} open={apiKeyOpen} onOpenChange={setApiKeyOpen} />
    </div>
  )
}
```

### TeamSidebar component (dans le même fichier ou `src/components/layout/TeamSidebar.tsx`)
- Logo/nom de l'équipe en haut avec badge du key (ex: "ENG")
- Liste des nav items avec icônes
- NavLink actif highlighted
- Version collapsed: icônes seulement + tooltip
- En bas: bouton "API Key" avec icône clé + badge si clé configurée

### TeamHeader component
- Bouton toggle sidebar (desktop, icône panel-left)
- Bouton hamburger (mobile seulement)
- Breadcrumb: Team Name > Page Name
- Bouton "Chat" avec icône MessageSquare + raccourci Cmd+K
- Avatar utilisateur avec DropdownMenu:
  - Email de l'user
  - Séparateur
  - "Sign out" → `authClient.signOut()`

### `src/components/chat/ChatSheet.tsx` — NOUVEAU
```tsx
// Sheet (drawer) côté droit pour le chat AI
// Props: teamId, open, onOpenChange
// Utilise le endpoint /api/teams/$teamId/-chat.ts
// useChat hook de 'ai/react' (Vercel AI SDK)
// Messages avec rôle user/assistant stylés différemment
// Input en bas avec bouton envoyer
// Bouton clear conversation
// Si apiKey custom → l'inclure dans les headers
// Écouter les events Tauri: refresh-issues, refresh-projects
//   → invalider les queries concernées
```

## Convention de routing TanStack
```ts
// Pour les liens dans la sidebar:
<Link
  to="/teams/$teamId/issues"
  params={{ teamId }}
  activeProps={{ className: "bg-accent text-accent-foreground" }}
>
```

## Keyboard shortcut global (Cmd+K)
Dans `TeamLayout`, ajouter un `useEffect` qui écoute `keydown`:
```ts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault()
      setChatOpen(v => !v)  // ou ouvrir command palette
    }
  }
  window.addEventListener("keydown", handler)
  return () => window.removeEventListener("keydown", handler)
}, [])
```

## Auth client
```ts
// src/lib/auth-client.ts exporte:
import { authClient } from "../../lib/auth-client"
// authClient.signOut() pour le sign out
// authClient.useSession() pour la session
```

## Résultat attendu
- Layout complet avec sidebar collapsible
- Navigation active highlighting
- Header avec user menu + chat toggle
- Chat AI fonctionnel (streaming)
- Keyboard shortcut Cmd+K
- Responsive (mobile drawer)
- API Key dialog intégré
