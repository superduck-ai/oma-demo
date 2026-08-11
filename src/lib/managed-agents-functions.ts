import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import type { JsonRecord, SessionDetailResponse } from "@/lib/managed-agents"
import {
  containsControlCharacters,
  isMountPathValid,
  MARKDOWN_FILENAME_PATTERN,
} from "@/lib/session-file-validation"

const MAX_UPLOAD_BYTES = 10_000_000
const MAX_UPLOAD_BASE64_LENGTH = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4

const mountPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(1024)
  .refine(
    (path) => isMountPathValid(path, false),
    "Mount paths must be absolute and cannot contain '..'."
  )

const createSessionSchema = z
  .object({
    agentId: z.string().min(1),
    environmentId: z.string().min(1),
    title: z.string().optional(),
    markdownResources: z
      .array(
        z.object({
          filename: z
            .string()
            .trim()
            .min(1)
            .max(255)
            .regex(
              MARKDOWN_FILENAME_PATTERN,
              "Markdown filenames must end in .md and contain no forbidden characters."
            )
            .refine(
              (filename) => !containsControlCharacters(filename),
              "Markdown filenames must not contain control characters."
            ),
          mountPath: mountPathSchema.optional(),
          content: z.string().max(10_000_000),
        })
      )
      .optional(),
    fileResources: z
      .array(
        z.object({
          fileId: z
            .string()
            .trim()
            .regex(
              /^file_[A-Za-z0-9]+$/,
              "File IDs must use the 'file_...' format."
            ),
          mountPath: mountPathSchema.optional(),
        })
      )
      .optional(),
  })
  .superRefine((data, context) => {
    const resourceCount =
      (data.markdownResources?.length ?? 0) + (data.fileResources?.length ?? 0)

    if (resourceCount > 500) {
      context.addIssue({
        code: "custom",
        message: "A session can include at most 500 resources.",
        path: ["fileResources"],
      })
    }
  })

const listSessionsSchema = z.object({
  agentId: z.string().optional(),
})

const sessionIdSchema = z.object({
  sessionId: z.string().min(1),
})

const fileIdSchema = z
  .string()
  .trim()
  .regex(/^file_[A-Za-z0-9]+$/, "File IDs must use the 'file_...' format.")

const sendMessageSchema = z
  .object({
    sessionId: z.string().min(1),
    content: z.string().max(100_000).optional(),
    fileIds: z.array(fileIdSchema).max(500).optional(),
  })
  .superRefine((data, context) => {
    if (!data.content?.trim() && (data.fileIds?.length ?? 0) === 0) {
      context.addIssue({
        code: "custom",
        message: "A message must include text or at least one file.",
        path: ["content"],
      })
    }
  })

const addSessionFileResourceSchema = z
  .object({
    sessionId: z.string().min(1),
    mountPath: mountPathSchema.optional(),
    fileId: fileIdSchema.optional(),
    upload: z
      .object({
        filename: z
          .string()
          .trim()
          .min(1)
          .max(255)
          .refine(
            (filename) =>
              !/[\\/]/.test(filename) && !containsControlCharacters(filename),
            "Filenames must not contain path separators or control characters."
          ),
        mimeType: z.string().trim().min(1).max(255),
        dataBase64: z.string().min(1).max(MAX_UPLOAD_BASE64_LENGTH),
      })
      .optional(),
    markdown: z
      .object({
        filename: z
          .string()
          .trim()
          .min(1)
          .max(255)
          .regex(
            MARKDOWN_FILENAME_PATTERN,
            "Markdown filenames must end in .md and contain no forbidden characters."
          )
          .refine(
            (filename) => !containsControlCharacters(filename),
            "Markdown filenames must not contain control characters."
          ),
        content: z.string().max(MAX_UPLOAD_BYTES),
      })
      .optional(),
  })
  .superRefine((data, context) => {
    const sourceCount = [data.fileId, data.upload, data.markdown].filter(
      Boolean
    ).length
    if (sourceCount !== 1) {
      context.addIssue({
        code: "custom",
        message: "Provide exactly one of fileId, upload, or markdown.",
        path: ["fileId"],
      })
    }
  })

const confirmToolSchema = z.object({
  sessionId: z.string().min(1),
  eventId: z.string().min(1),
  result: z.enum(["allow", "deny"]),
  denyMessage: z.string().optional(),
})

const customToolResultSchema = z.object({
  sessionId: z.string().min(1),
  eventId: z.string().min(1),
  content: z.string().min(1),
  isError: z.boolean().optional(),
})

export const getAppConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const { configResponse } = await import("@/server/http")
    return configResponse()
  }
)

export const listAvailableManagedAgents = createServerFn({
  method: "GET",
}).handler(async () => {
  try {
    const { getAnthropicClient } = await import("@/server/anthropic")
    const { fetchManagedAgentOptions } =
      await import("@/server/managed-resources")

    return {
      agents: await fetchManagedAgentOptions(getAnthropicClient()),
    }
  } catch (error) {
    throw await clientSafeError(error)
  }
})

export const listAvailableManagedEnvironments = createServerFn({
  method: "GET",
}).handler(async () => {
  try {
    const { getAnthropicClient } = await import("@/server/anthropic")
    const { fetchManagedEnvironmentOptions } =
      await import("@/server/managed-resources")

    return {
      environments: await fetchManagedEnvironmentOptions(getAnthropicClient()),
    }
  } catch (error) {
    throw await clientSafeError(error)
  }
})

export const listLocalSessions = createServerFn({ method: "GET" })
  .validator(listSessionsSchema)
  .handler(async ({ data }) => {
    const { getDb } = await import("@/server/db")
    return { sessions: getDb().listSessions(data.agentId) }
  })

export const getSessionDetail = createServerFn({ method: "GET" })
  .validator(sessionIdSchema)
  .handler(async ({ data }) => {
    const { getDb } = await import("@/server/db")
    return getDb().getSessionDetail(data.sessionId)
  })

export const listMountedSessionFiles = createServerFn({ method: "GET" })
  .validator(sessionIdSchema)
  .handler(async ({ data }) => {
    try {
      const { getAnthropicClient, MANAGED_AGENTS_BETAS } =
        await import("@/server/anthropic")
      const { fetchMountedSessionFiles } =
        await import("@/server/session-event-files")

      return {
        files: await fetchMountedSessionFiles(
          getAnthropicClient(),
          data.sessionId,
          MANAGED_AGENTS_BETAS
        ),
      }
    } catch (error) {
      throw await clientSafeError(error)
    }
  })

export const addSessionFileResource = createServerFn({ method: "POST" })
  .validator(addSessionFileResourceSchema)
  .handler(async ({ data }) => {
    try {
      const { getAnthropicClient, MANAGED_AGENTS_BETAS } =
        await import("@/server/anthropic")
      const { addMountedSessionFile } =
        await import("@/server/session-event-files")
      const upload = data.upload
        ? {
            filename: data.upload.filename,
            mimeType: data.upload.mimeType,
            data: decodeBase64File(data.upload.dataBase64),
          }
        : data.markdown
          ? {
              filename: data.markdown.filename,
              mimeType: "text/plain",
              data: validateUploadBuffer(
                Buffer.from(data.markdown.content, "utf8"),
                true
              ),
            }
          : undefined

      return {
        file: await addMountedSessionFile(
          getAnthropicClient(),
          data.sessionId,
          MANAGED_AGENTS_BETAS,
          {
            fileId: data.fileId,
            mountPath: data.mountPath,
            upload,
          }
        ),
      }
    } catch (error) {
      throw await clientSafeError(error)
    }
  })

export const createManagedSession = createServerFn({ method: "POST" })
  .validator(createSessionSchema)
  .handler(async ({ data }) => {
    let uploadedFileIds: Array<string> = []
    let sessionCreated = false

    try {
      const { getAnthropicClient, MANAGED_AGENTS_BETAS } =
        await import("@/server/anthropic")
      const { getDb } = await import("@/server/db")
      const { mapExistingFileResources, uploadMarkdownResources } =
        await import("@/server/session-resources")
      const client = getAnthropicClient()
      const uploadedResources = await uploadMarkdownResources(
        client,
        data.markdownResources ?? []
      )
      const sessionResources = [
        ...uploadedResources.sessionResources,
        ...mapExistingFileResources(data.fileResources ?? []),
      ]
      uploadedFileIds = uploadedResources.uploaded.map(
        (resource) => resource.fileId
      )
      const session = await client.beta.sessions.create({
        agent: data.agentId,
        environment_id: data.environmentId,
        title: data.title?.trim() || null,
        metadata: {
          app: "oma-demo",
        },
        ...(sessionResources.length > 0 ? { resources: sessionResources } : {}),
        betas: MANAGED_AGENTS_BETAS,
      })
      sessionCreated = true

      return {
        session: getDb().upsertSession(toJsonRecord(session)),
        resources: uploadedResources.uploaded,
      }
    } catch (error) {
      if (!sessionCreated && uploadedFileIds.length > 0) {
        const { getAnthropicClient } = await import("@/server/anthropic")
        const { deleteUploadedFiles } =
          await import("@/server/session-resources")
        await deleteUploadedFiles(getAnthropicClient(), uploadedFileIds)
      }
      throw await clientSafeError(error)
    }
  })

export const syncManagedSession = createServerFn({ method: "POST" })
  .validator(sessionIdSchema)
  .handler(async ({ data }) => {
    try {
      return await syncSessionHistory(data.sessionId)
    } catch (error) {
      throw await clientSafeError(error)
    }
  })

export const sendSessionMessage = createServerFn({ method: "POST" })
  .validator(sendMessageSchema)
  .handler(async ({ data }) => {
    try {
      const client = await getClientForTurn()
      const { buildUserMessageContent, fetchMountedSessionFiles } =
        await import("@/server/session-event-files")
      const betas = await managedAgentBetas()
      const fileIds = data.fileIds ?? []
      const mountedFiles =
        fileIds.length > 0
          ? await fetchMountedSessionFiles(
              client,
              data.sessionId,
              betas,
              fileIds
            )
          : []
      const content = buildUserMessageContent(
        data.content,
        fileIds,
        mountedFiles
      )

      return await runStreamedTurn(data.sessionId, async (turnClient) => {
        const sent = await turnClient.beta.sessions.events.send(
          data.sessionId,
          {
            betas,
            events: [
              {
                type: "user.message",
                content,
              },
            ],
          }
        )

        const { getDb } = await import("@/server/db")
        for (const event of sent.data ?? []) {
          getDb().insertSessionEvent(data.sessionId, toJsonRecord(event))
        }
      })
    } catch (error) {
      await markSessionError(data.sessionId, error)
      throw await clientSafeError(error)
    }
  })

export const sendToolConfirmation = createServerFn({ method: "POST" })
  .validator(confirmToolSchema)
  .handler(async ({ data }) => {
    try {
      return await runStreamedTurn(data.sessionId, async (client) => {
        const sent = await client.beta.sessions.events.send(data.sessionId, {
          betas: await managedAgentBetas(),
          events: [
            {
              type: "user.tool_confirmation",
              tool_use_id: data.eventId,
              result: data.result,
              ...(data.result === "deny" && data.denyMessage?.trim()
                ? { deny_message: data.denyMessage.trim() }
                : {}),
            },
          ],
        })

        const { getDb } = await import("@/server/db")
        for (const event of sent.data ?? []) {
          getDb().insertSessionEvent(data.sessionId, toJsonRecord(event))
        }
      })
    } catch (error) {
      await markSessionError(data.sessionId, error)
      throw await clientSafeError(error)
    }
  })

export const sendCustomToolResult = createServerFn({ method: "POST" })
  .validator(customToolResultSchema)
  .handler(async ({ data }) => {
    try {
      return await runStreamedTurn(data.sessionId, async (client) => {
        const sent = await client.beta.sessions.events.send(data.sessionId, {
          betas: await managedAgentBetas(),
          events: [
            {
              type: "user.custom_tool_result",
              custom_tool_use_id: data.eventId,
              is_error: data.isError === true,
              content: [{ type: "text", text: data.content }],
            },
          ],
        })

        const { getDb } = await import("@/server/db")
        for (const event of sent.data ?? []) {
          getDb().insertSessionEvent(data.sessionId, toJsonRecord(event))
        }
      })
    } catch (error) {
      await markSessionError(data.sessionId, error)
      throw await clientSafeError(error)
    }
  })

async function syncSessionHistory(
  sessionId: string
): Promise<SessionDetailResponse & { imported: number }> {
  const { getAnthropicClient, MANAGED_AGENTS_BETAS } =
    await import("@/server/anthropic")
  const { getDb } = await import("@/server/db")
  const client = getAnthropicClient()
  const db = getDb()
  const session = await client.beta.sessions.retrieve(sessionId, {
    betas: MANAGED_AGENTS_BETAS,
  })

  db.upsertSession(toJsonRecord(session))

  let imported = 0
  for await (const event of client.beta.sessions.events.list(sessionId, {
    betas: MANAGED_AGENTS_BETAS,
    limit: 100,
    order: "asc",
  })) {
    db.insertSessionEvent(sessionId, toJsonRecord(event))
    imported += 1
    if (imported >= 500) {
      break
    }
  }

  return {
    ...db.getSessionDetail(sessionId),
    imported,
  }
}

async function runStreamedTurn(
  sessionId: string,
  dispatch: (
    client: Awaited<ReturnType<typeof getClientForTurn>>
  ) => Promise<void>
): Promise<SessionDetailResponse> {
  const { getDb } = await import("@/server/db")
  const client = await getClientForTurn()
  const db = getDb()
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), 120_000)

  try {
    const stream = await client.beta.sessions.events.stream(
      sessionId,
      {
        betas: await managedAgentBetas(),
        event_deltas: ["agent.message"],
      },
      { signal: abortController.signal }
    )

    await dispatch(client)

    for await (const event of stream) {
      if (event.type !== "event_start" && event.type !== "event_delta") {
        db.insertSessionEvent(sessionId, toJsonRecord(event))
      }

      if (
        event.type === "session.status_idle" ||
        event.type === "session.status_terminated" ||
        event.type === "session.error"
      ) {
        break
      }
    }

    return db.getSessionDetail(sessionId)
  } finally {
    clearTimeout(timeout)
  }
}

async function getClientForTurn() {
  const { getAnthropicClient } = await import("@/server/anthropic")
  return getAnthropicClient()
}

async function managedAgentBetas() {
  const { MANAGED_AGENTS_BETAS } = await import("@/server/anthropic")
  return MANAGED_AGENTS_BETAS
}

async function markSessionError(sessionId: string, error: unknown) {
  const { getDb } = await import("@/server/db")
  const { redactSecrets } = await import("@/server/anthropic")
  getDb().markSessionError(sessionId, redactSecrets(error))
}

async function clientSafeError(error: unknown) {
  const { redactSecrets } = await import("@/server/anthropic")
  return new Error(redactSecrets(error))
}

function toJsonRecord(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord
  }

  return {}
}

function decodeBase64File(value: string) {
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new Error("Uploaded file data is not valid base64")
  }

  return validateUploadBuffer(Buffer.from(value, "base64"))
}

function validateUploadBuffer(data: Buffer, allowEmpty = false) {
  if ((!allowEmpty && data.length === 0) || data.length > MAX_UPLOAD_BYTES) {
    throw new Error(
      allowEmpty
        ? "Uploaded files must not exceed 10 MB"
        : "Uploaded files must be between 1 byte and 10 MB"
    )
  }

  return data
}
