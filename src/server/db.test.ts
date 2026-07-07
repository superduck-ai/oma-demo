import { afterEach, describe, expect, test } from "bun:test"
import { rmSync } from "node:fs"
import { join } from "node:path"

import { OmaDatabase } from "./db"

const testPaths = new Set<string>()

afterEach(() => {
  for (const path of testPaths) {
    rmSync(path, { force: true })
    rmSync(`${path}-shm`, { force: true })
    rmSync(`${path}-wal`, { force: true })
  }
  testPaths.clear()
})

describe("OmaDatabase", () => {
  test("initializes schema and stores local sessions", () => {
    const db = createTestDb()

    db.createLocalSession({
      id: "sess_local",
      agentId: "agent_123",
      environmentId: "env_123",
      title: "Local test",
      status: "idle",
    })

    expect(db.listSessions("agent_123")).toMatchObject([
      {
        id: "sess_local",
        agentId: "agent_123",
        environmentId: "env_123",
        title: "Local test",
        status: "idle",
      },
    ])

    db.close()
  })

  test("creates and resolves tool confirmation actions", () => {
    const db = createTestDb()
    db.createLocalSession({
      id: "sess_tools",
      agentId: "agent_123",
      environmentId: "env_123",
    })

    db.insertSessionEvent("sess_tools", {
      id: "evt_tool",
      type: "agent.tool_use",
      tool_use_id: "tool_write_file",
      name: "write_file",
      evaluated_permission: "ask",
      input: { path: "/tmp/example.txt" },
    })

    let actions = db.getSessionDetail("sess_tools").pendingActions
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({
      eventId: "tool_write_file",
      actionType: "tool_confirmation",
      toolName: "write_file",
      status: "pending",
    })

    db.insertSessionEvent("sess_tools", {
      id: "evt_confirmation",
      type: "user.tool_confirmation",
      tool_use_id: "tool_write_file",
      result: "allow",
    })

    actions = db.getSessionDetail("sess_tools").pendingActions
    expect(actions[0]).toMatchObject({
      eventId: "tool_write_file",
      status: "resolved",
      decision: "allow",
    })

    db.close()
  })

  test("does not create tool confirmation actions without explicit ask", () => {
    const db = createTestDb()
    db.createLocalSession({
      id: "sess_auto_tool",
      agentId: "agent_123",
      environmentId: "env_123",
    })

    db.insertSessionEvent("sess_auto_tool", {
      id: "evt_tool",
      type: "agent.tool_use",
      name: "Agent",
      tool_use_id: "tool_agent",
      input: { prompt: "delegate work" },
    })

    expect(db.getSessionDetail("sess_auto_tool").pendingActions).toHaveLength(0)

    db.close()
  })

  test("creates and resolves custom tool result actions", () => {
    const db = createTestDb()
    db.createLocalSession({
      id: "sess_custom",
      agentId: "agent_123",
      environmentId: "env_123",
    })

    db.insertSessionEvent("sess_custom", {
      id: "evt_custom",
      type: "agent.custom_tool_use",
      name: "lookup_order",
      input: { orderId: "ord_123" },
    })

    let actions = db.getSessionDetail("sess_custom").pendingActions
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({
      eventId: "evt_custom",
      actionType: "custom_tool_result",
      status: "pending",
    })

    db.insertSessionEvent("sess_custom", {
      id: "evt_custom_result",
      type: "user.custom_tool_result",
      custom_tool_use_id: "evt_custom",
      is_error: false,
      content: [{ type: "text", text: "Order found" }],
    })

    actions = db.getSessionDetail("sess_custom").pendingActions
    expect(actions[0]).toMatchObject({
      eventId: "evt_custom",
      status: "resolved",
      decision: "ok",
    })

    db.close()
  })

  test("creates pending actions from idle requires_action events", () => {
    const db = createTestDb()
    db.createLocalSession({
      id: "sess_idle",
      agentId: "agent_123",
      environmentId: "env_123",
    })

    db.insertSessionEvent("sess_idle", {
      id: "evt_mcp",
      type: "agent.mcp_tool_use",
      name: "query",
      mcp_server_name: "db",
      evaluated_permission: "allow",
      input: { sql: "select 1" },
    })

    expect(db.getSessionDetail("sess_idle").pendingActions).toHaveLength(0)

    db.insertSessionEvent("sess_idle", {
      id: "evt_idle",
      type: "session.status_idle",
      stop_reason: {
        type: "requires_action",
        event_ids: ["evt_mcp"],
      },
    })

    const detail = db.getSessionDetail("sess_idle")
    expect(detail.session?.status).toBe("idle")
    expect(detail.pendingActions).toMatchObject([
      {
        eventId: "evt_mcp",
        actionType: "tool_confirmation",
        toolName: "db.query",
        status: "pending",
      },
    ])

    db.close()
  })

  test("uses MCP tool_use_id as the confirmation target", () => {
    const db = createTestDb()
    db.createLocalSession({
      id: "sess_mcp_tool_id",
      agentId: "agent_123",
      environmentId: "env_123",
    })

    db.insertSessionEvent("sess_mcp_tool_id", {
      id: "evt_mcp_weather",
      type: "agent.mcp_tool_use",
      name: "mcp__weather_service__get_weather",
      mcp_server_name: "weather_service",
      tool_use_id: "tool_weather",
      evaluated_permission: "ask",
      input: { location: "Beijing" },
    })

    let actions = db.getSessionDetail("sess_mcp_tool_id").pendingActions
    expect(actions).toMatchObject([
      {
        eventId: "tool_weather",
        actionType: "tool_confirmation",
        toolName: "weather_service.mcp__weather_service__get_weather",
        status: "pending",
      },
    ])

    db.insertSessionEvent("sess_mcp_tool_id", {
      id: "evt_confirmation",
      type: "user.tool_confirmation",
      tool_use_id: "tool_weather",
      result: "allow",
    })

    actions = db.getSessionDetail("sess_mcp_tool_id").pendingActions
    expect(actions[0]).toMatchObject({
      eventId: "tool_weather",
      status: "resolved",
      decision: "allow",
    })

    db.close()
  })
})

function createTestDb() {
  const path = join(
    process.cwd(),
    ".data",
    `oma-demo-test-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
  )
  testPaths.add(path)
  return new OmaDatabase(path)
}
