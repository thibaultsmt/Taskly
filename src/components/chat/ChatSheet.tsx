import * as React from "react"
import { useChat } from "ai/react"
import { useQueryClient } from "@tanstack/react-query"
import { Send, Trash2, X, KeyRound } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet"
import { Button } from "#/components/ui/button"
import { Textarea } from "#/components/ui/textarea"
import { cn } from "#/lib/utils"

interface ChatSheetProps {
  teamId: string
  groqApiKey?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApiKeyClick: () => void
}

function ChatSheet({ teamId, groqApiKey, open, onOpenChange, onApiKeyClick }: ChatSheetProps) {
  const queryClient = useQueryClient()
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    if (open && groqApiKey) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, groqApiKey])

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } =
    useChat({
      api: `/api/teams/${teamId}/chat`,
      body: groqApiKey ? { apiKey: groqApiKey } : undefined,
    })

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  React.useEffect(() => {
    if (typeof window === "undefined" || !(window as Window & { __TAURI__?: unknown }).__TAURI__) {
      return
    }

    let unlistenIssues: (() => void) | undefined
    let unlistenProjects: (() => void) | undefined

    void import("@tauri-apps/api/event").then(({ listen }) => {
      void listen("refresh-issues", () => {
        void queryClient.invalidateQueries({ queryKey: ["issues"] })
      }).then((fn) => {
        unlistenIssues = fn
      })

      void listen("refresh-projects", () => {
        void queryClient.invalidateQueries({ queryKey: ["projects"] })
      }).then((fn) => {
        unlistenProjects = fn
      })
    })

    return () => {
      unlistenIssues?.()
      unlistenProjects?.()
    }
  }, [queryClient])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading) {
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>)
      }
    }
  }

  function handleClear() {
    setMessages([])
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" showCloseButton={false} className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
          <SheetTitle>AI Assistant</SheetTitle>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleClear}
                title="Clear conversation"
              >
                <Trash2 className="size-4" />
                <span className="sr-only">Clear conversation</span>
              </Button>
            )}
            <SheetClose
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Close" />
              }
            >
              <X className="size-4" />
            </SheetClose>
          </div>
        </SheetHeader>

        <div ref={scrollRef} className="relative flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {!groqApiKey && messages.length > 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center backdrop-blur-sm">
              <KeyRound className="size-8 text-muted-foreground" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Clé API requise</p>
                <p className="text-xs text-muted-foreground">Configurez une clé Groq pour utiliser le chat.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); onApiKeyClick() }}>
                Configurer la clé API
              </Button>
            </div>
          )}
          {!groqApiKey && messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
              <KeyRound className="size-8 text-muted-foreground" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Clé API requise</p>
                <p className="text-xs text-muted-foreground">Configurez une clé Groq pour utiliser le chat.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); onApiKeyClick() }}>
                Configurer la clé API
              </Button>
            </div>
          )}
          {groqApiKey && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <p>Ask me anything about your team's issues, projects, or workflow.</p>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex flex-col gap-1",
                message.role === "user" ? "items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              </div>
              <span className="px-1 text-xs text-muted-foreground">
                {message.role === "user" ? "You" : "AI"}
              </span>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start">
              <div className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                <span className="animate-pulse">Thinking…</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-4">
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2"
          >
            <Textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question… (Enter to send)"
              className="min-h-[2.5rem] max-h-32 resize-none"
              rows={1}
              disabled={isLoading || !groqApiKey}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="shrink-0"
            >
              <Send className="size-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { ChatSheet }
