import { afterEach, describe, expect, test } from "bun:test"

import { redactSecrets } from "./anthropic"

const originalApiKey = process.env.API_KEY

afterEach(() => {
  process.env.API_KEY = originalApiKey
})

describe("redactSecrets", () => {
  test("removes API_KEY from error messages", () => {
    process.env.API_KEY = "test-api-key-should-not-leak"

    const message = redactSecrets(
      new Error("request failed with test-api-key-should-not-leak")
    )

    expect(message).toBe("request failed with [redacted-api-key]")
    expect(message).not.toContain("test-api-key-should-not-leak")
  })
})
