# Plan de fork Doable — TanStack Start + Tauri v2
> Usage personnel · Lock screen gate · Sous-agents parallèles

---

## Vue d'ensemble

Ce document est découpé en **phases** et **sous-agents**. Chaque sous-agent est une tâche autonome
confiée à une instance Claude séparée. Les phases 0 et 1 sont séquentielles. Les agents au sein
des phases 2 et 3 s'exécutent **en parallèle**. La phase 4 est l'intégration finale.

```
Phase 0 ──► Phase 1 ──┬── Agent A (DB)
                       ├── Agent B (Auth)       } en parallèle
                       ├── Agent C (UI setup)
                       └── Agent D (Tauri Rust)
                             │
Phase 3 ──────────────┬── Agent E (Routes)
                       └── Agent F (Server Fns) } en parallèle
                             │
Phase 4 ──────────────────► Agent G (TaskGate + intégration finale)
```

---

## Stack cible

| Couche | Ancien (Doable) | Nouveau |
|---|---|---|
| Framework | Next.js 15 App Router | **@tanstack/react-start ^1.166** |
| Routeur | Next.js file router | **@tanstack/react-router ^1.166** |
| Build | webpack/turbopack | **Vite 6 + Vinxi** |
| Data fetching | fetch + route handlers | **@tanstack/react-query v5 + server functions** |
| Auth | better-auth 1.x | **better-auth 1.x** (adapté TanStack Start) |
| ORM | Prisma 5 | **Prisma 6** |
| AI | Vercel AI SDK + Groq | **ai ^4 + groq-sdk latest** |
| Styling | Tailwind CSS 3 | **Tailwind CSS v4** |
| UI | Shadcn/ui (Next) | **Shadcn/ui (Vite/TanStack variant)** |
| Desktop | — | **Tauri v2 (@tauri-apps/api ^2)** |
| Formulaires | React Hook Form + Zod | inchangé |

---

## Phase 0 — Scaffolding du nouveau projet (séquentiel, ~30 min)

> **À faire toi-même avant de lancer les agents.** C'est le socle commun.

### 0.1 — Forker le repo

```bash
# Fork sur GitHub, puis :
git clone https://github.com/TON_USERNAME/doable.git doable-personal
cd doable-personal
git checkout -b feat/tanstack-tauri
```

### 0.2 — Supprimer l'ancienne stack Next.js

```bash
# Garder uniquement ces dossiers/fichiers :
# - prisma/
# - .env.local.example
# - .gitignore
# - LICENSE

# Supprimer :
rm -rf app/ components/ hooks/ lib/ public/ scripts/ middleware.ts \
       next.config.mjs postcss.config.mjs tailwind.config.ts \
       components.json tsconfig.json package.json package-lock.json \
       llm.txt prisma.config.ts .eslintrc.json
```

### 0.3 — Initialiser TanStack Start

```bash
npm create tanstack@latest .
# Choisir : React · TypeScript · TanStack Start · TanStack Router
# File-based routing: Oui
# TanStack Query: Oui
```

### 0.4 — Initialiser Tauri v2

```bash
npm install @tauri-apps/api@^2 @tauri-apps/cli@^2
npx tauri init
# App name: doable-personal
# Window title: Doable
# Web assets: ../dist/client
# Dev URL: http://localhost:3000
# Dev command: npm run dev
# Build command: npm run build
```

### 0.5 — Structure de dossiers cible après scaffolding

```
doable-personal/
├── src/
│   ├── routes/                  # TanStack Router (file-based)
│   │   ├── __root.tsx
│   │   ├── index.tsx            # Landing
│   │   ├── _auth/
│   │   │   ├── login.tsx
│   │   │   └── callback.tsx
│   │   ├── _app/
│   │   │   ├── route.tsx        # Layout protégé (auth guard)
│   │   │   ├── teams/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── $teamId/
│   │   │   │   │   ├── route.tsx
│   │   │   │   │   ├── issues/
│   │   │   │   │   │   ├── index.tsx
│   │   │   │   │   │   └── $issueId.tsx
│   │   │   │   │   ├── projects/
│   │   │   │   │   │   ├── index.tsx
│   │   │   │   │   │   └── $projectId.tsx
│   │   │   │   │   └── chat.tsx
│   │   │   └── task-gate.tsx    # NOUVEAU — route bloquante
│   ├── components/
│   │   ├── ui/                  # Shadcn/ui components
│   │   ├── task-gate/           # NOUVEAU
│   │   │   ├── TaskGateModal.tsx
│   │   │   └── DailyTaskForm.tsx
│   │   └── ...                  # Tous les composants migrés
│   ├── hooks/
│   │   ├── useLockEvent.ts      # NOUVEAU — écoute événement Tauri
│   │   └── ...
│   ├── lib/
│   │   ├── auth.ts              # Better Auth config
│   │   ├── db.ts                # Prisma client
│   │   └── ai.ts               # Groq + AI SDK config
│   └── server/                  # TanStack Start server functions
│       ├── auth.ts
│       ├── teams.ts
│       ├── issues.ts
│       ├── projects.ts
│       ├── chat.ts
│       ├── invitations.ts
│       └── daily-tasks.ts       # NOUVEAU
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   └── lock_listener.rs     # NOUVEAU — lock screen listener
│   ├── Cargo.toml
│   └── tauri.conf.json
├── prisma/
│   └── schema.prisma            # + modèle DailyTask
├── vite.config.ts
├── app.config.ts                # TanStack Start config
└── package.json
```

---

## Phase 1 — Base de données (séquentiel, précède les agents A-G)

### Mettre à jour Prisma 6

```bash
npm install prisma@^6 @prisma/client@^6
```

### Nouveau modèle à ajouter dans `prisma/schema.prisma`

```prisma
// Ajouter ce modèle à la fin du fichier existant

model DailyTask {
  id          String    @id @default(cuid())
  userId      String
  content     String
  completed   Boolean   @default(false)
  date        DateTime  @default(now()) @db.Date
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date, content])
  @@index([userId, date])
}

// Dans le modèle User existant, ajouter :
// dailyTasks  DailyTask[]
```

### Migrer

```bash
npx prisma migrate dev --name "add-daily-tasks"
npx prisma generate
```

---

## Phase 2 — Agents parallèles

---

### 🤖 Agent A — Configuration Shadcn/ui pour Vite + Tailwind v4

**Contexte à fournir à Claude :**
> "Je migre un projet Next.js vers TanStack Start (Vite). J'ai déjà le scaffolding TanStack Start.
> Ta mission est de configurer Tailwind CSS v4 et Shadcn/ui pour un projet Vite/TanStack Start."

**Instructions précises :**

1. Installer Tailwind CSS v4 (nouvelle API, pas de `tailwind.config.ts`) :
```bash
npm install tailwindcss@^4 @tailwindcss/vite@^4
```

2. Configurer Vite (`vite.config.ts`) :
```ts
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart(),
  ],
})
```

3. CSS global (`src/styles/globals.css`) — Tailwind v4 utilise `@import` au lieu de directives :
```css
@import "tailwindcss";

@theme {
  /* Reprendre les tokens de l'ancien tailwind.config.ts de Doable */
  --color-background: hsl(0 0% 100%);
  --color-foreground: hsl(222.2 84% 4.9%);
  /* ... etc. (copier depuis l'ancien tailwind.config.ts) */
}
```

4. Initialiser Shadcn/ui pour Vite :
```bash
npx shadcn@latest init
# Style: New York
# Base color: Zinc
# CSS variables: Yes
```

5. Réinstaller tous les composants Shadcn utilisés dans l'original (repérer dans `components/ui/`) :
```bash
npx shadcn@latest add button card dialog dropdown-menu form input \
  label select separator sheet skeleton table tabs textarea toast \
  tooltip badge avatar command popover scroll-area
```

6. Copier les composants custom depuis `components/` vers `src/components/`
   en remplaçant toutes les imports `next/*` :

| Ancien import | Nouvel import |
|---|---|
| `import Link from 'next/link'` | `import { Link } from '@tanstack/react-router'` |
| `import { useRouter } from 'next/navigation'` | `import { useRouter } from '@tanstack/react-router'` |
| `import Image from 'next/image'` | `<img>` standard ou `vite-imagetools` |
| `'use client'` directive | Supprimer (tout est client par défaut avec TanStack) |
| `'use server'` directive | Remplacer par `createServerFn()` (voir Agent F) |

**Livrable :** `vite.config.ts`, `src/styles/globals.css`, `components.json`, tous les composants UI dans `src/components/`.

---

### 🤖 Agent B — Migration Better Auth vers TanStack Start

**Contexte à fournir à Claude :**
> "Je migre Better Auth depuis Next.js App Router vers TanStack Start. L'app est pour usage
> personnel donc un seul utilisateur (moi). J'utilise Google OAuth via Better Auth 1.x."

**Instructions précises :**

1. Mettre à jour Better Auth :
```bash
npm install better-auth@latest
```

2. Créer `src/lib/auth.ts` (adapter depuis l'ancien `lib/auth.ts`) :
```ts
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "./db"

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 jours
  },
  // Usage perso : whitelist ton email Google
  user: {
    additionalFields: {},
  },
})

export type Session = typeof auth.$Infer.Session
```

3. Créer le handler d'auth comme **server function** TanStack Start.
   Dans TanStack Start, les handlers HTTP catch-all s'écrivent dans `src/routes/api/auth/$.ts` :
```ts
// src/routes/api/auth/$.ts
import { createAPIFileRoute } from '@tanstack/react-start/api'
import { auth } from '../../../lib/auth'

export const APIRoute = createAPIFileRoute('/api/auth/$')({
  GET: async ({ request }) => auth.handler(request),
  POST: async ({ request }) => auth.handler(request),
})
```

4. Créer le client auth `src/lib/auth-client.ts` :
```ts
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_APP_URL,
})

export const { useSession, signIn, signOut } = authClient
```

5. Créer le middleware d'auth dans TanStack Start — via `beforeLoad` dans le layout protégé :
```ts
// src/routes/_app/route.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { authClient } from '../../lib/auth-client'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    const session = await context.auth.getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { session }
  },
})
```

6. Configurer le contexte router dans `src/router.tsx` pour passer la session.

**Livrable :** `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/routes/api/auth/$.ts`, layout protégé avec guard.

---

### 🤖 Agent C — Migration Prisma + lib utilitaires

**Contexte à fournir à Claude :**
> "Je migre la couche data d'un projet Next.js vers TanStack Start. Prisma 6, PostgreSQL."

**Instructions précises :**

1. Installer Prisma 6 (déjà fait en Phase 1), créer `src/lib/db.ts` :
```ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

2. Migrer toutes les fonctions de `lib/` (helpers, utils) vers `src/lib/` en supprimant
   les dépendances Next.js (headers(), cookies(), etc.) → utiliser les équivalents
   de TanStack Start server functions.

3. Migrer `lib/ai.ts` vers `src/lib/ai.ts` :
```bash
npm install ai@^4 groq-sdk@latest @ai-sdk/groq@latest
```
```ts
import { createGroq } from '@ai-sdk/groq'

export const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

export const model = groq('llama-3.3-70b-versatile') // GPT-OSS 120B equiv actuel
```

4. Migrer `lib/email.ts` (Resend) vers `src/lib/email.ts` :
```bash
npm install resend@latest
```

**Livrable :** `src/lib/db.ts`, `src/lib/ai.ts`, `src/lib/email.ts`, tous les utils migrés.

---

### 🤖 Agent D — Tauri v2 : setup Rust + lock screen listener

**Contexte à fournir à Claude :**
> "Je configure Tauri v2 (stable) pour une app TanStack Start. Mon objectif principal est de
> détecter quand l'utilisateur déverrouille son PC (Windows/macOS/Linux) et d'émettre un
> événement vers le frontend. Le scaffolding Tauri est déjà fait (src-tauri/ existe)."

**Instructions précises :**

1. Mettre à jour `src-tauri/Cargo.toml` :
```toml
[package]
name = "doable-personal"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["macos-private-api"] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[target.'cfg(target_os = "windows")'.dependencies]
windows = { version = "0.58", features = [
  "Win32_System_RemoteDesktop",
  "Win32_Foundation",
  "Win32_UI_WindowsAndMessaging",
] }

[target.'cfg(target_os = "macos")'.dependencies]
objc2 = "0.5"
objc2-foundation = { version = "0.2", features = ["NSNotificationCenter", "NSWorkspace"] }

[target.'cfg(target_os = "linux")'.dependencies]
dbus = "0.9"
```

2. Créer `src-tauri/src/lock_listener.rs` — listener cross-platform :

```rust
// src-tauri/src/lock_listener.rs
use tauri::{AppHandle, Emitter};

#[derive(Clone, serde::Serialize)]
pub struct UnlockPayload {
    pub timestamp: u64,
}

/// Lance le listener dans un thread séparé.
/// Émet l'événement "screen-unlocked" vers le frontend Tauri.
pub fn start_lock_listener(app: AppHandle) {
    std::thread::spawn(move || {
        #[cfg(target_os = "windows")]
        windows_listener(app);

        #[cfg(target_os = "macos")]
        macos_listener(app);

        #[cfg(target_os = "linux")]
        linux_listener(app);
    });
}

// ─── Windows ───────────────────────────────────────────────────────────────
#[cfg(target_os = "windows")]
fn windows_listener(app: AppHandle) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::RemoteDesktop::{
        WTSRegisterSessionNotification, NOTIFY_FOR_THIS_SESSION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW,
        RegisterClassW, TranslateMessage, CS_HREDRAW, CS_VREDRAW,
        MSG, WINDOW_EX_STYLE, WNDCLASSW, WM_WTSSESSION_CHANGE,
        WTS_SESSION_UNLOCK,
    };

    unsafe {
        // Créer une fenêtre message-only pour recevoir WM_WTSSESSION_CHANGE
        let class_name: Vec<u16> = "DoableLockListener\0".encode_utf16().collect();
        let wc = WNDCLASSW {
            style: CS_HREDRAW | CS_VREDRAW,
            lpfnWndProc: Some(DefWindowProcW),
            lpszClassName: windows::core::PCWSTR(class_name.as_ptr()),
            ..Default::default()
        };
        RegisterClassW(&wc);

        let hwnd = CreateWindowExW(
            WINDOW_EX_STYLE(0),
            windows::core::PCWSTR(class_name.as_ptr()),
            windows::core::PCWSTR::null(),
            windows::Win32::UI::WindowsAndMessaging::WINDOW_STYLE(0),
            0, 0, 0, 0,
            // HWND_MESSAGE (-3) : fenêtre message-only, jamais affichée
            HWND(-3isize),
            None, None, None,
        ).unwrap();

        WTSRegisterSessionNotification(hwnd, NOTIFY_FOR_THIS_SESSION).unwrap();

        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).into() {
            if msg.message == WM_WTSSESSION_CHANGE {
                // wparam == WTS_SESSION_UNLOCK (8)
                if msg.wParam.0 as u32 == WTS_SESSION_UNLOCK {
                    emit_unlock(&app);
                }
            }
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }
}

// ─── macOS ─────────────────────────────────────────────────────────────────
#[cfg(target_os = "macos")]
fn macos_listener(app: AppHandle) {
    use std::ffi::CString;
    // Écoute la notification distribuée "com.apple.screenIsUnlocked"
    // via NSDistributedNotificationCenter
    // Implémentation via objc2 runtime calls
    unsafe {
        use objc2::runtime::{AnyObject, Sel};
        use objc2::{msg_send, sel};

        let notification_name =
            CString::new("com.apple.screenIsUnlocked").unwrap();

        // Callback appelé par Objective-C NSNotificationCenter
        // On passe l'AppHandle via Box::into_raw pour éviter le move
        let app_ptr = Box::into_raw(Box::new(app.clone()));

        // Observer pattern : dans un vrai projet utiliser block2 crate
        // pour les blocks Objective-C. Version simplifiée avec polling :
        loop {
            std::thread::sleep(std::time::Duration::from_millis(500));
            // Note: implémentation complète requiert block2 + NSDistributedNotificationCenter
            // Voir: https://docs.rs/block2 pour observer pattern complet
            let _ = app_ptr;
        }
    }
}

// ─── Linux ─────────────────────────────────────────────────────────────────
#[cfg(target_os = "linux")]
fn linux_listener(app: AppHandle) {
    // Écoute org.freedesktop.login1.Session "Unlock" signal via D-Bus
    use dbus::blocking::Connection;
    use std::time::Duration;

    let conn = Connection::new_system().expect("Connexion D-Bus échouée");
    let proxy = conn.with_proxy(
        "org.freedesktop.login1",
        "/org/freedesktop/login1/session/auto",
        Duration::from_millis(5000),
    );

    proxy
        .match_signal(
            |_: dbus::message::Message, _: &Connection, _: &dbus::message::Message| {
                emit_unlock(&app);
                true
            },
        )
        .expect("Impossible d'écouter le signal D-Bus");

    loop {
        conn.process(Duration::from_millis(1000)).unwrap();
    }
}

fn emit_unlock(app: &AppHandle) {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    app.emit("screen-unlocked", UnlockPayload { timestamp: ts })
        .expect("Impossible d'émettre l'événement screen-unlocked");
}
```

3. Mettre à jour `src-tauri/src/main.rs` :
```rust
// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod lock_listener;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            lock_listener::start_lock_listener(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

4. Configurer `src-tauri/tauri.conf.json` :
```json
{
  "productName": "doable-personal",
  "version": "0.1.0",
  "identifier": "com.personal.doable",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:3000",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist/client"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "Doable",
        "width": 1280,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"]
  }
}
```

5. Créer le hook TypeScript `src/hooks/useLockEvent.ts` :
```ts
import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'

interface UnlockPayload {
  timestamp: number
}

/**
 * Écoute l'événement "screen-unlocked" émis par Tauri (Rust).
 * Appelle `onUnlock` à chaque déverrouillage du PC.
 */
export function useLockEvent(onUnlock: (timestamp: number) => void) {
  useEffect(() => {
    // Guard : ne s'exécute que dans l'environnement Tauri
    if (!window.__TAURI__) return

    let unlisten: (() => void) | undefined

    listen<UnlockPayload>('screen-unlocked', (event) => {
      onUnlock(event.payload.timestamp)
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
  }, [onUnlock])
}
```

**Livrable :** `src-tauri/src/main.rs`, `src-tauri/src/lock_listener.rs`, `src-tauri/Cargo.toml`,
`src-tauri/tauri.conf.json`, `src/hooks/useLockEvent.ts`.

---

## Phase 3 — Agents parallèles (après Phase 2)

---

### 🤖 Agent E — Migration des routes vers TanStack Router

**Contexte à fournir à Claude :**
> "Je migre toutes les routes d'un projet Next.js 15 App Router vers TanStack Start (file-based
> routing avec @tanstack/react-router). Je t'envoie le contenu de chaque page/layout Next.js,
> tu les réécris en TanStack Start."

**Règles de mapping Next.js → TanStack Router :**

| Next.js | TanStack Router |
|---|---|
| `app/layout.tsx` | `src/routes/__root.tsx` |
| `app/page.tsx` | `src/routes/index.tsx` |
| `app/(auth)/login/page.tsx` | `src/routes/_auth/login.tsx` |
| `app/(dashboard)/teams/page.tsx` | `src/routes/_app/teams/index.tsx` |
| `app/(dashboard)/teams/[teamId]/page.tsx` | `src/routes/_app/teams/$teamId/route.tsx` |
| `app/(dashboard)/teams/[teamId]/issues/page.tsx` | `src/routes/_app/teams/$teamId/issues/index.tsx` |
| `app/(dashboard)/teams/[teamId]/chat/page.tsx` | `src/routes/_app/teams/$teamId/chat.tsx` |
| `loading.tsx` | `pendingComponent` dans `createFileRoute` |
| `error.tsx` | `errorComponent` dans `createFileRoute` |

**Template de route TanStack Start :**
```tsx
// src/routes/_app/teams/$teamId/issues/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { issuesQueryOptions } from '../../../../../server/issues'
import { IssuesList } from '../../../../../components/issues/IssuesList'

export const Route = createFileRoute('/_app/teams/$teamId/issues/')({
  loader: ({ context: { queryClient }, params }) =>
    queryClient.ensureQueryData(issuesQueryOptions(params.teamId)),

  pendingComponent: () => <div>Chargement...</div>,

  errorComponent: ({ error }) => <div>Erreur : {error.message}</div>,

  component: function IssuesPage() {
    const { teamId } = Route.useParams()
    const issues = Route.useLoaderData()
    return <IssuesList teamId={teamId} initialData={issues} />
  },
})
```

**Instructions spécifiques pour chaque route :**

- `__root.tsx` : inclure `<Outlet />`, providers (QueryClient, AuthProvider), styles globaux,
  et le composant `<TaskGateWrapper />` (voir Agent G)
- Routes `_app/*` : toutes les routes derrière auth ont `beforeLoad` qui vérifie la session
- Route `_auth/login.tsx` : formulaire OAuth Google via `authClient.signIn.social({ provider: 'google' })`
- Route `$teamId/chat.tsx` : utiliser `useChat` de `ai/react` v4 (inchangé par rapport à l'original)

**Livrable :** Tous les fichiers dans `src/routes/`.

---

### 🤖 Agent F — Migration des API routes vers TanStack Start Server Functions

**Contexte à fournir à Claude :**
> "Je migre toutes les API routes Next.js vers des TanStack Start server functions.
> Je t'envoie le contenu de chaque route API Next.js, tu la réécris en server function TanStack."

**Pattern de migration :**

Dans Next.js App Router :
```ts
// app/api/teams/[teamId]/issues/route.ts
export async function GET(req: Request, { params }) {
  const issues = await prisma.issue.findMany({ where: { teamId: params.teamId } })
  return Response.json(issues)
}
```

Dans TanStack Start (server functions) :
```ts
// src/server/issues.ts
import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { prisma } from '../lib/db'
import { z } from 'zod'

// Server function (appelable depuis le client avec type-safety)
export const getIssues = createServerFn({ method: 'GET' })
  .validator(z.object({ teamId: z.string() }))
  .handler(async ({ data }) => {
    const issues = await prisma.issue.findMany({
      where: { teamId: data.teamId },
      include: { assignee: true, labels: true, workflowState: true },
    })
    return issues
  })

// Query options pour TanStack Query (cache côté client)
export const issuesQueryOptions = (teamId: string) =>
  queryOptions({
    queryKey: ['issues', teamId],
    queryFn: () => getIssues({ data: { teamId } }),
  })
```

**Fichiers server functions à créer** (un fichier par domaine) :

| Fichier | Server functions à créer |
|---|---|
| `src/server/teams.ts` | `getTeams`, `createTeam`, `updateTeam`, `deleteTeam`, `getTeamStats` |
| `src/server/issues.ts` | `getIssues`, `getIssue`, `createIssue`, `updateIssue`, `deleteIssue` |
| `src/server/projects.ts` | `getProjects`, `createProject`, `updateProject`, `getProjectMembers`, `addProjectMember`, `removeProjectMember` |
| `src/server/chat.ts` | `getChatHistory`, `saveChatMessage` + handler streaming (voir ci-dessous) |
| `src/server/invitations.ts` | `createInvitation`, `getInvitation`, `acceptInvitation` |
| `src/server/workflow-states.ts` | `getWorkflowStates`, `createWorkflowState` |
| `src/server/labels.ts` | `getLabels`, `createLabel` |
| `src/server/daily-tasks.ts` | `getDailyTasks`, `createDailyTask`, `completeDailyTask`, `hasTodayTasks` |

**Cas spécial — Streaming AI Chat :**

Le streaming nécessite une route API HTTP classique dans TanStack Start
(pas une server function, car le streaming nécessite une réponse HTTP brute) :

```ts
// src/routes/api/teams/$teamId/chat.ts
import { createAPIFileRoute } from '@tanstack/react-start/api'
import { streamText } from 'ai'
import { groq, model } from '../../../../lib/ai'
import { prisma } from '../../../../lib/db'

export const APIRoute = createAPIFileRoute('/api/teams/$teamId/chat')({
  POST: async ({ request, params }) => {
    const { messages, apiKey } = await request.json()

    const result = streamText({
      model: apiKey ? createGroq({ apiKey })(model) : model,
      messages,
      tools: {
        // Copier les tools depuis l'ancien app/api/teams/[teamId]/chat/route.ts
      },
      maxSteps: 5,
    })

    return result.toDataStreamResponse()
  },
})
```

**Server function daily-tasks à créer dans `src/server/daily-tasks.ts` :**
```ts
import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { prisma } from '../lib/db'
import { z } from 'zod'
import { getSession } from '../lib/auth'

export const hasTodayTasks = createServerFn({ method: 'GET' })
  .handler(async () => {
    const session = await getSession()
    if (!session) return false

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const count = await prisma.dailyTask.count({
      where: {
        userId: session.user.id,
        date: { gte: today },
      },
    })
    return count > 0
  })

export const getDailyTasks = createServerFn({ method: 'GET' })
  .validator(z.object({ date: z.string().optional() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error('Non authentifié')

    const date = data.date ? new Date(data.date) : new Date()
    date.setHours(0, 0, 0, 0)

    return prisma.dailyTask.findMany({
      where: { userId: session.user.id, date: { gte: date } },
      orderBy: { createdAt: 'asc' },
    })
  })

export const createDailyTask = createServerFn({ method: 'POST' })
  .validator(z.object({
    content: z.string().min(1).max(500),
    date: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error('Non authentifié')

    const date = data.date ? new Date(data.date) : new Date()
    date.setHours(0, 0, 0, 0)

    return prisma.dailyTask.create({
      data: {
        content: data.content,
        userId: session.user.id,
        date,
      },
    })
  })

export const completeDailyTask = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    if (!session) throw new Error('Non authentifié')

    return prisma.dailyTask.update({
      where: { id: data.id, userId: session.user.id },
      data: { completed: true },
    })
  })

export const todayTasksQueryOptions = queryOptions({
  queryKey: ['daily-tasks', 'today'],
  queryFn: () => getDailyTasks({ data: {} }),
  staleTime: 1000 * 60, // 1 min
})
```

**Livrable :** Tous les fichiers dans `src/server/`.

---

## Phase 4 — Agent G : Feature TaskGate (intégration finale)

> **Cet agent s'exécute en dernier**, une fois que tous les agents précédents ont terminé.
> C'est la feature principale : le modal bloquant au déverrouillage du PC.

**Contexte à fournir à Claude :**
> "Tous les agents précédents ont terminé. Je veux maintenant construire la feature TaskGate :
> un modal qui s'affiche obligatoirement à chaque déverrouillage du PC et qui force l'utilisateur
> à saisir ses tâches du jour avant de pouvoir utiliser l'app. Le hook `useLockEvent` existe déjà.
> Les server functions `hasTodayTasks` et `createDailyTask` existent déjà."

**Instructions précises :**

### 1. Composant `TaskGateModal.tsx`

```tsx
// src/components/task-gate/TaskGateModal.tsx
import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createDailyTask, todayTasksQueryOptions } from '../../server/daily-tasks'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'

interface Props {
  onComplete: () => void
}

export function TaskGateModal({ onComplete }: Props) {
  const [input, setInput] = useState('')
  const [tasks, setTasks] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (content: string) => createDailyTask({ data: { content } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] })
    },
  })

  const addTask = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed) return
    if (tasks.includes(trimmed)) {
      setError('Cette tâche est déjà dans la liste')
      return
    }
    setTasks(prev => [...prev, trimmed])
    setInput('')
    setError(null)
  }, [input, tasks])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTask()
    }
  }

  const handleSubmit = async () => {
    if (tasks.length === 0) {
      setError('Ajoute au moins une tâche pour continuer')
      return
    }

    // Sauvegarder toutes les tâches en parallèle
    await Promise.all(tasks.map(t => mutation.mutateAsync(t)))
    onComplete()
  }

  const removeTask = (index: number) => {
    setTasks(prev => prev.filter((_, i) => i !== index))
  }

  return (
    // Overlay plein écran — bloque toute interaction avec l'app
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm"
      // Empêcher la fermeture par clic extérieur
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            Bienvenue 👋
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long', day: 'numeric', month: 'long'
            })}
          </p>
          <p className="mt-3 text-base text-foreground">
            Quelles sont tes tâches du jour ?
          </p>
        </div>

        {/* Liste des tâches ajoutées */}
        {tasks.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {tasks.map((task, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="cursor-pointer text-sm"
                onClick={() => removeTask(i)}
              >
                {task} ✕
              </Badge>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <Input
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex : Terminer le rapport Q2..."
            className="flex-1"
          />
          <Button variant="outline" onClick={addTask} type="button">
            +
          </Button>
        </div>

        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {tasks.length === 0
              ? 'Au moins 1 tâche requise'
              : `${tasks.length} tâche${tasks.length > 1 ? 's' : ''}`}
          </p>
          <Button
            onClick={handleSubmit}
            disabled={tasks.length === 0 || mutation.isPending}
            className="min-w-[120px]"
          >
            {mutation.isPending ? 'Sauvegarde...' : 'Commencer →'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

### 2. Composant wrapper `TaskGateWrapper.tsx`

```tsx
// src/components/task-gate/TaskGateWrapper.tsx
import { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLockEvent } from '../../hooks/useLockEvent'
import { hasTodayTasks, todayTasksQueryOptions } from '../../server/daily-tasks'
import { TaskGateModal } from './TaskGateModal'

/**
 * Wrapper global placé dans __root.tsx.
 * Gère deux cas :
 * 1. Premier lancement du jour : modal au démarrage
 * 2. Déverrouillage PC : modal à chaque unlock si tâches pas encore renseignées
 */
export function TaskGateWrapper({ children }: { children: React.ReactNode }) {
  const [showGate, setShowGate] = useState(false)
  const [hasCheckedToday, setHasCheckedToday] = useState(false)

  // Vérifier au démarrage si les tâches du jour sont déjà renseignées
  const { data: todayHasTasks, isLoading } = useQuery({
    queryKey: ['daily-tasks', 'has-today'],
    queryFn: () => hasTodayTasks(),
    staleTime: 1000 * 60 * 5,
  })

  useEffect(() => {
    if (!isLoading && !hasCheckedToday) {
      setHasCheckedToday(true)
      if (!todayHasTasks) {
        setShowGate(true)
      }
    }
  }, [todayHasTasks, isLoading, hasCheckedToday])

  // Réafficher le modal à chaque déverrouillage du PC
  const handleUnlock = useCallback((_timestamp: number) => {
    // Revérifier si les tâches ont été renseignées aujourd'hui
    hasTodayTasks().then(hasTasks => {
      if (!hasTasks) {
        setShowGate(true)
      }
    })
  }, [])

  useLockEvent(handleUnlock)

  const handleComplete = useCallback(() => {
    setShowGate(false)
  }, [])

  return (
    <>
      {children}
      {showGate && <TaskGateModal onComplete={handleComplete} />}
    </>
  )
}
```

### 3. Intégrer dans `__root.tsx`

```tsx
// src/routes/__root.tsx
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { TaskGateWrapper } from '../components/task-gate/TaskGateWrapper'
import '../styles/globals.css'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: function Root() {
    return (
      <TaskGateWrapper>
        <Outlet />
      </TaskGateWrapper>
    )
  },
})
```

### 4. Configuration Tauri pour fenêtre always-on-top pendant la gate

Ajouter une commande Tauri pour forcer la fenêtre au premier plan :

```rust
// Dans src-tauri/src/main.rs, ajouter :
#[tauri::command]
fn set_always_on_top(window: tauri::WebviewWindow, value: bool) {
    window.set_always_on_top(value).unwrap();
}

// Dans Builder : .invoke_handler(tauri::generate_handler![set_always_on_top])
```

```ts
// Dans TaskGateModal.tsx, ajouter useEffect :
useEffect(() => {
  if (window.__TAURI__) {
    invoke('set_always_on_top', { value: true })
    return () => { invoke('set_always_on_top', { value: false }) }
  }
}, [])
```

**Livrable :** `src/components/task-gate/TaskGateModal.tsx`,
`src/components/task-gate/TaskGateWrapper.tsx`,
`src/routes/__root.tsx` mis à jour,
`src-tauri/src/main.rs` mis à jour.

---

## Variables d'environnement

Créer `.env.local` à partir de `.env.local.example`. Ajouter :

```env
# Existant (inchangé)
BETTER_AUTH_SECRET="..."
BETTER_AUTH_URL="http://localhost:3000"
DATABASE_URL="postgresql://..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"   # → renommer en VITE_APP_URL

# Renommer NEXT_PUBLIC_ → VITE_ pour Vite
VITE_APP_URL="http://localhost:3000"

# Optionnel
GROQ_API_KEY="..."
RESEND_API_KEY="..."
RESEND_FROM_EMAIL="..."
```

---

## Commandes de développement

```bash
# Dev web seul
npm run dev

# Dev Tauri (app desktop + web)
npm run tauri dev

# Build desktop
npm run tauri build

# Prisma
npx prisma studio          # Interface DB
npx prisma migrate dev     # Nouvelle migration
npx prisma generate        # Regen client
```

---

## Ordre d'exécution des agents (résumé)

```
Toi-même       → Phase 0 : Fork + scaffolding TanStack Start + Tauri init
Toi-même       → Phase 1 : Prisma 6 + schéma DailyTask + migration

En parallèle   → Agent A : Shadcn/ui + Tailwind v4 + composants UI
En parallèle   → Agent B : Better Auth → TanStack Start
En parallèle   → Agent C : Prisma client + lib utils + AI SDK v4
En parallèle   → Agent D : Tauri v2 lock_listener.rs + useLockEvent.ts

En parallèle   → Agent E : Migration toutes les routes (TanStack Router)
En parallèle   → Agent F : Migration toutes les API → server functions

Séquentiel     → Agent G : Feature TaskGate complète + intégration finale
```

**Temps estimé total :** 3-4h en parallèle (vs ~12h séquentiel).

---

## Notes importantes

- **macOS lock listener** : L'implémentation complète nécessite le crate `block2` pour les
  callbacks Objective-C. La version fournie dans Agent D est un squelette à compléter avec
  `block2 = "0.5"` dans Cargo.toml si tu développes sur macOS.

- **Linux** : Tester avec `loginctl lock-session` et `loginctl unlock-session`.
  Le path D-Bus `/org/freedesktop/login1/session/auto` peut varier selon la distrib.
  Alternative : écouter `org.gnome.ScreenSaver` si GNOME.

- **Tauri + Vite HMR** : En dev, Tauri pointe vers `http://localhost:3000` (le server Vite).
  Le `--port` peut être configuré dans `app.config.ts` si conflit.

- **TanStack Start RC** : La version est `^1.166` (stable pour usage prod). Bien lancer
  `npm install @tanstack/react-start@latest @tanstack/react-router@latest` pour être sur
  le dernier patch.

- **Shadcn/ui + Tailwind v4** : La CLI Shadcn détecte automatiquement Tailwind v4 depuis
  `shadcn@latest`. Ne pas utiliser une version antérieure de la CLI.
