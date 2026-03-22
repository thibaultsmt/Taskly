import { useEffect } from "react"

interface UnlockPayload {
  timestamp: number
}

export function useLockEvent(onUnlock: (timestamp: number) => void) {
  useEffect(() => {
    if (typeof window === "undefined" || !window.__TAURI__) return

    let unlisten: (() => void) | undefined

    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<UnlockPayload>("screen-unlocked", (event) => {
        onUnlock(event.payload.timestamp)
      }).then((fn) => {
        unlisten = fn
      })
    })

    return () => {
      unlisten?.()
    }
  }, [onUnlock])
}
