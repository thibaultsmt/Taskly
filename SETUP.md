# Taskly — Setup & TODO

## Lancer le projet

### Web seulement (sans Tauri)
```bash
npm run dev
# → http://localhost:3000
```

### Desktop (Tauri)
```bash
npx tauri dev
# Lance automatiquement `npm run dev` en arrière-plan + ouvre la fenêtre native
```

> Prérequis Tauri : Rust installé (`rustup`). Si pas encore fait : https://tauri.app/start/prerequisites/

---

## TODO

### ✅ 1. Configurer `.env` — DONE
### ✅ 2. Migrer la base de données — DONE (`prisma/migrations/20260321_add_daily_tasks/`)
### ✅ 3. Configurer Google OAuth — DONE (credentials dans `.env`)
### ✅ 4. Identifier Tauri — DONE (`com.taskly.app` + fenêtre 1280×800)
### ✅ 5. macOS lock listener — DONE (`CFNotificationCenter` via `core-foundation-sys`)
### ✅ 6. `tauri-plugin-shell` dans Cargo.lock — DONE (v2.3.5)

---

## Reste à faire

### Resend (optionnel — invitations email)

Si tu veux les invitations email, ajoute dans `.env` :
```env
RESEND_API_KEY="re_..."          # https://resend.com/
RESEND_FROM_EMAIL="noreply@taskly.app"
```
Sans ça, les invitations seront créées en DB mais les emails ne partiront pas.

---

## Structure du projet

```
src/
├── routes/
│   ├── __root.tsx              # Root avec TaskGateWrapper
│   ├── index.tsx               # Landing page
│   ├── _auth/login.tsx         # Login Google OAuth
│   ├── _app/                   # Routes protégées (auth guard)
│   │   └── teams/
│   │       └── $teamId/issues|projects
│   └── api/
│       ├── auth/$.ts           # Better Auth handler
│       └── teams/$teamId/chat.ts  # Streaming AI
├── server/                     # TanStack Start server functions
│   ├── auth.ts
│   ├── daily-tasks.ts          # TaskGate data
│   ├── teams.ts
│   ├── issues.ts
│   ├── projects.ts
│   ├── invitations.ts
│   ├── labels.ts
│   └── workflow-states.ts
├── components/
│   ├── task-gate/
│   │   ├── TaskGateModal.tsx   # Modal bloquant au déverrouillage
│   │   └── TaskGateWrapper.tsx # Wrapper global dans __root.tsx
│   └── ui/                    # Shadcn/ui components
├── hooks/
│   └── useLockEvent.ts        # Écoute "screen-unlocked" depuis Tauri
└── lib/
    ├── auth.ts                # Better Auth config (server)
    ├── auth-client.ts         # Better Auth client
    ├── db.ts                  # Prisma client
    ├── ai.ts                  # Groq / AI SDK
    └── email.ts               # Resend
src-tauri/
└── src/
    ├── lib.rs                 # Entry point Tauri
    └── lock_listener.rs       # CFNotificationCenter (macOS) + WTS (Windows) + D-Bus (Linux)
```
