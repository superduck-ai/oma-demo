import type Anthropic from "@anthropic-ai/sdk"

import type {
  ManagedAgentOption,
  ManagedEnvironmentOption,
  ManagedVaultOption,
} from "@/lib/managed-agents"

export async function fetchManagedAgentOptions(
  client: Anthropic
): Promise<Array<ManagedAgentOption>> {
  return collectSortedCatalog(
    client.beta.agents.list({
      include_archived: false,
      limit: 100,
    }),
    (agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      model: agent.model.id,
      version: agent.version,
      updatedAt: agent.updated_at,
    })
  )
}

export async function fetchManagedEnvironmentOptions(
  client: Anthropic
): Promise<Array<ManagedEnvironmentOption>> {
  return collectSortedCatalog(
    client.beta.environments.list({
      include_archived: false,
      limit: 100,
    }),
    (environment) => ({
      id: environment.id,
      name: environment.name,
      description: environment.description,
      environmentType: environment.config.type,
      scope: environment.scope ?? null,
      updatedAt: environment.updated_at,
    })
  )
}

export async function fetchManagedVaultOptions(
  client: Anthropic
): Promise<Array<ManagedVaultOption>> {
  return collectSortedCatalog(
    client.beta.vaults.list({
      include_archived: false,
      limit: 100,
    }),
    (vault) => ({
      id: vault.id,
      name: vault.display_name,
      updatedAt: vault.updated_at,
    })
  )
}

async function collectSortedCatalog<
  TSource,
  TOption extends { id: string; name: string; updatedAt: string },
>(
  pages: AsyncIterable<TSource>,
  project: (item: TSource) => TOption
): Promise<Array<TOption>> {
  const items: Array<TOption> = []

  for await (const item of pages) {
    items.push(project(item))
  }

  return items.sort(compareResourcesByUpdatedAt)
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
