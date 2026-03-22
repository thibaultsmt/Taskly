import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server"
import { auth } from "./lib/auth"
import { prisma } from "./lib/db"
import { createGroq } from "@ai-sdk/groq"
import { streamText } from "ai"
import type { CoreMessage } from "ai"

const startHandler = createStartHandler(defaultStreamHandler)

type TeamWithRelations = Awaited<ReturnType<typeof prisma.team.findUnique>> & {
  members: { userName: string; userEmail: string; role: string }[]
  projects: { name: string }[]
  workflowStates: { name: string; type: string }[]
  labels: { name: string; color: string }[]
}

type IssueWithRelations = {
  number: number
  title: string
  priority: string
  assignee?: string | null
  workflowState?: { name: string; type: string } | null
  project?: { name: string } | null
}

function buildSystemPrompt({
  session,
  team,
  issues,
}: {
  session: { user: { name: string; email: string } } | null
  team: TeamWithRelations | null
  issues: IssueWithRelations[]
}): string {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  const lines: string[] = [
    `You are an AI assistant embedded in Taskly, a project management tool.`,
    `Today is ${today}.`,
    ``,
  ]

  if (session) {
    lines.push(`## Current User`, `Name: ${session.user.name}`, `Email: ${session.user.email}`, ``)
  }

  if (team) {
    lines.push(`## Team: ${team.name} (${team.key})`)
    if (team.members.length) {
      lines.push(`Members (${team.members.length}):`)
      for (const m of team.members) {
        lines.push(`  - ${m.userName} <${m.userEmail}> [${m.role}]`)
      }
    }
    if (team.workflowStates.length) {
      lines.push(`Workflow states: ${team.workflowStates.map((s) => `${s.name} (${s.type})`).join(", ")}`)
    }
    if (team.projects.length) {
      lines.push(`Projects: ${team.projects.map((p) => p.name).join(", ")}`)
    }
    if (team.labels.length) {
      lines.push(`Labels: ${team.labels.map((l) => l.name).join(", ")}`)
    }
    lines.push(``)
  }

  if (issues.length) {
    lines.push(`## Issues (${issues.length} most recent)`)
    for (const issue of issues) {
      const parts = [`#${issue.number}`, issue.title, `[${issue.priority}]`]
      if (issue.workflowState) parts.push(`[${issue.workflowState.name}]`)
      if (issue.assignee) parts.push(`→ ${issue.assignee}`)
      if (issue.project) parts.push(`(${issue.project.name})`)
      lines.push(`  ${parts.join(" ")}`)
    }
    lines.push(``)
  }

  lines.push(
    `You can help the user with: analyzing issues and priorities, summarizing project status, suggesting workflow improvements, and answering questions about the team's work.`,
    `Be concise and use the data above to give precise, relevant answers.`,
  )

  return lines.join("\n")
}

export default {
  async fetch(request: Request, opts?: unknown) {
    const url = new URL(request.url)

    if (url.pathname.startsWith("/api/auth/")) {
      return auth.handler(request)
    }

    const chatMatch = url.pathname.match(/^\/api\/teams\/([^/]+)\/chat$/)
    if (chatMatch && request.method === "POST") {
      try {
        const teamId = chatMatch[1]
        const { messages, apiKey } = (await request.json()) as {
          messages: Array<{ role: string; content: string }>
          apiKey?: string
        }
        const resolvedKey = apiKey ?? process.env.GROQ_API_KEY
        if (!resolvedKey) {
          return new Response(JSON.stringify({ error: "GROQ_API_KEY is not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          })
        }

        const [session, team, issues] = await Promise.all([
          auth.api.getSession({ headers: request.headers }),
          prisma.team.findUnique({
            where: { id: teamId },
            include: { members: true, projects: true, workflowStates: { orderBy: { position: "asc" } }, labels: true },
          }),
          prisma.issue.findMany({
            where: { teamId },
            include: { workflowState: true, project: true },
            orderBy: { createdAt: "desc" },
            take: 50,
          }),
        ])

        const systemPrompt = buildSystemPrompt({ session, team, issues })

        const activeModel = createGroq({ apiKey: resolvedKey })("llama-3.3-70b-versatile")
        const result = streamText({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          model: activeModel as any,
          system: systemPrompt,
          messages: messages as CoreMessage[],
        })
        return result.toDataStreamResponse()
      } catch (err) {
        console.error("[chat] error:", err)
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (startHandler as any)(request, opts)
  },
}
