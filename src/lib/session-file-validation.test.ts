import { describe, expect, test } from "bun:test"

import {
  isMarkdownFilenameValid,
  isMountPathValid,
  normalizeMarkdownFilename,
} from "@/lib/session-file-validation"

describe("会话文件校验", () => {
  test("补全 Markdown 扩展名并拒绝非法文件名", () => {
    expect(normalizeMarkdownFilename(" context ")).toBe("context.md")
    expect(isMarkdownFilenameValid("context.md")).toBe(true)
    expect(isMarkdownFilenameValid("invalid/name.md")).toBe(false)
    expect(isMarkdownFilenameValid("invalid\u0000.md")).toBe(false)
  })

  test("按入口语义处理空挂载路径", () => {
    expect(isMountPathValid("")).toBe(true)
    expect(isMountPathValid("", false)).toBe(false)
    expect(isMountPathValid("/context.md", false)).toBe(true)
    expect(isMountPathValid("/parent/../context.md", false)).toBe(false)
  })
})
