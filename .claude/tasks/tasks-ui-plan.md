# Plan Final — 5 Feature Groups
# Validé — prêt pour exécution parallèle

---

## FEATURE 1 — Tasks UI condensé
**Fichier unique, zéro risque**

### `src/routes/_app/teams/$teamId/tasks/index.tsx`
- `TaskRow` (ligne ~697) : ajouter `truncate whitespace-nowrap` sur le `<span>` du titre
- `TaskRow` container (ligne ~672) : `py-1.5` → `py-2.5`
- Liste conteneur (ligne ~483) : `max-w-2xl` → `max-w-3xl` pour laisser respirer

---

## FEATURE 2 — Task Detail Sidebar améliorée

### 2a — Largeur + titres
**`src/routes/_app/teams/$teamId/tasks/index.tsx`**
- Panel width (lignes ~593–598) : `w-72` → `w-96` (3 endroits : classe shrink, w-XX, et `border-l`)
- `TaskDetailPanel` titre (ligne ~857) : `text-sm font-medium` → `text-base font-semibold`

### 2b — Photos (stockage local Tauri)
**Approche** : `tauri-plugin-fs` + base64 pour l'affichage. Nouveau champ Prisma `attachments String[]` (liste de chemins relatifs dans app data).

**`prisma/schema.prisma`**
- Ajouter `attachments String[]` sur le modèle `Task`

**Migration :** `prisma migrate dev --name add_task_attachments`

**`src/server/tasks.ts`**
- `updateTask` : accepter `attachments: z.array(z.string()).optional()`
- Nouveau server function `deleteTaskAttachment` pour supprimer un fichier du filesystem

**`src/routes/_app/teams/$teamId/tasks/index.tsx` — `TaskDetailPanel`**
- Section "Photos" sous la note
- Bouton "Ajouter une photo" → `<input type="file" accept="image/*">` caché, déclenché au clic
- En Tauri : lire le fichier via `@tauri-apps/plugin-fs`, copier dans `appLocalDataDir()/attachments/{taskId}/`, stocker le chemin
- Affichage : grille de miniatures `<img src="data:image/...;base64,...">` avec bouton × sur chaque
- Drag & drop sur la zone de la section photos (event `dragover` + `drop`)

**`src-tauri/tauri.conf.json`**
- Ajouter permission `fs:allow-app-write` + `fs:allow-app-read`

**`src-tauri/Cargo.toml`**
- Ajouter `tauri-plugin-fs = "2"`

### 2c — Liens (auto-détection + champ dédié)

**`prisma/schema.prisma`**
- Ajouter `links String[]` sur le modèle `Task`

**`src/server/tasks.ts`**
- `updateTask` : accepter `links: z.array(z.string()).optional()`

**`src/routes/_app/teams/$teamId/tasks/index.tsx` — `TaskDetailPanel`**
- Section "Liens" : liste des `task.links` avec icône lien + clic → `shell.open(url)` (Tauri) ou `window.open(url, '_blank')` (web)
- Input pour ajouter un lien (validation URL basique) + bouton × sur chaque entrée
- Zone Note : composant `RichNote` qui parse le texte avec regex URL (`/https?:\/\/[^\s]+/g`) et rend les URLs en `<a>` cliquables (même logique shell.open/window.open)
- State local `localLinks: string[]` dans `TaskDetailPanel`, sauvegardé avec le reste via `onSave`

**`onSave` signature** dans `TaskDetailPanel` doit inclure `links` et `attachments`

### 2d — Toggle Edit/View

**`src/routes/_app/teams/$teamId/tasks/index.tsx` — `TaskDetailPanel`**
- State local `isEditing: boolean` (défaut : `false`)
- Bouton bascule en haut (icône `Pencil` / `Eye`) à côté du `×`
- **Mode View** : priorité + dates affichés en texte simple (`<span>`), note et liens en lecture seule, pas de bouton Enregistrer
- **Mode Edit** : selects, date pickers, textarea, input liens — tous éditables. Bouton Enregistrer visible.
- Passage automatique en mode Edit au premier clic sur un champ (optionnel UX)

---

## FEATURE 3 — Tauri unlock → focus fenêtre

**`src-tauri/src/lock_listener.rs`**
- Dans `emit_unlock` (ligne ~161) : avant `app.emit(...)`, appeler :
  ```
  use tauri::Manager;
  if let Some(win) = app.get_webview_window("main") {
      let _ = win.show();
      let _ = win.set_focus();
  }
  ```

**`src/routes/_app/route.tsx`** (où `useLockEvent` est consommé dans `TaskGateWrapper`)
- Après le show/focus Rust, optionnel : naviguer vers `/teams/{teamId}/tasks` si pas déjà dessus

---

## FEATURE 4 — Blocage pré-verrouillage (modal)

**Périmètre réel :**
- ✅ `Win+L` (Windows) : interceptable via hook bas niveau `WH_KEYBOARD_LL`
- ✅ `⌘+Ctrl+Q` (macOS) : interceptable via `CGEventTap` (droits Accessibilité requis)
- ❌ Bouton power, menu Démarrer, Apple menu : non interceptables → modal post-lock (event `screen-locking` classique)

**Architecture :**
1. Rust intercepte le raccourci → émet `"pre-lock"` sans verrouiller
2. React reçoit `"pre-lock"` → affiche `LockTaskModal`
3. Utilisateur valide (ou annule) → React émet en retour `"confirm-lock"` ou `"cancel-lock"`
4. Rust reçoit `"confirm-lock"` → appelle `LockWorkStation()` (Windows) / commande lock (macOS)

**`src-tauri/Cargo.toml`**
- Windows features : ajouter `Win32_UI_Input_KeyboardAndMouse` pour `SetWindowsHookEx`
- macOS : `core-graphics` + `core-foundation` pour `CGEventTap`

**`src-tauri/src/lock_listener.rs`**
- Windows : thread séparé avec `SetWindowsHookEx(WH_KEYBOARD_LL)` pour détecter `VK_L` + flag `LLKHF_EXTENDED` avec modificateurs Win
  - Si intercepté ET setting "disable-lock-modal" = false : `CallNextHookEx` supprimé, émet `"pre-lock"`
  - Sinon : `CallNextHookEx` normal
  - Listener Tauri `"confirm-lock"` → appelle `LockWorkStation()`
- macOS : `CGEventTap` sur `kCGEventKeyDown`, filtre `Cmd+Ctrl+Q`
  - Si intercepté ET setting = false : supprime event, émet `"pre-lock"`
  - Listener `"confirm-lock"` → `osascript` ou `CGSSetSessionProperties` pour lock

**`src/hooks/useLockEvent.ts`**
- Ajouter `onPreLock?: () => void` — listen sur `"pre-lock"`
- Garder `onUnlock` inchangé

**`src/components/task-gate/LockTaskModal.tsx`** ← nouveau fichier
- Modal légère (pas full-screen comme `TaskGateModal`) : input titre + bouton "Créer et verrouiller" + bouton "Ignorer et verrouiller"
- Les deux boutons émettent `"confirm-lock"` via `@tauri-apps/api/event` `emit()`
- Créer la task si titre non vide, puis émettre

**`src/routes/_app/route.tsx`**
- Dans `TaskGateWrapper` : ajouter `useLockEvent` avec `onPreLock` → `setLockModalOpen(true)`
- Rendre `<LockTaskModal>` conditionnel

**macOS — permission Accessibilité :**
- Au premier lancement avec `CGEventTap`, si pas de permission → afficher une notification ou dialog demandant d'ouvrir les préférences
- `src-tauri/capabilities/default.json` : pas de changement spécial nécessaire (CGEventTap est OS-level)

---

## FEATURE 5 — Settings toggles

**`src/routes/_app/teams/$teamId/management/index.tsx`**
- Ajouter section `DesktopPreferences` en bas de page, rendue uniquement si `window.__TAURI__`
- Toggle 1 : **"Fermer vraiment l'application"** — `localStorage` key `"tauri-close-behavior"` (`"quit"` | `"minimize"`)
- Toggle 2 : **"Désactiver la modal de verrouillage"** — `localStorage` key `"disable-lock-modal"` (`"true"` | `"false"`)
- Composant Toggle UI : utiliser un `<button>` avec état visuel ON/OFF (pas de dépendance externe)

**`src-tauri/src/main.rs`** ou fichier d'init
- Sur `close-requested` event Tauri côté JS : lire `localStorage.getItem("tauri-close-behavior")`, si `"minimize"` → `appWindow.hide()` au lieu de quitter

**`src/routes/_app/route.tsx`** / `useLockEvent`
- Dans le callback `onPreLock` : vérifier `localStorage.getItem("disable-lock-modal") === "true"` → si oui, émettre `"confirm-lock"` directement sans modal

**`src-tauri/src/lock_listener.rs`**
- Le setting "disable-lock-modal" doit aussi être accessible depuis Rust pour le hook keyboard. Deux approches :
  - Stocker la préférence dans un `AtomicBool` partagé entre Rust et le frontend via une commande Tauri `set_lock_modal_enabled(bool)`
  - OU laisser Rust toujours émettre `"pre-lock"`, et c'est le frontend qui décide d'afficher ou non la modal (plus simple — recommandé)

---

## Ordre d'exécution recommandé (parallélisable)

### Agent A — Features 1 + 2a + 2d (UI pure, pas de DB)
- TaskRow condensé
- Sidebar plus large + titres
- Toggle Edit/View

### Agent B — Feature 2b + 2c (DB + uploads)
- Migration Prisma (attachments + links)
- Server functions
- UI photos + liens dans le panel

### Agent C — Features 3 + 4 + `useLockEvent` (Rust + hooks)
- unlock → focus (Rust)
- Keyboard hook pré-lock (Rust)
- `useLockEvent` mis à jour
- `LockTaskModal`

### Agent D — Feature 5 (Settings)
- Section desktop dans management
- Intégration settings dans route.tsx

**Dépendances :** Agent D dépend que Agent C finisse `useLockEvent` d'abord. Les autres sont indépendants.
