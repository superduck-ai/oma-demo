import { describe, expect, test } from "bun:test"
import type Anthropic from "@anthropic-ai/sdk"

import type { MountedSessionFile } from "@/lib/managed-agents"

import {
  addMountedSessionFile,
  buildUserMessageContent,
  fetchMountedSessionFiles,
} from "./session-event-files"

describe("Session event files", () => {
  test("mounts an existing Files API object and returns its display metadata", async () => {
    const addRequests: Array<unknown> = []
    const client = {
      beta: {
        files: {
          retrieveMetadata: async () => ({
            id: "file_existing",
            filename: "existing.pdf",
            mime_type: "application/pdf",
            size_bytes: 2048,
          }),
        },
        sessions: {
          resources: {
            add: async (sessionId: string, input: unknown) => {
              addRequests.push({ sessionId, input })
              return {
                id: "sesrsc_existing",
                mount_path: "/data/existing.pdf",
              }
            },
          },
        },
      },
    } as unknown as Anthropic

    await expect(
      addMountedSessionFile(client, "sesn_test", [], {
        fileId: "file_existing",
        mountPath: "/data/existing.pdf",
      })
    ).resolves.toEqual({
      resourceId: "sesrsc_existing",
      fileId: "file_existing",
      filename: "existing.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
      mountPath: "/data/existing.pdf",
    })
    expect(addRequests).toEqual([
      {
        sessionId: "sesn_test",
        input: {
          type: "file",
          file_id: "file_existing",
          mount_path: "/data/existing.pdf",
          betas: [],
        },
      },
    ])
  })

  test("uploads generated content before mounting it", async () => {
    const receivedFiles: Array<File> = []
    const client = {
      beta: {
        files: {
          upload: async ({ file }: { file: File }) => {
            receivedFiles.push(file)
            return {
              id: "file_markdown",
              filename: file.name,
              mime_type: file.type,
              size_bytes: file.size,
            }
          },
        },
        sessions: {
          resources: {
            add: async () => ({
              id: "sesrsc_markdown",
              mount_path: "/context.md",
            }),
          },
        },
      },
    } as unknown as Anthropic

    const result = await addMountedSessionFile(client, "sesn_test", [], {
      mountPath: "/context.md",
      upload: {
        filename: "context.md",
        mimeType: "text/plain",
        data: Buffer.from("# Context"),
      },
    })

    expect(receivedFiles).toHaveLength(1)
    expect(receivedFiles[0]?.name).toBe("context.md")
    expect(receivedFiles[0]?.type).toBe("text/plain;charset=utf-8")
    expect(await receivedFiles[0]?.text()).toBe("# Context")
    expect(result.fileId).toBe("file_markdown")
  })

  test("deletes a newly uploaded file when mounting fails", async () => {
    const deleted: Array<string> = []
    const client = {
      beta: {
        files: {
          upload: async () => ({
            id: "file_orphan",
            filename: "orphan.txt",
            mime_type: "text/plain",
            size_bytes: 1,
          }),
          delete: async (uploadedFileId: string) => {
            deleted.push(uploadedFileId)
          },
        },
        sessions: {
          resources: {
            add: async () => {
              throw new Error("mount failed")
            },
          },
        },
      },
    } as unknown as Anthropic

    await expect(
      addMountedSessionFile(client, "sesn_test", [], {
        upload: {
          filename: "orphan.txt",
          mimeType: "text/plain",
          data: Buffer.from("x"),
        },
      })
    ).rejects.toThrow("mount failed")
    expect(deleted).toEqual(["file_orphan"])
  })

  test("lists mounted files with metadata, stable sorting, and duplicate removal", async () => {
    const metadataRequests: Array<string> = []
    const client = {
      beta: {
        sessions: {
          resources: {
            list: () =>
              asyncItems([
                {
                  id: "sesrsc_2",
                  type: "file",
                  file_id: "file_zulu",
                  mount_path: "/data/zulu.pdf",
                },
                {
                  id: "sesrsc_repo",
                  type: "github_repository",
                  url: "https://example.com/repo.git",
                },
                {
                  id: "sesrsc_1",
                  type: "file",
                  file_id: "file_alpha",
                  mount_path: "/data/alpha.png",
                },
                {
                  id: "sesrsc_duplicate",
                  type: "file",
                  file_id: "file_alpha",
                  mount_path: "/data/duplicate.png",
                },
              ]),
          },
        },
        files: {
          retrieveMetadata: async (fileId: string) => {
            metadataRequests.push(fileId)
            return fileId === "file_alpha"
              ? {
                  filename: "alpha.png",
                  mime_type: "image/png",
                  size_bytes: 2048,
                }
              : {
                  filename: "zulu.pdf",
                  mime_type: "application/pdf",
                  size_bytes: 4096,
                }
          },
        },
      },
    } as unknown as Anthropic

    await expect(
      fetchMountedSessionFiles(client, "sesn_test", [])
    ).resolves.toEqual([
      {
        resourceId: "sesrsc_1",
        fileId: "file_alpha",
        filename: "alpha.png",
        mimeType: "image/png",
        sizeBytes: 2048,
        mountPath: "/data/alpha.png",
      },
      {
        resourceId: "sesrsc_2",
        fileId: "file_zulu",
        filename: "zulu.pdf",
        mimeType: "application/pdf",
        sizeBytes: 4096,
        mountPath: "/data/zulu.pdf",
      },
    ])
    expect(metadataRequests.sort()).toEqual(["file_alpha", "file_zulu"])
  })

  test("only resolves requested file metadata while sending", async () => {
    const metadataRequests: Array<string> = []
    const client = {
      beta: {
        sessions: {
          resources: {
            list: () =>
              asyncItems([
                {
                  id: "sesrsc_selected",
                  type: "file",
                  file_id: "file_selected",
                  mount_path: "/selected.txt",
                },
                {
                  id: "sesrsc_other",
                  type: "file",
                  file_id: "file_other",
                  mount_path: "/other.txt",
                },
              ]),
          },
        },
        files: {
          retrieveMetadata: async (fileId: string) => {
            metadataRequests.push(fileId)
            return {
              filename: `${fileId}.txt`,
              mime_type: "text/plain",
              size_bytes: 10,
            }
          },
        },
      },
    } as unknown as Anthropic

    const files = await fetchMountedSessionFiles(
      client,
      "sesn_test",
      [],
      ["file_selected"]
    )

    expect(files.map((file) => file.fileId)).toEqual(["file_selected"])
    expect(metadataRequests).toEqual(["file_selected"])
  })

  test("limits metadata concurrency and degrades individual list failures", async () => {
    let activeRequests = 0
    let maximumActiveRequests = 0
    const resources = Array.from({ length: 20 }, (_, index) => ({
      id: `sesrsc_${index}`,
      type: "file",
      file_id: `file_${index}`,
      mount_path: `/file-${index}.txt`,
    }))
    const client = {
      beta: {
        sessions: {
          resources: {
            list: () => asyncItems(resources),
          },
        },
        files: {
          retrieveMetadata: async (fileId: string) => {
            activeRequests += 1
            maximumActiveRequests = Math.max(
              maximumActiveRequests,
              activeRequests
            )
            await new Promise((resolve) => setTimeout(resolve, 2))
            activeRequests -= 1

            if (fileId === "file_7") {
              throw new Error("metadata unavailable")
            }
            return {
              filename: `${fileId}.txt`,
              mime_type: "text/plain",
              size_bytes: 10,
            }
          },
        },
      },
    } as unknown as Anthropic

    const files = await fetchMountedSessionFiles(client, "sesn_test", [])
    const fallback = files.find((file) => file.fileId === "file_7")

    expect(files).toHaveLength(20)
    expect(maximumActiveRequests).toBeGreaterThan(1)
    expect(maximumActiveRequests).toBeLessThanOrEqual(8)
    expect(fallback).toEqual({
      resourceId: "sesrsc_7",
      fileId: "file_7",
      filename: "file_7",
      mimeType: "application/octet-stream",
      sizeBytes: 0,
      mountPath: "/file-7.txt",
    })
    await expect(
      fetchMountedSessionFiles(client, "sesn_test", [], ["file_7"])
    ).rejects.toThrow("metadata unavailable")
  })

  test("builds text, image, and document content blocks and removes duplicates", () => {
    expect(
      buildUserMessageContent(
        "  Analyze these files.  ",
        ["file_image", "file_document", "file_image"],
        [
          mountedFile("file_image", " IMAGE/PNG; charset=binary "),
          mountedFile("file_document", "application/pdf"),
        ]
      )
    ).toEqual([
      { type: "text", text: "Analyze these files." },
      {
        type: "image",
        source: { type: "file", file_id: "file_image" },
      },
      {
        type: "document",
        source: { type: "file", file_id: "file_document" },
      },
    ])
  })

  test("supports an attachment-only message", () => {
    expect(
      buildUserMessageContent(
        undefined,
        ["file_document"],
        [mountedFile("file_document", "text/plain")]
      )
    ).toEqual([
      {
        type: "document",
        source: { type: "file", file_id: "file_document" },
      },
    ])
  })

  test("rejects an unmounted file and an empty message", () => {
    expect(() =>
      buildUserMessageContent(undefined, ["file_missing"], [])
    ).toThrow("File file_missing is not mounted in this session")
    expect(() => buildUserMessageContent("   ", [], [])).toThrow(
      "A message must include text or at least one file"
    )
  })
})

function mountedFile(fileId: string, mimeType: string): MountedSessionFile {
  return {
    resourceId: `sesrsc_${fileId}`,
    fileId,
    filename: `${fileId}.bin`,
    mimeType,
    sizeBytes: 1,
    mountPath: `/data/${fileId}.bin`,
  }
}

function asyncItems<T>(items: Array<T>): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      yield* items
    },
  }
}
