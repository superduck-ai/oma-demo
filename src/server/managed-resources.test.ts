import { describe, expect, test } from "bun:test"
import type Anthropic from "@anthropic-ai/sdk"

import {
  fetchManagedAgentOptions,
  fetchManagedEnvironmentOptions,
  fetchManagedVaultOptions,
} from "./managed-resources"

describe("Managed resource catalog", () => {
  test("returns agents by updated time descending with a client-safe projection", async () => {
    const client = {
      beta: {
        agents: {
          list: () =>
            asyncItems([
              {
                id: "agent_2",
                name: "Zulu",
                description: null,
                model: { id: "claude-sonnet-4-6" },
                version: 3,
                updated_at: "2026-07-25T00:00:00Z",
                system: "must stay server-side",
                tools: [{ type: "agent_toolset" }],
              },
              {
                id: "agent_1",
                name: "Alpha",
                description: "Extractor",
                model: { id: "claude-opus-4-6" },
                version: 1,
                updated_at: "2026-07-24T00:00:00Z",
                metadata: { secret: "not returned" },
              },
            ]),
        },
      },
    } as unknown as Anthropic

    expect(await fetchManagedAgentOptions(client)).toEqual([
      {
        id: "agent_2",
        name: "Zulu",
        description: null,
        model: "claude-sonnet-4-6",
        version: 3,
        updatedAt: "2026-07-25T00:00:00Z",
      },
      {
        id: "agent_1",
        name: "Alpha",
        description: "Extractor",
        model: "claude-opus-4-6",
        version: 1,
        updatedAt: "2026-07-24T00:00:00Z",
      },
    ])
  })

  test("returns environments by updated time descending with a client-safe projection", async () => {
    const client = {
      beta: {
        environments: {
          list: () =>
            asyncItems([
              {
                id: "env_2",
                name: "Self hosted",
                description: "",
                config: { type: "self_hosted", environment_key: "hidden" },
                scope: "account",
                updated_at: "2026-07-25T00:00:00Z",
              },
              {
                id: "env_1",
                name: "Cloud",
                description: "Default runtime",
                config: { type: "cloud", packages: { npm: ["private"] } },
                updated_at: "2026-07-24T00:00:00Z",
                metadata: { secret: "not returned" },
              },
            ]),
        },
      },
    } as unknown as Anthropic

    expect(await fetchManagedEnvironmentOptions(client)).toEqual([
      {
        id: "env_2",
        name: "Self hosted",
        description: "",
        environmentType: "self_hosted",
        scope: "account",
        updatedAt: "2026-07-25T00:00:00Z",
      },
      {
        id: "env_1",
        name: "Cloud",
        description: "Default runtime",
        environmentType: "cloud",
        scope: null,
        updatedAt: "2026-07-24T00:00:00Z",
      },
    ])
  })

  test("returns vaults by updated time descending with a client-safe projection", async () => {
    const client = {
      beta: {
        vaults: {
          list: () =>
            asyncItems([
              {
                id: "vlt_2",
                display_name: "Support creds",
                type: "vault",
                archived_at: null,
                created_at: "2026-07-20T00:00:00Z",
                updated_at: "2026-07-25T00:00:00Z",
                metadata: { secret: "not returned" },
              },
              {
                id: "vlt_1",
                display_name: "Shared MCP",
                type: "vault",
                archived_at: null,
                created_at: "2026-07-19T00:00:00Z",
                updated_at: "2026-07-24T00:00:00Z",
                metadata: {},
              },
            ]),
        },
      },
    } as unknown as Anthropic

    expect(await fetchManagedVaultOptions(client)).toEqual([
      {
        id: "vlt_2",
        name: "Support creds",
        updatedAt: "2026-07-25T00:00:00Z",
      },
      {
        id: "vlt_1",
        name: "Shared MCP",
        updatedAt: "2026-07-24T00:00:00Z",
      },
    ])
  })
})

function asyncItems<T>(items: Array<T>): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      yield* items
    },
  }
}
