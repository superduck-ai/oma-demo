import type Anthropic from "@anthropic-ai/sdk"

import type {
  ManagedAgentOption,
  ManagedEnvironmentOption,
} from "@/lib/managed-agents"

export async function fetchManagedAgentOptions(
  client: Anthropic
): Promise<Array<ManagedAgentOption>> {
  const agents: Array<ManagedAgentOption> = []

  for await (const agent of client.beta.agents.list({
    include_archived: false,
    limit: 100,
  })) {
    agents.push({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      model: agent.model.id,
      version: agent.version,
      updatedAt: agent.updated_at,
    })
  }

  return agents.sort(compareResourcesByUpdatedAt)
}

export async function fetchManagedEnvironmentOptions(
  client: Anthropic
): Promise<Array<ManagedEnvironmentOption>> {
  const environments: Array<ManagedEnvironmentOption> = []

  for await (const environment of client.beta.environments.list({
    include_archived: false,
    limit: 100,
  })) {
    environments.push({
      id: environment.id,
      name: environment.name,
      description: environment.description,
      environmentType: environment.config.type,
      scope: environment.scope ?? null,
      updatedAt: environment.updated_at,
    })
  }

  return environments.sort(compareResourcesByUpdatedAt)
}

function compareResourcesByUpdatedAt(
  left: { id: string; name: string; updatedAt: string },
  right: { id: string; name: string; updatedAt: string }
) {
  return (
    Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
    left.name.localeCompare(right.name) ||
    left.id.localeCompare(right.id)
  )
}
