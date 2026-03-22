# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server on port 3000 (web)
npm run build        # Build client + server bundles
npm run preview      # Preview production build
npm run test         # Run Vitest tests (vitest run)

# Tauri desktop app
npx tauri dev        # Start Tauri app (auto-starts npm run dev)
npx tauri build      # Build Tauri desktop bundle

# Database
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma db push   # Push schema to database without migration
npx prisma migrate dev --name <name>  # Create and apply a migration
npx prisma studio    # Open Prisma Studio GUI

# TypeScript
npx tsc --noEmit     # Type-check without emitting files
```

## Architecture

### Stack
- **TanStack Start** (Vite-based SSR meta-framework, v1.167+) — not Next.js
- **TanStack Router** (file-based routing) — routes auto-generated into `src/routeTree.gen.ts`
- **TanStack Query v5** — server state, `useSuspenseQuery` in route loaders
- **Better Auth v1.5** — Google OAuth, session management
- **Prisma 6 + PostgreSQL** (Supabase) — ORM
- **Tauri v2** — desktop app wrapper, webview points to `http://localhost:3000`
- **AI SDK** — streaming chat via Groq (`llama-3.3-70b-versatile`)
- **Tailwind v4 + shadcn/ui** (customized, in `src/components/ui/`)

### Request flow

All HTTP requests enter through `src/app.server.ts` (the custom server entry):
1. `/api/auth/*` → forwarded to `auth.handler(request)` (Better Auth)
2. `/api/teams/:id/chat` POST → streamed via AI SDK + Groq
3. Everything else → TanStack Start's `createStartHandler(defaultStreamHandler)`

The TanStack Start Vite plugin is configured in `vite.config.ts` with `tanstackStart({ server: { entry: "./app.server.ts" } })`. The client entry is `src/entry-client.tsx` which calls `hydrateRoot` with `<StartClient />`. The `@vitejs/plugin-react` plugin must come **after** `tanstackStart()` in the plugins array.

### Router setup

`src/router.tsx` exports `getRouter()`, which creates the router with `queryClient` as context. This context flows into every route via `Route.useRouteContext()`. The root route (`src/routes/__root.tsx`) wraps everything in `QueryClientProvider` and `Toaster`.

Route layouts follow this hierarchy:
```
__root.tsx            → QueryClientProvider, Toaster
  /_auth/login.tsx    → public, redirects to /teams if session exists
  /_app/route.tsx     → auth guard (redirects to /login if no session), TaskGateWrapper
    /teams/index.tsx
    /teams/$teamId/route.tsx  → team shell layout (sidebar, header, chat)
      /issues/
      /projects/
        /$projectId/  → Kanban board (IssueBoard) + table view
      /tasks/
      /management/
      /people/
  /invite/$invitationId/
```

### Server functions pattern

All data access uses `createServerFn` from `@tanstack/react-start`. Every server file in `src/server/` follows the same pattern:

```typescript
// Local session helper (repeated in each server file)
async function getSession() {
  const request = getRequest()         // from @tanstack/start-server-core
  if (!request) return null
  return auth.api.getSession({ headers: request.headers })
}

// Server function with input validation
export const myFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))   // use .inputValidator(), NOT .validator()
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error("Unauthenticated")
    return prisma.something.findMany(...)
  })

// Query options for TanStack Query
export const myQueryOptions = queryOptions({
  queryKey: ["key"],
  queryFn: () => myFn(),
})
```

Route loaders call `queryClient.ensureQueryData(queryOptions)` and components use `useSuspenseQuery`.

### Auth

- **Server**: `src/lib/auth.ts` — `betterAuth()` with explicit `baseURL` and `trustedOrigins`
- **Client**: `src/lib/auth-client.ts` — `createAuthClient({ baseURL: import.meta.env.VITE_APP_URL })`
- **Session check (server)**: `src/server/auth.ts` — `getSession` server function using `auth.api.getSession`
- **Session check (client)**: `authClient.useSession()` React hook
- Google OAuth callback is `http://localhost:3000/api/auth/callback/google`

### Tauri-specific

- Dev: Tauri webview loads `http://localhost:3000` (same as web, same OAuth flow)
- `src-tauri/tauri.conf.json`: `devUrl` = `http://localhost:3000`, `frontendDist` = `../dist/client`
- Tauri events (`@tauri-apps/api/event`) **must always be dynamically imported** inside `useEffect` with a `window.__TAURI__` guard — never statically imported at the top level (breaks SSR/non-Tauri hydration)
- Screen unlock events are emitted by `src-tauri/src/lock_listener.rs` as `"screen-unlocked"`, consumed by `src/hooks/useLockEvent.ts`

### TaskGate (Tauri-specific feature)

`TaskGateWrapper` (rendered in `_app/route.tsx`, only for authenticated routes) blocks the UI with `TaskGateModal` until the user has created daily tasks. It re-checks on screen unlock via `useLockEvent`. This feature only triggers when `hasTodayTasks()` returns false.

### Path aliases

- `#/*` → `./src/*` (configured in `package.json` `imports` and `tsconfig.json` `paths`)
- `@/*` → `./src/*` (alias in `tsconfig.json`)

### UI components

Components in `src/components/ui/` are shadcn/ui based but customized. Use existing components rather than installing new shadcn ones — the Button component in particular has custom `size` variants (`icon-sm`, etc.) and uses `@base-ui/react` primitives for some components (Tooltip, DropdownMenu use `@base-ui/react`).

**@base-ui specifics:**
- `TooltipTrigger` does **not** support `asChild` — wrap content as children directly
- `DropdownMenuTrigger` forwards `className` via `...props`
- `TooltipProvider` default `delay=0` — tooltips appear immediately

**Hover slide-in button pattern** (used in IssueCard, IssueList, TaskRow):
```tsx
// Container needs `group` class. Button slides in from right, pushing sibling left.
<div className="overflow-hidden w-0 group-hover:w-[22px] transition-all duration-150 shrink-0">
  <div className="w-[22px] flex items-center justify-center">
    <button>...</button>
  </div>
</div>
```

**Custom select styling** (sort dropdowns):
```tsx
<div className="relative inline-flex h-7 items-center">
  <select className="h-7 appearance-none rounded-md border border-input bg-background pl-2.5 pr-7 text-xs outline-none hover:bg-muted cursor-pointer">
    ...
  </select>
  <ChevronDown className="pointer-events-none absolute right-2 size-3 text-muted-foreground" />
</div>
```

### Shared date picker

`src/components/shared/date-picker.tsx` exports `DateSubPanel` (text input + mini calendar), `MiniCalendar`, `formatDate` (DD/MM/YYYY), `parseDate`, `startOfDay`. Use this in any form needing a date picker — wrap in a `<Popover>` for dialogs or `<DropdownMenuSubContent>` for dropdowns.

### Date handling

- Prisma returns `Date` objects; TanStack Start serializes them to ISO strings over the wire → always type date fields as `string | Date` (not just `Date`)
- Use `z.string()` not `z.string().datetime()` in server function validators for date fields — `.datetime()` rejects valid ISO strings with timezone offsets
- `dueDate` min constraint pattern: `max(startOfDay(new Date()), startOfDay(startDate))` — same logic in both tasks and IssueDialog

## Environment variables

Required in `.env`:
```
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
DATABASE_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
VITE_APP_URL=http://localhost:3000
GROQ_API_KEY=
```

`VITE_*` prefixed vars are exposed to the client bundle. Non-prefixed vars are server-only and available via `process.env` in server functions and `app.server.ts`.
