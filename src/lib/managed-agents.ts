export const DEFAULT_AGENT_ID = "agent_PQ4fur0FFfQ55AQ5EZK4JJnY"
export const DEFAULT_ENVIRONMENT_ID = "env_jB6LGpGDdxXAEbnShOGztgsF"

export type SessionStatus =
  "rescheduling" | "running" | "idle" | "terminated" | "unknown"

export type PendingActionType =
  "tool_confirmation" | "custom_tool_result" | "tool_result"

export type PendingActionStatus = "pending" | "resolved"

export type JsonValue =
  string | number | boolean | null | JsonRecord | Array<JsonValue>

export type JsonRecord = { [key: string]: JsonValue }

export interface AppConfigResponse {
  omaServerUrlConfigured: boolean
  apiKeyConfigured: boolean
  defaultAgentId: string
  defaultEnvironmentId: string
}

export interface StoredSession {
  id: string
  agentId: string
  environmentId: string
  title: string | null
  status: SessionStatus
  createdAt: string
  updatedAt: string
  lastError: string | null
  usage: JsonRecord | null
}

export interface StoredSessionEvent {
  localId: number
  sessionId: string
  eventId: string
  type: string
  processedAt: string | null
  createdAt: string
  payload: JsonRecord
}

export interface PendingAction {
  id: number
  sessionId: string
  eventId: string
  actionType: PendingActionType
  toolName: string
  toolInput: JsonRecord
  sessionThreadId: string | null
  status: PendingActionStatus
  decision: string | null
  response: JsonRecord | null
  createdAt: string
  resolvedAt: string | null
}

export interface SessionDetailResponse {
  session: StoredSession | null
  events: Array<StoredSessionEvent>
  pendingActions: Array<PendingAction>
}

export interface CreateSessionRequest {
  agentId: string
  environmentId: string
  title?: string
}

export interface SendMessageRequest {
  content: string
}

export interface ToolConfirmationRequest {
  eventId: string
  result: "allow" | "deny"
  denyMessage?: string
}

export interface CustomToolResultRequest {
  eventId: string
  content: string
  isError?: boolean
}

export interface ApiErrorResponse {
  error: string
}
