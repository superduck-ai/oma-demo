export const MARKDOWN_FILENAME_PATTERN = /^[^<>:"|?*/\\]+\.md$/i

export function normalizeMarkdownFilename(filename: string) {
  const trimmed = filename.trim()
  if (!trimmed) {
    return ""
  }
  return /\.md$/i.test(trimmed) ? trimmed : `${trimmed}.md`
}

export function isMarkdownFilenameValid(filename: string) {
  return (
    filename.length > 3 &&
    filename.length <= 255 &&
    MARKDOWN_FILENAME_PATTERN.test(filename) &&
    !containsControlCharacters(filename)
  )
}

export function isMountPathValid(value: string, allowEmpty = true) {
  const path = value.trim()
  return (
    (allowEmpty && path.length === 0) ||
    (path.startsWith("/") &&
      path.length <= 1024 &&
      !containsControlCharacters(path) &&
      !path.split("/").some((segment) => segment === ".."))
  )
}

export function containsControlCharacters(value: string) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127
  })
}
