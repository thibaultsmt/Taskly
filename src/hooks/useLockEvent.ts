import { useEffect } from "react"
import { listen } from "@tauri-apps/api/event"

interface UnlockPayload {
  timestamp: number
}

export function useLockEvent(onUnlock: (timestamp: number) => void) {
  useEffect(() => {
    if (!window.__TAURI__) return

    let unlisten: (() => void) | undefined

    listen<UnlockPayload>("screen-unlocked", (event) => {
      onUnlock(event.payload.timestamp)
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
  }, [onUnlock])
}
