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
}

export interface ManagedAgentOption {
  id: string
  name: string
  description: string | null
  model: string
  version: number
  updatedAt: string
}

export interface ManagedEnvironmentOption {
  id: string
  name: string
  description: string
  environmentType: "cloud" | "self_hosted"
  scope: "organization" | "account" | null
  updatedAt: string
}

export interface ManagedVaultOption {
  id: string
  name: string
  updatedAt: string
}

export const VAULT_ID_PATTERN = /^vlt_[A-Za-z0-9]+$/

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
  vaultIds?: Array<string>
  markdownResources?: Array<MarkdownSessionResource>
  fileResources?: Array<ExistingFileSessionResource>
}

export interface MarkdownSessionResource {
  filename: string
  mountPath?: string
  content: string
}

export interface ExistingFileSessionResource {
  fileId: string
  mountPath?: string
}

export interface MountedSessionFile {
  resourceId: string
  fileId: string
  filename: string
  mimeType: string
  sizeBytes: number
  mountPath: string
}

export interface AddSessionFileResourceRequest {
  sessionId: string
  mountPath?: string
  fileId?: string
  upload?: {
    filename: string
    mimeType: string
    dataBase64: string
  }
  markdown?: {
    filename: string
    content: string
  }
}

export interface SendMessageRequest {
  content?: string
  fileIds?: Array<string>
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
