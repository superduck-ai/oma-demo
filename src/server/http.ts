import { DEFAULT_AGENT_ID, DEFAULT_ENVIRONMENT_ID } from "@/lib/managed-agents"
import type { ApiErrorResponse } from "@/lib/managed-agents"

import { getServerEnv, redactSecrets } from "./anthropic"

export function jsonResponse<T>(body: T, init?: ResponseInit) {
  return Response.json(body, init)
}

export function errorResponse(error: unknown, status = 500) {
  const body: ApiErrorResponse = {
    error: redactSecrets(error),
  }

  return jsonResponse(body, { status })
}

export async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as unknown
  } catch {
    return null
  }
}

export function configResponse() {
  const env = getServerEnv()

  return {
    omaServerUrlConfigured: env.omaServerUrlConfigured,
    apiKeyConfigured: env.apiKeyConfigured,
    defaultAgentId: DEFAULT_AGENT_ID,
    defaultEnvironmentId: DEFAULT_ENVIRONMENT_ID,
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function requiredString(
  body: Record<string, unknown>,
  key: string
): string {
  const value = body[key]
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required`)
  }

  return value.trim()
}

export function optionalString(
  body: Record<string, unknown>,
  key: string
): string | undefined {
  const value = body[key]
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}
