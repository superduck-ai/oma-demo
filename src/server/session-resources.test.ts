import { describe, expect, test } from "bun:test"
import type Anthropic from "@anthropic-ai/sdk"

import {
  deleteUploadedFiles,
  mapExistingFileResources,
  uploadMarkdownResources,
} from "./session-resources"

describe("Session resources", () => {
  test("maps existing file IDs without taking ownership of the files", () => {
    expect(
      mapExistingFileResources([
        {
          fileId: " file_existing ",
          mountPath: " /data/context.md ",
        },
        {
          fileId: "file_default_path",
        },
      ])
    ).toEqual([
      {
        type: "file",
        file_id: "file_existing",
        mount_path: "/data/context.md",
      },
      {
        type: "file",
        file_id: "file_default_path",
      },
    ])
  })

  test("uploads generated markdown and builds session resource params", async () => {
    const receivedFiles: Array<File> = []
    const client = {
      beta: {
        files: {
          upload: async ({ file }: { file: File }) => {
            receivedFiles.push(file)
            return { id: `file_${receivedFiles.length}` }
          },
        },
      },
    } as unknown as Anthropic

    const result = await uploadMarkdownResources(client, [
      {
        filename: "context.md",
        mountPath: "/docs/context.md",
        content: "# Context\n\nGenerated in memory.",
      },
      {
        filename: "instructions.md",
        content: "# Instructions",
      },
    ])

    expect(receivedFiles).toHaveLength(2)
    expect(receivedFiles[0]?.name).toBe("context.md")
    expect(receivedFiles[0]?.type).toBe("text/plain;charset=utf-8")
    expect(await receivedFiles[0]?.text()).toBe(
      "# Context\n\nGenerated in memory."
    )
    expect(result.sessionResources).toEqual([
      {
        type: "file",
        file_id: "file_1",
        mount_path: "/docs/context.md",
      },
      {
        type: "file",
        file_id: "file_2",
        mount_path: "/instructions.md",
      },
    ])
  })

  test("deletes every uploaded file without failing on one rejected delete", async () => {
    const deleted: Array<string> = []
    const client = {
      beta: {
        files: {
          delete: async (fileId: string) => {
            deleted.push(fileId)
            if (fileId === "file_2") {
              throw new Error("already deleted")
            }
          },
        },
      },
    } as unknown as Anthropic

    await expect(
      deleteUploadedFiles(client, ["file_1", "file_2", "file_3"])
    ).resolves.toBeUndefined()
    expect(deleted).toEqual(["file_1", "file_2", "file_3"])
  })
})
