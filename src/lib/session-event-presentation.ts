import type { BetaManagedAgentsStreamSessionEvents } from "@anthropic-ai/sdk/resources/beta/sessions/events"

import type { JsonRecord, JsonValue } from "@/lib/managed-agents"

export type SessionEventCategory =
  | "activity"
  | "message"
  | "model"
  | "outcome"
  | "session"
  | "stream"
  | "system"
  | "thread"
  | "tool"
  | "unknown"

export type SessionEventTone =
  "neutral" | "info" | "success" | "warning" | "danger"

export interface SessionEventField {
  label: string
  value: string
}

export interface SessionEventPresentation {
  category: SessionEventCategory
  title: string
  description: string
  tone: SessionEventTone
  badge: string
  fields: SessionEventField[]
  body?: string
  data?: JsonValue
  dataLabel?: string
}

type ManagedSessionEventType = BetaManagedAgentsStreamSessionEvents["type"]
type EventMeta = Pick<
  SessionEventPresentation,
  "category" | "title" | "description" | "tone"
>

const EVENT_META = {
  "user.message": {
    category: "message",
    title: "You",
    description: "User message",
    tone: "neutral",
  },
  "user.interrupt": {
    category: "session",
    title: "Session interrupted",
    description: "The user paused agent execution.",
    tone: "warning",
  },
  "user.tool_confirmation": {
    category: "tool",
    title: "Tool decision",
    description: "The user responded to a tool permission request.",
    tone: "neutral",
  },
  "user.custom_tool_result": {
    category: "tool",
    title: "Custom tool result",
    description: "The client returned a custom tool result.",
    tone: "success",
  },
  "user.tool_result": {
    category: "tool",
    title: "Tool result",
    description: "The client returned a self-hosted tool result.",
    tone: "success",
  },
  "user.define_outcome": {
    category: "outcome",
    title: "Outcome defined",
    description: "The user defined an evaluated outcome for the session.",
    tone: "info",
  },
  "agent.message": {
    category: "message",
    title: "Agent",
    description: "Agent message",
    tone: "neutral",
  },
  "agent.thinking": {
    category: "activity",
    title: "Agent thinking",
    description: "Extended thinking is making forward progress.",
    tone: "info",
  },
  "agent.tool_use": {
    category: "tool",
    title: "Agent tool",
    description: "The agent invoked a built-in tool.",
    tone: "info",
  },
  "agent.mcp_tool_use": {
    category: "tool",
    title: "MCP tool",
    description: "The agent invoked a tool from an MCP server.",
    tone: "info",
  },
  "agent.custom_tool_use": {
    category: "tool",
    title: "Custom tool",
    description: "The agent requested a client-executed custom tool.",
    tone: "warning",
  },
  "agent.tool_result": {
    category: "tool",
    title: "Agent tool result",
    description: "A built-in agent tool completed.",
    tone: "success",
  },
  "agent.mcp_tool_result": {
    category: "tool",
    title: "MCP tool result",
    description: "An MCP tool completed.",
    tone: "success",
  },
  "agent.thread_message_received": {
    category: "thread",
    title: "Thread message received",
    description: "A message arrived from another session thread.",
    tone: "info",
  },
  "agent.thread_message_sent": {
    category: "thread",
    title: "Thread message sent",
    description: "A message was sent to another session thread.",
    tone: "info",
  },
  "agent.thread_context_compacted": {
    category: "thread",
    title: "Thread context compacted",
    description: "The thread context was summarized to free capacity.",
    tone: "neutral",
  },
  "session.error": {
    category: "session",
    title: "Session error",
    description: "Session execution reported an error.",
    tone: "danger",
  },
  "session.status_rescheduled": {
    category: "session",
    title: "Session retrying",
    description: "The session is recovering from a transient error.",
    tone: "warning",
  },
  "session.status_running": {
    category: "session",
    title: "Session running",
    description: "The agent is actively working.",
    tone: "info",
  },
  "session.status_idle": {
    category: "session",
    title: "Session idle",
    description: "The agent yielded and is awaiting input.",
    tone: "neutral",
  },
  "session.status_terminated": {
    category: "session",
    title: "Session terminated",
    description: "The session will accept no further work.",
    tone: "danger",
  },
  "session.thread_created": {
    category: "thread",
    title: "Thread created",
    description: "A subagent started in a new session thread.",
    tone: "info",
  },
  "session.deleted": {
    category: "session",
    title: "Session deleted",
    description: "The session was deleted and its stream ended.",
    tone: "danger",
  },
  "session.thread_status_running": {
    category: "thread",
    title: "Thread running",
    description: "A session thread began executing.",
    tone: "info",
  },
  "session.thread_status_idle": {
    category: "thread",
    title: "Thread idle",
    description: "A session thread yielded and is awaiting input.",
    tone: "neutral",
  },
  "session.thread_status_terminated": {
    category: "thread",
    title: "Thread terminated",
    description: "A session thread will accept no further input.",
    tone: "danger",
  },
  "session.thread_status_rescheduled": {
    category: "thread",
    title: "Thread retrying",
    description: "A session thread is retrying after a transient error.",
    tone: "warning",
  },
  "session.updated": {
    category: "session",
    title: "Session updated",
    description: "One or more session fields changed.",
    tone: "neutral",
  },
  "span.model_request_start": {
    category: "model",
    title: "Model request started",
    description: "The agent started a model request.",
    tone: "info",
  },
  "span.model_request_end": {
    category: "model",
    title: "Model request completed",
    description: "The model request finished.",
    tone: "success",
  },
  "span.outcome_evaluation_start": {
    category: "outcome",
    title: "Outcome evaluation started",
    description: "The grader started evaluating the defined outcome.",
    tone: "info",
  },
  "span.outcome_evaluation_ongoing": {
    category: "outcome",
    title: "Outcome evaluation running",
    description: "The outcome evaluation is still active.",
    tone: "info",
  },
  "span.outcome_evaluation_end": {
    category: "outcome",
    title: "Outcome evaluation completed",
    description: "The grader returned an outcome verdict.",
    tone: "success",
  },
  event_start: {
    category: "stream",
    title: "Event preview started",
    description: "A buffered event began streaming.",
    tone: "info",
  },
  event_delta: {
    category: "stream",
    title: "Event delta",
    description: "A partial content fragment arrived.",
    tone: "info",
  },
  "system.message": {
    category: "system",
    title: "System message",
    description: "System context or runtime metadata was emitted.",
    tone: "neutral",
  },
} satisfies Record<ManagedSessionEventType, EventMeta>

const FIELD_KEYS = [
  ["agent_name", "Agent"],
  ["session_thread_id", "Thread"],
  ["from_agent_name", "From agent"],
  ["from_session_thread_id", "From thread"],
  ["to_agent_name", "To agent"],
  ["to_session_thread_id", "To thread"],
  ["tool_use_id", "Tool call"],
  ["custom_tool_use_id", "Custom tool call"],
  ["mcp_tool_use_id", "MCP tool call"],
  ["mcp_server_name", "MCP server"],
  ["evaluated_permission", "Permission"],
  ["outcome_id", "Outcome"],
  ["outcome_evaluation_start_id", "Evaluation start"],
  ["model_request_start_id", "Model request start"],
  ["iteration", "Iteration"],
  ["max_iterations", "Max iterations"],
  ["subtype", "Subtype"],
  ["hook_name", "Hook"],
  ["hook_event", "Hook event"],
  ["outcome", "Outcome status"],
  ["exit_code", "Exit code"],
  ["model", "Model"],
] as const

export function presentSessionEvent(
  type: string,
  payload: JsonRecord
): SessionEventPresentation {
  const knownMeta = (EVENT_META as Partial<Record<string, EventMeta>>)[type]
  const meta: EventMeta = knownMeta ?? {
    category: "unknown",
    title: type,
    description: "Event type not yet described by the installed Anthropic SDK.",
    tone: "neutral",
  }
  const fields: SessionEventField[] = FIELD_KEYS.flatMap(([key, label]) => {
    const value = displayValue(payload[key])
    return value === null ? [] : [{ label, value }]
  })
  let title = meta.title
  let tone = meta.tone
  let badge =
    type
      .split(".")
      .at(-1)
      ?.replace(/^status_/, "")
      .replaceAll("_", " ") ?? meta.category
  let body: string | undefined
  let data: JsonValue | undefined
  let dataLabel: string | undefined

  if (type.endsWith("tool_use")) {
    title = toolName(payload)
    data = payload.input
    dataLabel = "Input"
    badge = stringValue(payload.evaluated_permission) ?? "tool call"
  }

  if (type.endsWith("tool_result")) {
    const isError = payload.is_error === true
    title = isError ? `${meta.title} failed` : meta.title
    tone = isError ? "danger" : "success"
    badge = isError ? "error" : "success"
    body = sessionEventContentText(payload.content) || "(empty)"
  }

  if (type === "user.tool_confirmation") {
    const result = stringValue(payload.result)
    title =
      result === "allow"
        ? "Tool allowed"
        : result === "deny"
          ? "Tool denied"
          : meta.title
    tone =
      result === "deny" ? "danger" : result === "allow" ? "success" : "neutral"
    badge = result ?? "decision"
    body = stringValue(payload.deny_message) ?? undefined
  }

  if (
    type === "user.message" ||
    type === "agent.message" ||
    type === "system.message"
  ) {
    body = sessionEventContentText(payload.content) || undefined
  }

  if (type === "user.define_outcome") {
    body = stringValue(payload.description) ?? undefined
    data = payload.rubric
    dataLabel = "Rubric"
    badge = "outcome"
  }

  if (type === "session.error") {
    const error = recordValue(payload.error)
    title = stringValue(error?.type) ?? meta.title
    body = stringValue(error?.message) ?? meta.description
    const retryStatus = stringValue(recordValue(error?.retry_status)?.type)
    if (retryStatus) {
      fields.push({ label: "Retry status", value: retryStatus })
      badge = retryStatus
    } else {
      badge = "error"
    }
  }

  const stopReason = recordValue(payload.stop_reason)
  if (stopReason) {
    const reason = stringValue(stopReason.type)
    if (reason) {
      fields.push({ label: "Stop reason", value: reason })
      badge = reason
      if (reason === "retries_exhausted") {
        tone = "warning"
      }
    }
    const eventIds = displayValue(stopReason.event_ids)
    if (eventIds) {
      fields.push({ label: "Waiting on", value: eventIds })
      tone = "warning"
    }
  }

  if (type === "span.model_request_end") {
    const isError = payload.is_error === true
    tone = isError ? "danger" : "success"
    badge = isError ? "error" : "complete"
  }

  if (type.startsWith("span.outcome_evaluation_")) {
    const iteration = numberValue(payload.iteration)
    if (iteration !== null) {
      const field = fields.find((item) => item.label === "Iteration")
      if (field) {
        field.value = String(iteration + 1)
      }
    }
    const result = stringValue(payload.result)
    if (result) {
      fields.push({ label: "Verdict", value: result })
      badge = result
      tone =
        result === "satisfied"
          ? "success"
          : result === "needs_revision"
            ? "warning"
            : "danger"
    }
    body = stringValue(payload.explanation) ?? body
  }

  const usage = recordValue(payload.model_usage) ?? recordValue(payload.usage)
  const usageValue = usageSummary(usage)
  if (usageValue) {
    fields.push({ label: "Token usage", value: usageValue })
  }

  if (type === "event_start") {
    const preview = recordValue(payload.event)
    const previewType = stringValue(preview?.type)
    const previewId = stringValue(preview?.id)
    if (previewType) fields.push({ label: "Preview", value: previewType })
    if (previewId) fields.push({ label: "Preview event", value: previewId })
    badge = previewType ?? "preview"
  }

  if (type === "event_delta") {
    const delta = recordValue(payload.delta)
    const content = recordValue(delta?.content)
    body = stringValue(content?.text) ?? undefined
    const eventId = stringValue(payload.event_id)
    if (eventId) fields.push({ label: "Preview event", value: eventId })
    const index = numberValue(delta?.index)
    if (index !== null)
      fields.push({ label: "Content index", value: String(index) })
    badge = stringValue(delta?.type) ?? "delta"
  }

  if (type === "session.updated") {
    const changed: JsonRecord = {}
    for (const key of ["title", "metadata", "agent"] as const) {
      if (key in payload) changed[key] = payload[key] ?? null
    }
    if (Object.keys(changed).length > 0) {
      data = changed
      dataLabel = "Changed fields"
    }
    badge = "updated"
  }

  return {
    ...meta,
    title,
    tone,
    badge,
    fields,
    body,
    data,
    dataLabel,
  }
}

export function sessionEventContentText(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content))
    return content == null ? "" : JSON.stringify(content, null, 2)

  return content
    .map((block) => {
      const record = recordValue(block)
      if (!record) return ""

      const text = stringValue(record.text)
      if (text !== null) return text

      if (record.type === "search_result") {
        return [
          stringValue(record.title),
          stringValue(record.source),
          sessionEventContentText(record.content),
        ]
          .filter(Boolean)
          .join("\n")
      }

      if (record.type === "image" || record.type === "document") {
        const source = recordValue(record.source)
        const reference =
          stringValue(source?.url) ??
          stringValue(source?.file_id) ??
          stringValue(source?.media_type)
        return `[${record.type}${reference ? `: ${reference}` : ""}]`
      }

      return JSON.stringify(record, null, 2)
    })
    .filter(Boolean)
    .join("\n")
}

function toolName(payload: JsonRecord) {
  const name = stringValue(payload.name) ?? "Tool call"
  const serverName = stringValue(payload.mcp_server_name)
  return serverName ? `${serverName}.${name}` : name
}

function usageSummary(usage: JsonRecord | null) {
  if (!usage) return null

  const parts = [
    tokenPart(usage.input_tokens, "in"),
    tokenPart(usage.output_tokens, "out"),
    tokenPart(usage.cache_read_input_tokens, "cache read"),
    tokenPart(usage.cache_creation_input_tokens, "cache write"),
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(" · ") : null
}

function tokenPart(value: JsonValue | undefined, label: string) {
  const number = numberValue(value)
  return number === null ? null : `${number.toLocaleString("en-US")} ${label}`
}

function displayValue(value: JsonValue | undefined): string | null {
  if (typeof value === "string") return value || null
  if (typeof value === "number" || typeof value === "boolean")
    return String(value)
  if (Array.isArray(value)) {
    const values = value.flatMap((item) => {
      const displayed = displayValue(item)
      return displayed === null ? [] : [displayed]
    })
    return values.length > 0 ? values.join(", ") : null
  }
  return null
}

function recordValue(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" ? value : null
}
