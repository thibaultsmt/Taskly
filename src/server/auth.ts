import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/start-server-core"
import { auth } from "../lib/auth"

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest()
  if (!request) return null
  return auth.api.getSession({ headers: request.headers })
})
