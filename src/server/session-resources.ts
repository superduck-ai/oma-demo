import Anthropic, { toFile } from "@anthropic-ai/sdk"
import type { BetaManagedAgentsFileResourceParams } from "@anthropic-ai/sdk/resources/beta/sessions/sessions"

import type {
  ExistingFileSessionResource,
  MarkdownSessionResource,
} from "@/lib/managed-agents"

export interface UploadedMarkdownResource {
  fileId: string
  filename: string
  mountPath: string
}

export function mapExistingFileResources(
  resources: Array<ExistingFileSessionResource>
): Array<BetaManagedAgentsFileResourceParams> {
  return resources.map((resource) => {
    const mountPath = resource.mountPath?.trim()

    return {
      type: "file",
      file_id: resource.fileId.trim(),
      ...(mountPath ? { mount_path: mountPath } : {}),
    }
  })
}

export async function uploadMarkdownResources(
  client: Anthropic,
  resources: Array<MarkdownSessionResource>
): Promise<{
  sessionResources: Array<BetaManagedAgentsFileResourceParams>
  uploaded: Array<UploadedMarkdownResource>
}> {
  const uploaded: Array<UploadedMarkdownResource> = []

  try {
    for (const resource of resources) {
      const filename = resource.filename.trim()
      const mountPath = resource.mountPath?.trim() || `/${filename}`
      const file = await toFile(
        Buffer.from(resource.content, "utf8"),
        filename,
        { type: "text/plain" }
      )
      const metadata = await client.beta.files.upload({ file })

      uploaded.push({
        fileId: metadata.id,
        filename,
        mountPath,
      })
    }
  } catch (error) {
    await deleteUploadedFiles(
      client,
      uploaded.map((resource) => resource.fileId)
    )
    throw error
  }

  return {
    sessionResources: uploaded.map((resource) => ({
      type: "file",
      file_id: resource.fileId,
      mount_path: resource.mountPath,
    })),
    uploaded,
  }
}

export async function deleteUploadedFiles(
  client: Anthropic,
  fileIds: Array<string>
) {
  await Promise.allSettled(
    fileIds.map((fileId) => client.beta.files.delete(fileId))
  )
}
