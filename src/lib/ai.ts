import { createGroq } from "@ai-sdk/groq"

export const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

export const model = groq("llama-3.3-70b-versatile")
