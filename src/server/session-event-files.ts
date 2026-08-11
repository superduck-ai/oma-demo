import { toFile } from "@anthropic-ai/sdk"
import type Anthropic from "@anthropic-ai/sdk"
import type { AnthropicBeta } from "@anthropic-ai/sdk/resources/beta/beta"
import type { BetaManagedAgentsUserMessageEventParams } from "@anthropic-ai/sdk/resources/beta/sessions/events"
import type { BetaManagedAgentsFileResource } from "@anthropic-ai/sdk/resources/beta/sessions/resources"

import type { MountedSessionFile } from "@/lib/managed-agents"

const IMAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
])
const FILE_METADATA_CONCURRENCY = 8

export async function addMountedSessionFile(
  client: Anthropic,
  sessionId: string,
  betas: Array<AnthropicBeta>,
  input: {
    fileId?: string
    mountPath?: string
    upload?: {
      filename: string
      mimeType: string
      data: Buffer
    }
  }
): Promise<MountedSessionFile> {
  let uploadedFileId: string | null = null

  try {
    const metadata = input.upload
      ? await client.beta.files.upload({
          file: await toFile(input.upload.data, input.upload.filename, {
            type: input.upload.mimeType,
          }),
        })
      : await client.beta.files.retrieveMetadata(input.fileId!)

    if (input.upload) {
      uploadedFileId = metadata.id
    }

    const resource = await client.beta.sessions.resources.add(sessionId, {
      type: "file",
      file_id: metadata.id,
      ...(input.mountPath ? { mount_path: input.mountPath } : {}),
      betas,
    })

    return {
      resourceId: resource.id,
      fileId: metadata.id,
      filename: metadata.filename,
      mimeType: metadata.mime_type,
      sizeBytes: metadata.size_bytes,
      mountPath: resource.mount_path,
    }
  } catch (error) {
    if (uploadedFileId) {
      await Promise.allSettled([client.beta.files.delete(uploadedFileId)])
    }
    throw error
  }
}

export async function fetchMountedSessionFiles(
  client: Anthropic,
  sessionId: string,
  betas: Array<AnthropicBeta>,
  requestedFileIds?: Array<string>
): Promise<Array<MountedSessionFile>> {
  const requested = requestedFileIds
    ? new Set(requestedFileIds.map((value) => value.trim()))
    : null
  const resourcesByFileId = new Map<string, BetaManagedAgentsFileResource>()

  for await (const resource of client.beta.sessions.resources.list(sessionId, {
    betas,
    limit: 100,
  })) {
    if (
      resource.type === "file" &&
      (!requested || requested.has(resource.file_id)) &&
      !resourcesByFileId.has(resource.file_id)
    ) {
      resourcesByFileId.set(resource.file_id, resource)
    }
  }

  const files = await mapWithConcurrency(
    [...resourcesByFileId.values()],
    FILE_METADATA_CONCURRENCY,
    async (resource) => {
      try {
        const metadata = await client.beta.files.retrieveMetadata(
          resource.file_id
        )

        return {
          resourceId: resource.id,
          fileId: resource.file_id,
          filename: metadata.filename,
          mimeType: metadata.mime_type,
          sizeBytes: metadata.size_bytes,
          mountPath: resource.mount_path,
        }
      } catch (error) {
        if (requested) {
          throw error
        }

        return {
          resourceId: resource.id,
          fileId: resource.file_id,
          filename: resource.file_id,
          mimeType: "application/octet-stream",
          sizeBytes: 0,
          mountPath: resource.mount_path,
        }
      }
    }
  )

  return files.sort(
    (left, right) =>
      left.filename.localeCompare(right.filename) ||
      left.fileId.localeCompare(right.fileId)
  )
}

export function buildUserMessageContent(
  text: string | undefined,
  fileIds: Array<string>,
  mountedFiles: Array<MountedSessionFile>
): BetaManagedAgentsUserMessageEventParams["content"] {
  const content: BetaManagedAgentsUserMessageEventParams["content"] = []
  const normalizedText = text?.trim()

  if (normalizedText) {
    content.push({ type: "text", text: normalizedText })
  }

  const filesById = new Map(
    mountedFiles.map((file) => [file.fileId, file] as const)
  )

  for (const fileId of [...new Set(fileIds.map((value) => value.trim()))]) {
    const file = filesById.get(fileId)
    if (!file) {
      throw new Error(
        `File ${fileId} is not mounted in this session. Add it as a Session Resource before sending.`
      )
    }

    content.push({
      type: IMAGE_MIME_TYPES.has(file.mimeType) ? "image" : "document",
      source: {
        type: "file",
        file_id: file.fileId,
      },
    })
  }

  if (content.length === 0) {
    throw new Error("A message must include text or at least one file")
  }

  return content
}

async function mapWithConcurrency<T, TResult>(
  items: Array<T>,
  concurrency: number,
  mapper: (item: T) => Promise<TResult>
): Promise<Array<TResult>> {
  const results = new Array<TResult>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () =>
      worker()
    )
  )
  return results
}
