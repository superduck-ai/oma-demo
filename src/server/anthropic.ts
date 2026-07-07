import Anthropic from "@anthropic-ai/sdk"
import type { AnthropicBeta } from "@anthropic-ai/sdk/resources/beta/beta"

export const MANAGED_AGENTS_BETAS = [
  "managed-agents-2026-04-01",
] satisfies Array<AnthropicBeta>

let client: Anthropic | null = null

export function getServerEnv() {
  const omaServerUrl = process.env.OMA_SERVER_URL?.trim() ?? ""
  const apiKey = process.env.API_KEY?.trim() ?? ""

  return {
    omaServerUrl,
    apiKey,
    omaServerUrlConfigured: omaServerUrl.length > 0,
    apiKeyConfigured: apiKey.length > 0,
  }
}

export function getAnthropicClient() {
  const env = getServerEnv()

  if (!env.omaServerUrlConfigured || !env.apiKeyConfigured) {
    throw new Error("OMA_SERVER_URL and API_KEY must be configured in .env")
  }

  client ??= new Anthropic({
    apiKey: env.apiKey,
    baseURL: env.omaServerUrl,
  })

  return client
}

export function redactSecrets(message: unknown) {
  const env = getServerEnv()
  let text =
    message instanceof Error
      ? message.message
      : typeof message === "string"
        ? message
        : "Unexpected server error"

  if (env.apiKey) {
    text = text.split(env.apiKey).join("[redacted-api-key]")
  }

  return text
}
