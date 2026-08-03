import { mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"

import type {
  JsonRecord,
  PendingAction,
  PendingActionType,
  SessionStatus,
  StoredSession,
  StoredSessionEvent,
} from "@/lib/managed-agents"

interface SessionRow {
  id: string
  agent_id: string
  environment_id: string
  title: string | null
  status: SessionStatus
  created_at: string
  updated_at: string
  last_error: string | null
  usage_json: string | null
}

interface EventRow {
  local_id: number
  session_id: string
  event_id: string
  type: string
  processed_at: string | null
  created_at: string
  payload_json: string
}

interface PendingActionRow {
  id: number
  session_id: string
  event_id: string
  action_type: PendingActionType
  tool_name: string
  tool_input_json: string
  session_thread_id: string | null
  status: "pending" | "resolved"
  decision: string | null
  response_json: string | null
  created_at: string
  resolved_at: string | null
}

interface SqliteDatabase {
  exec: (sql: string) => unknown
  query: <TRow, TParams = unknown>(
    sql: string
  ) => {
    run: (params?: TParams) => unknown
    get: (params?: TParams) => TRow | null
    all: (params?: TParams) => Array<TRow>
  }
  close: () => unknown
}

const DATABASE_PATH = resolve(process.cwd(), ".data/oma-demo.sqlite")
const require = createRequire(import.meta.url)

let singleton: OmaDatabase | null = null

export function getDb() {
  singleton ??= new OmaDatabase(DATABASE_PATH)
  return singleton
}

export class OmaDatabase {
  private readonly db: SqliteDatabase

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true })
    this.db = createSqliteDatabase(path)
    this.db.exec("PRAGMA journal_mode = WAL;")
    this.db.exec("PRAGMA foreign_keys = ON;")
    this.migrate()
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        environment_id TEXT NOT NULL,
        title TEXT,
        status TEXT NOT NULL DEFAULT 'unknown',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_error TEXT,
        usage_json TEXT
      );

      CREATE TABLE IF NOT EXISTS session_events (
        local_id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        type TEXT NOT NULL,
        processed_at TEXT,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(session_id, event_id),
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_session_events_session
        ON session_events(session_id, local_id);

      CREATE TABLE IF NOT EXISTS pending_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        tool_input_json TEXT NOT NULL,
        session_thread_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        decision TEXT,
        response_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        resolved_at TEXT,
        UNIQUE(session_id, event_id, action_type),
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_pending_actions_session
        ON pending_actions(session_id, status, created_at);

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `)
  }

  close() {
    this.db.close()
  }

  upsertSession(session: JsonRecord) {
    const id = stringValue(session.id)
    if (!id) {
      throw new Error("Remote session did not include an id")
    }

    const agent = recordValue(session.agent)
    const agentId = stringValue(agent?.id) ?? "unknown"
    const environmentId = stringValue(session.environment_id) ?? "unknown"
    const now = new Date().toISOString()
    const createdAt = stringValue(session.created_at) ?? now
    const updatedAt = stringValue(session.updated_at) ?? now
    const title = nullableString(session.title)
    const status = sessionStatus(session.status)
    const usage = recordValue(session.usage)

    this.db
      .query(
        `
        INSERT INTO sessions (
          id, agent_id, environment_id, title, status, created_at, updated_at, last_error, usage_json
        )
        VALUES ($id, $agent_id, $environment_id, $title, $status, $created_at, $updated_at, NULL, $usage_json)
        ON CONFLICT(id) DO UPDATE SET
          agent_id = excluded.agent_id,
          environment_id = excluded.environment_id,
          title = excluded.title,
          status = excluded.status,
          updated_at = excluded.updated_at,
          usage_json = excluded.usage_json
      `
      )
      .run({
        $id: id,
        $agent_id: agentId,
        $environment_id: environmentId,
        $title: title,
        $status: status,
        $created_at: createdAt,
        $updated_at: updatedAt,
        $usage_json: usage ? JSON.stringify(usage) : null,
      })

    return this.getSession(id)
  }

  createLocalSession(params: {
    id: string
    agentId: string
    environmentId: string
    title?: string | null
    status?: SessionStatus
  }) {
    const now = new Date().toISOString()

    this.db
      .query(
        `
        INSERT INTO sessions (
          id, agent_id, environment_id, title, status, created_at, updated_at, last_error, usage_json
        )
        VALUES ($id, $agent_id, $environment_id, $title, $status, $created_at, $updated_at, NULL, NULL)
        ON CONFLICT(id) DO NOTHING
      `
      )
      .run({
        $id: params.id,
        $agent_id: params.agentId,
        $environment_id: params.environmentId,
        $title: params.title ?? null,
        $status: params.status ?? "unknown",
        $created_at: now,
        $updated_at: now,
      })
  }

  listSessions(agentId?: string) {
    const rows = agentId
      ? this.db
          .query<SessionRow, { $agent_id: string }>(
            `
            SELECT * FROM sessions
            WHERE agent_id = $agent_id
            ORDER BY updated_at DESC, created_at DESC
          `
          )
          .all({ $agent_id: agentId })
      : this.db
          .query<SessionRow, []>(
            `
            SELECT * FROM sessions
            ORDER BY updated_at DESC, created_at DESC
          `
          )
          .all()

    return rows.map(mapSessionRow)
  }

  getSession(id: string) {
    const row = this.db
      .query<SessionRow, { $id: string }>(
        "SELECT * FROM sessions WHERE id = $id"
      )
      .get({ $id: id })

    return row ? mapSessionRow(row) : null
  }

  getSessionDetail(sessionId: string) {
    return {
      session: this.getSession(sessionId),
      events: this.listEvents(sessionId),
      pendingActions: this.listPendingActions(sessionId),
    }
  }

  insertSessionEvent(sessionId: string, payload: JsonRecord) {
    const eventId = stringValue(payload.id)
    const type = stringValue(payload.type)

    if (!eventId || !type) {
      return null
    }

    const processedAt = nullableString(payload.processed_at)
    const now = new Date().toISOString()

    this.db
      .query(
        `
        INSERT OR IGNORE INTO session_events (
          session_id, event_id, type, processed_at, payload_json, created_at
        )
        VALUES ($session_id, $event_id, $type, $processed_at, $payload_json, $created_at)
      `
      )
      .run({
        $session_id: sessionId,
        $event_id: eventId,
        $type: type,
        $processed_at: processedAt,
        $payload_json: JSON.stringify(payload),
        $created_at: now,
      })

    this.applyEventSideEffects(sessionId, payload)
    return this.getEventByEventId(sessionId, eventId)
  }

  listEvents(sessionId: string) {
    const rows = this.db
      .query<EventRow, { $session_id: string }>(
        `
        SELECT * FROM session_events
        WHERE session_id = $session_id
        ORDER BY COALESCE(processed_at, created_at), local_id
      `
      )
      .all({ $session_id: sessionId })

    return rows.map(mapEventRow)
  }

  getEventByEventId(sessionId: string, eventId: string) {
    const row = this.db
      .query<EventRow, { $session_id: string; $event_id: string }>(
        `
        SELECT * FROM session_events
        WHERE session_id = $session_id AND event_id = $event_id
      `
      )
      .get({ $session_id: sessionId, $event_id: eventId })

    return row ? mapEventRow(row) : null
  }

  listPendingActions(sessionId: string) {
    const rows = this.db
      .query<PendingActionRow, { $session_id: string }>(
        `
        SELECT * FROM pending_actions
        WHERE session_id = $session_id
        ORDER BY status, created_at DESC, id DESC
      `
      )
      .all({ $session_id: sessionId })

    return rows.map(mapPendingActionRow)
  }

  markSessionError(sessionId: string, message: string) {
    this.db
      .query(
        `
        UPDATE sessions
        SET last_error = $last_error, updated_at = $updated_at
        WHERE id = $id
      `
      )
      .run({
        $id: sessionId,
        $last_error: message,
        $updated_at: new Date().toISOString(),
      })
  }

  private updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    lastError?: string | null
  ) {
    this.db
      .query(
        `
        UPDATE sessions
        SET status = $status,
          last_error = COALESCE($last_error, last_error),
          updated_at = $updated_at
        WHERE id = $id
      `
      )
      .run({
        $id: sessionId,
        $status: status,
        $last_error: lastError ?? null,
        $updated_at: new Date().toISOString(),
      })
  }

  private applyEventSideEffects(sessionId: string, payload: JsonRecord) {
    const type = stringValue(payload.type)

    if (type === "session.status_running") {
      this.updateSessionStatus(sessionId, "running")
      return
    }

    if (type === "session.status_rescheduled") {
      this.updateSessionStatus(sessionId, "rescheduling")
      return
    }

    if (type === "session.status_terminated") {
      this.updateSessionStatus(sessionId, "terminated")
      return
    }

    if (type === "session.status_idle") {
      this.updateSessionStatus(sessionId, "idle")
      this.ensureActionsFromIdleEvent(sessionId, payload)
      return
    }

    if (type === "session.error") {
      const error = recordValue(payload.error)
      this.updateSessionStatus(sessionId, "idle", stringValue(error?.message))
      return
    }

    if (
      type === "agent.tool_use" ||
      type === "agent.mcp_tool_use" ||
      type === "agent.custom_tool_use"
    ) {
      this.maybeCreatePendingAction(sessionId, payload)
      return
    }

    if (type === "user.tool_confirmation") {
      this.resolvePendingAction(
        sessionId,
        stringValue(payload.tool_use_id),
        "tool_confirmation",
        stringValue(payload.result),
        payload
      )
      return
    }

    if (type === "user.custom_tool_result") {
      this.resolvePendingAction(
        sessionId,
        stringValue(payload.custom_tool_use_id),
        "custom_tool_result",
        payload.is_error === true ? "error" : "ok",
        payload
      )
      return
    }

    if (type === "user.tool_result") {
      this.resolvePendingAction(
        sessionId,
        stringValue(payload.tool_use_id),
        "tool_result",
        payload.is_error === true ? "error" : "ok",
        payload
      )
    }
  }

  private ensureActionsFromIdleEvent(sessionId: string, payload: JsonRecord) {
    const stopReason = recordValue(payload.stop_reason)
    if (stopReason?.type !== "requires_action") {
      return
    }

    const eventIds = Array.isArray(stopReason.event_ids)
      ? stopReason.event_ids
      : []

    for (const eventIdValue of eventIds) {
      const eventId = stringValue(eventIdValue)
      if (!eventId) {
        continue
      }

      const event = this.getEventByEventId(sessionId, eventId)
      if (event) {
        this.maybeCreatePendingAction(sessionId, event.payload, true)
      } else {
        this.createPendingAction({
          sessionId,
          eventId,
          actionType: "tool_confirmation",
          toolName: "pending permission",
          toolInput: {},
          sessionThreadId: null,
        })
      }
    }
  }

  private maybeCreatePendingAction(
    sessionId: string,
    payload: JsonRecord,
    force = false
  ) {
    const eventId = stringValue(payload.id)
    const type = stringValue(payload.type)

    if (!eventId || !type) {
      return
    }

    if (type === "agent.custom_tool_use") {
      this.createPendingAction({
        sessionId,
        eventId,
        actionType: "custom_tool_result",
        toolName: stringValue(payload.name) ?? "custom tool",
        toolInput: recordValue(payload.input) ?? {},
        sessionThreadId: nullableString(payload.session_thread_id),
      })
      return
    }

    const evaluatedPermission = stringValue(payload.evaluated_permission)
    if (!force && evaluatedPermission !== "ask") {
      return
    }

    if (type === "agent.tool_use" || type === "agent.mcp_tool_use") {
      const mcpServerName =
        type === "agent.mcp_tool_use"
          ? `${stringValue(payload.mcp_server_name) ?? "mcp"}.`
          : ""

      this.createPendingAction({
        sessionId,
        eventId: stringValue(payload.tool_use_id) ?? eventId,
        actionType: "tool_confirmation",
        toolName: `${mcpServerName}${stringValue(payload.name) ?? "tool"}`,
        toolInput: recordValue(payload.input) ?? {},
        sessionThreadId: nullableString(payload.session_thread_id),
      })
    }
  }

  private createPendingAction(params: {
    sessionId: string
    eventId: string
    actionType: PendingActionType
    toolName: string
    toolInput: JsonRecord
    sessionThreadId: string | null
  }) {
    this.db
      .query(
        `
        INSERT OR IGNORE INTO pending_actions (
          session_id, event_id, action_type, tool_name, tool_input_json, session_thread_id
        )
        VALUES (
          $session_id, $event_id, $action_type, $tool_name, $tool_input_json, $session_thread_id
        )
      `
      )
      .run({
        $session_id: params.sessionId,
        $event_id: params.eventId,
        $action_type: params.actionType,
        $tool_name: params.toolName,
        $tool_input_json: JSON.stringify(params.toolInput),
        $session_thread_id: params.sessionThreadId,
      })
  }

  private resolvePendingAction(
    sessionId: string,
    eventId: string | null,
    actionType: PendingActionType,
    decision: string | null,
    response: JsonRecord
  ) {
    if (!eventId) {
      return
    }

    this.db
      .query(
        `
        UPDATE pending_actions
        SET status = 'resolved',
          decision = $decision,
          response_json = $response_json,
          resolved_at = $resolved_at
        WHERE session_id = $session_id
          AND event_id = $event_id
          AND action_type = $action_type
      `
      )
      .run({
        $session_id: sessionId,
        $event_id: eventId,
        $action_type: actionType,
        $decision: decision,
        $response_json: JSON.stringify(response),
        $resolved_at: new Date().toISOString(),
      })
  }
}

function mapSessionRow(row: SessionRow): StoredSession {
  return {
    id: row.id,
    agentId: row.agent_id,
    environmentId: row.environment_id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastError: row.last_error,
    usage: parseJson(row.usage_json),
  }
}

function mapEventRow(row: EventRow): StoredSessionEvent {
  return {
    localId: row.local_id,
    sessionId: row.session_id,
    eventId: row.event_id,
    type: row.type,
    processedAt: row.processed_at,
    createdAt: row.created_at,
    payload: parseJson(row.payload_json) ?? {},
  }
}

function mapPendingActionRow(row: PendingActionRow): PendingAction {
  return {
    id: row.id,
    sessionId: row.session_id,
    eventId: row.event_id,
    actionType: row.action_type,
    toolName: row.tool_name,
    toolInput: parseJson(row.tool_input_json) ?? {},
    sessionThreadId: row.session_thread_id,
    status: row.status,
    decision: row.decision,
    response: parseJson(row.response_json),
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }
}

function parseJson(value: string | null): JsonRecord | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value)
    return recordValue(parsed)
  } catch {
    return null
  }
}

function recordValue(value: unknown): JsonRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord
  }

  return null
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function sessionStatus(value: unknown): SessionStatus {
  if (
    value === "rescheduling" ||
    value === "running" ||
    value === "idle" ||
    value === "terminated"
  ) {
    return value
  }

  return "unknown"
}

function createSqliteDatabase(path: string): SqliteDatabase {
  if (process.versions.bun) {
    const { Database } = require("bun:sqlite") as {
      Database: new (path: string) => SqliteDatabase
    }

    return new Database(path)
  }

  try {
    return createNodeSqliteDatabase(path)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `SQLite unavailable under Node.js ${process.version}. ` +
        `Use \`bun --bun run dev\` (Bun runtime + bun:sqlite) or Node.js 22.5+ (node:sqlite). ` +
        `(${detail})`
    )
  }
}

function createNodeSqliteDatabase(path: string): SqliteDatabase {
  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (path: string) => {
      exec: (sql: string) => unknown
      prepare: (sql: string) => {
        run: (params?: unknown) => unknown
        get: (params?: unknown) => unknown
        all: (params?: unknown) => Array<unknown>
      }
      close: () => unknown
    }
  }

  const db = new DatabaseSync(path)
  return {
    exec: (sql) => db.exec(sql),
    query: <TRow, TParams = unknown>(sql: string) => {
      const statement = db.prepare(sql)
      return {
        run: (params?: TParams) =>
          params === undefined ? statement.run() : statement.run(params),
        get: (params?: TParams) =>
          ((params === undefined
            ? statement.get()
            : statement.get(params)) as TRow | undefined) ?? null,
        all: (params?: TParams) =>
          (params === undefined
            ? statement.all()
            : statement.all(params)) as Array<TRow>,
      }
    },
    close: () => db.close(),
  }
}
