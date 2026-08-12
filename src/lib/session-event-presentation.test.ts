import { describe, expect, test } from "bun:test"

import { presentSessionEvent } from "./session-event-presentation"

describe("presentSessionEvent", () => {
  test("formats SDK event families into readable cards", () => {
    const tool = presentSessionEvent("agent.mcp_tool_use", {
      type: "agent.mcp_tool_use",
      name: "search",
      mcp_server_name: "docs",
      evaluated_permission: "ask",
      input: { query: "session events" },
    })
    expect(tool.title).toBe("docs.search")
    expect(tool.badge).toBe("ask")
    expect(tool.data).toEqual({ query: "session events" })

    const idle = presentSessionEvent("session.status_idle", {
      type: "session.status_idle",
      stop_reason: {
        type: "requires_action",
        event_ids: ["sevt_tool"],
      },
    })
    expect(idle.tone).toBe("warning")
    expect(
      Object.fromEntries(idle.fields.map(({ label, value }) => [label, value]))
    ).toMatchObject({
      "Stop reason": "requires_action",
      "Waiting on": "sevt_tool",
    })

    const model = presentSessionEvent("span.model_request_end", {
      type: "span.model_request_end",
      is_error: false,
      model_usage: {
        input_tokens: 1234,
        output_tokens: 56,
        cache_read_input_tokens: 789,
        cache_creation_input_tokens: 0,
      },
    })
    expect(model.badge).toBe("complete")
    expect(model.fields.at(-1)?.value).toBe(
      "1,234 in · 56 out · 789 cache read · 0 cache write"
    )

    const delta = presentSessionEvent("event_delta", {
      type: "event_delta",
      event_id: "sevt_preview",
      delta: {
        type: "content_delta",
        index: 0,
        content: { type: "text", text: "partial" },
      },
    })
    expect(delta.body).toBe("partial")
    expect(delta.badge).toBe("content_delta")

    const thinking = presentSessionEvent("agent.thinking", {
      type: "agent.thinking",
      content: [{ type: "thinking", thinking: "private", signature: "secret" }],
    })
    expect(thinking.body).toBeUndefined()

    expect(
      presentSessionEvent("future.event", { type: "future.event" }).category
    ).toBe("unknown")
  })
})
