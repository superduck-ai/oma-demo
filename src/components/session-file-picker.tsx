import {
  CheckIcon,
  FileImageIcon,
  FilePlus2Icon,
  FileTextIcon,
  Loader2Icon,
  PaperclipIcon,
  RefreshCcwIcon,
  XIcon,
} from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import type { MountedSessionFile } from "@/lib/managed-agents"
import { cn } from "@/lib/utils"

const MAX_UPLOAD_BYTES = 10_000_000
type AddResourceMode = "upload" | "file_id" | "markdown"

export type SessionFileResourceDraft =
  | { type: "upload"; file: File; mountPath?: string }
  | { type: "file_id"; fileId: string; mountPath?: string }
  | {
      type: "markdown"
      filename: string
      content: string
      mountPath?: string
    }

export function SessionFilePicker({
  files,
  selectedFileIds,
  loading,
  error,
  disabled,
  onChange,
  onRefresh,
  onAddResource,
}: {
  files: Array<MountedSessionFile>
  selectedFileIds: Array<string>
  loading: boolean
  error: unknown
  disabled: boolean
  onChange: (fileIds: Array<string>) => void
  onRefresh: () => void
  onAddResource: (draft: SessionFileResourceDraft) => Promise<string>
}) {
  const [addPanelOpen, setAddPanelOpen] = React.useState(false)
  const [addMode, setAddMode] = React.useState<AddResourceMode>("upload")
  const [fileId, setFileId] = React.useState("")
  const [uploadFile, setUploadFile] = React.useState<File | null>(null)
  const [markdownFilename, setMarkdownFilename] = React.useState("context.md")
  const [markdownContent, setMarkdownContent] = React.useState(
    "# Session Context\n\n"
  )
  const [mountPath, setMountPath] = React.useState("")
  const [addError, setAddError] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [uploadInputKey, setUploadInputKey] = React.useState(0)
  const selected = new Set(selectedFileIds)
  const normalizedMarkdownFilename = normalizeMarkdownFilename(markdownFilename)
  const mountPathValid = isMountPathValid(mountPath)
  const canAdd =
    !adding &&
    mountPathValid &&
    ((addMode === "upload" &&
      Boolean(uploadFile) &&
      uploadFile!.size > 0 &&
      uploadFile!.size <= MAX_UPLOAD_BYTES) ||
      (addMode === "file_id" && /^file_[A-Za-z0-9]+$/.test(fileId.trim())) ||
      (addMode === "markdown" &&
        isMarkdownFilenameValid(normalizedMarkdownFilename) &&
        new TextEncoder().encode(markdownContent).length <= MAX_UPLOAD_BYTES))

  function toggle(toggledFileId: string) {
    onChange(
      selected.has(toggledFileId)
        ? selectedFileIds.filter((value) => value !== toggledFileId)
        : [...selectedFileIds, toggledFileId]
    )
  }

  async function addResource() {
    if (!canAdd) {
      return
    }

    setAdding(true)
    setAddError(null)

    try {
      const normalizedMountPath = mountPath.trim() || undefined
      const normalizedFileId = fileId.trim()
      if (
        addMode === "file_id" &&
        files.some((file) => file.fileId === normalizedFileId)
      ) {
        onChange([...new Set([...selectedFileIds, normalizedFileId])])
        resetAddForm()
        return
      }
      const addedFileId = await onAddResource(
        addMode === "upload"
          ? {
              type: "upload",
              file: uploadFile!,
              mountPath: normalizedMountPath,
            }
          : addMode === "file_id"
            ? {
                type: "file_id",
                fileId: normalizedFileId,
                mountPath: normalizedMountPath,
              }
            : {
                type: "markdown",
                filename: normalizedMarkdownFilename,
                content: markdownContent,
                mountPath:
                  normalizedMountPath || `/${normalizedMarkdownFilename}`,
              }
      )

      onChange([...new Set([...selectedFileIds, addedFileId])])
      resetAddForm()
    } catch (caughtError) {
      setAddError(
        caughtError instanceof Error
          ? caughtError.message
          : "Add resource failed"
      )
    } finally {
      setAdding(false)
    }
  }

  function resetAddForm() {
    setAddPanelOpen(false)
    setFileId("")
    setUploadFile(null)
    setMarkdownFilename("context.md")
    setMarkdownContent("# Session Context\n\n")
    setMountPath("")
    setAddError(null)
    setUploadInputKey((current) => current + 1)
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) {
          onRefresh()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={disabled}
          aria-label="Attach a Session file"
          className="relative"
        >
          <PaperclipIcon />
          {selectedFileIds.length > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {selectedFileIds.length}
            </span>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle>Attach Session files</DialogTitle>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant={addPanelOpen ? "secondary" : "ghost"}
                disabled={adding}
                onClick={() => {
                  setAddPanelOpen((open) => !open)
                  setAddError(null)
                }}
              >
                <FilePlus2Icon />
                Add Resource
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={loading || adding}
                aria-label="Refresh Session files"
                onClick={onRefresh}
              >
                {loading ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <RefreshCcwIcon />
                )}
              </Button>
            </div>
          </div>
          <DialogDescription>
            Select files already mounted in this Session, or add a new resource.
            Messages reference files by ID; worker paths are resolved
            server-side.
          </DialogDescription>
        </DialogHeader>

        {addPanelOpen && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["upload", "Upload file"],
                  ["file_id", "File ID"],
                  ["markdown", "Markdown"],
                ] as const
              ).map(([mode, label]) => (
                <Button
                  key={mode}
                  type="button"
                  size="xs"
                  variant={addMode === mode ? "secondary" : "ghost"}
                  disabled={adding}
                  onClick={() => {
                    setAddMode(mode)
                    setAddError(null)
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>

            {addMode === "upload" && (
              <div className="space-y-1.5">
                <Label htmlFor="session-resource-upload">Local file</Label>
                <Input
                  key={uploadInputKey}
                  id="session-resource-upload"
                  type="file"
                  disabled={adding}
                  onChange={(event) =>
                    setUploadFile(event.target.files?.[0] ?? null)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Maximum file size: 10 MB.
                </p>
              </div>
            )}

            {addMode === "file_id" && (
              <div className="space-y-1.5">
                <Label htmlFor="session-resource-file-id">File ID</Label>
                <Input
                  id="session-resource-file-id"
                  value={fileId}
                  placeholder="file_..."
                  disabled={adding}
                  spellCheck={false}
                  onChange={(event) => setFileId(event.target.value)}
                />
              </div>
            )}

            {addMode === "markdown" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="session-resource-markdown-filename">
                    Filename
                  </Label>
                  <Input
                    id="session-resource-markdown-filename"
                    value={markdownFilename}
                    disabled={adding}
                    spellCheck={false}
                    onChange={(event) =>
                      setMarkdownFilename(event.target.value)
                    }
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="session-resource-markdown-content">
                    Markdown
                  </Label>
                  <Textarea
                    id="session-resource-markdown-content"
                    value={markdownContent}
                    disabled={adding}
                    spellCheck={false}
                    className="min-h-32 resize-y font-mono text-xs"
                    onChange={(event) => setMarkdownContent(event.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="session-resource-mount-path">Mount path</Label>
              <Input
                id="session-resource-mount-path"
                value={mountPath}
                placeholder={
                  addMode === "markdown"
                    ? `/${normalizedMarkdownFilename || "context.md"}`
                    : "Optional"
                }
                disabled={adding}
                spellCheck={false}
                onChange={(event) => setMountPath(event.target.value)}
              />
              {!mountPathValid && (
                <p className="text-xs text-destructive">
                  Mount path must be absolute and cannot contain '..'.
                </p>
              )}
            </div>

            {addError && <p className="text-xs text-destructive">{addError}</p>}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={adding}
                onClick={resetAddForm}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canAdd}
                onClick={() => void addResource()}
              >
                {adding ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <CheckIcon />
                )}
                Add and select
              </Button>
            </div>
          </div>
        )}

        <ScrollArea className="max-h-[22rem] min-h-40 rounded-md border">
          <div className="space-y-1 p-2">
            {files.map((file) => {
              const isSelected = selected.has(file.fileId)
              const FileIcon = file.mimeType.startsWith("image/")
                ? FileImageIcon
                : FileTextIcon

              return (
                <button
                  key={file.fileId}
                  type="button"
                  aria-pressed={isSelected}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition hover:bg-muted",
                    isSelected && "border-primary/40 bg-primary/5"
                  )}
                  onClick={() => toggle(file.fileId)}
                >
                  <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {file.filename}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {file.mountPath} · {formatBytes(file.sizeBytes)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded border",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input"
                    )}
                  >
                    {isSelected && <CheckIcon className="size-3.5" />}
                  </span>
                </button>
              )
            })}

            {loading && files.length === 0 && (
              <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Loading Session files...
              </div>
            )}

            {!loading && Boolean(error) && (
              <div className="flex min-h-36 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-destructive">
                <span>Failed to load Session files.</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onRefresh}
                >
                  <RefreshCcwIcon />
                  Retry
                </Button>
              </div>
            )}

            {!loading && !error && files.length === 0 && (
              <div className="flex min-h-36 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                No file resources are mounted in this Session.
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <span className="mr-auto self-center text-xs text-muted-foreground">
            {selectedFileIds.length} selected
          </span>
          <DialogClose asChild>
            <Button type="button">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SelectedSessionFiles({
  files,
  selectedFileIds,
  disabled,
  onRemove,
}: {
  files: Array<MountedSessionFile>
  selectedFileIds: Array<string>
  disabled: boolean
  onRemove: (fileId: string) => void
}) {
  if (selectedFileIds.length === 0) {
    return null
  }

  const filesById = new Map(files.map((file) => [file.fileId, file] as const))

  return (
    <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
      {selectedFileIds.map((fileId) => {
        const file = filesById.get(fileId)

        return (
          <span
            key={fileId}
            className="flex max-w-full items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs"
          >
            <PaperclipIcon className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate">{file?.filename ?? fileId}</span>
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove ${file?.filename ?? fileId}`}
              className="rounded-sm text-muted-foreground transition hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              onClick={() => onRemove(fileId)}
            >
              <XIcon className="size-3" />
            </button>
          </span>
        )
      })}
    </div>
  )
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function normalizeMarkdownFilename(filename: string) {
  const trimmed = filename.trim()
  if (!trimmed) {
    return ""
  }
  return /\.md$/i.test(trimmed) ? trimmed : `${trimmed}.md`
}

function isMarkdownFilenameValid(filename: string) {
  return (
    filename.length > 3 &&
    filename.length <= 255 &&
    !/[<>:"|?*/\\]/.test(filename.replace(/\.md$/i, "")) &&
    !containsControlCharacters(filename)
  )
}

function isMountPathValid(value: string) {
  const path = value.trim()
  return (
    path.length === 0 ||
    (path.startsWith("/") &&
      path.length <= 1024 &&
      !path.split("/").some((segment) => segment === ".."))
  )
}

function containsControlCharacters(value: string) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127
  })
}
