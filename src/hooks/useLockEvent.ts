import { useEffect } from "react"

interface UnlockPayload {
  timestamp: number
}

export function useLockEvent(
  onUnlock: (timestamp: number) => void,
  onPreLock?: () => void,
) {
  useEffect(() => {
    if (typeof window === "undefined" || !window.__TAURI__) return

    let unlistenUnlock: (() => void) | undefined
    let unlistenPreLock: (() => void) | undefined

    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<UnlockPayload>("screen-unlocked", (event) => {
        onUnlock(event.payload.timestamp)
      }).then((fn) => {
        unlistenUnlock = fn
      })

      if (onPreLock) {
        listen<UnlockPayload>("pre-lock", () => {
          onPreLock()
        }).then((fn) => {
          unlistenPreLock = fn
        })
      }
    })

    return () => {
      unlistenUnlock?.()
      unlistenPreLock?.()
    }
  }, [onUnlock, onPreLock])
}
