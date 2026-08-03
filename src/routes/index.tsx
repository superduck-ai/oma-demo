import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useServerFn } from "@tanstack/react-start"
import {
  ActivityIcon,
  AlertCircleIcon,
  BotIcon,
  CheckIcon,
  ChevronRightIcon,
  CodeIcon,
  DatabaseIcon,
  FileKey2Icon,
  FilePlus2Icon,
  FileTextIcon,
  KeyRoundIcon,
  Loader2Icon,
  MessageSquareIcon,
  PencilIcon,
  PlugZapIcon,
  PlusIcon,
  RefreshCcwIcon,
  SendIcon,
  ShieldCheckIcon,
  SquareIcon,
  TerminalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import * as React from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  VAULT_ID_PATTERN,
  type ExistingFileSessionResource,
  type JsonRecord,
  type ManagedVaultOption,
  type MarkdownSessionResource,
  type PendingAction,
  type SessionDetailResponse,
  type StoredSession,
  type StoredSessionEvent,
} from "@/lib/managed-agents"
import {
  createManagedSession,
  getAppConfig,
  getSessionDetail,
  listAvailableManagedAgents,
  listAvailableManagedEnvironments,
  listAvailableManagedVaults,
  listLocalSessions,
  sendCustomToolResult,
  sendSessionMessage,
  sendToolConfirmation,
  syncManagedSession,
} from "@/lib/managed-agents-functions"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/")({ component: App })

type TurnState = "idle" | "running" | "ended" | "error"
type EditableMarkdownResource = MarkdownSessionResource & { id: string }
type EditableFileResource = ExistingFileSessionResource & { id: string }
type VaultCatalogProps = {
  vaults: Array<ManagedVaultOption>
  vaultIds: Array<string>
  query: {
    isLoading: boolean
    isFetching: boolean
    isError: boolean
    error: unknown
  }
  onVaultIdsChange: React.Dispatch<React.SetStateAction<Array<string>>>
}

const STORAGE_KEYS = {
  agentId: "oma-demo.agent-id",
  environmentId: "oma-demo.environment-id",
  vaultIds: "oma-demo.vault-ids",
  activeSessionId: "oma-demo.active-session-id",
}

function App() {
  const queryClient = useQueryClient()
  const getConfigFn = useServerFn(getAppConfig)
  const listAgentsFn = useServerFn(listAvailableManagedAgents)
  const listEnvironmentsFn = useServerFn(listAvailableManagedEnvironments)
  const listVaultsFn = useServerFn(listAvailableManagedVaults)
  const listSessionsFn = useServerFn(listLocalSessions)
  const getDetailFn = useServerFn(getSessionDetail)
  const createSessionFn = useServerFn(createManagedSession)
  const syncSessionFn = useServerFn(syncManagedSession)
  const sendMessageFn = useServerFn(sendSessionMessage)
  const confirmToolFn = useServerFn(sendToolConfirmation)
  const customToolResultFn = useServerFn(sendCustomToolResult)
  const [agentId, setAgentId] = React.useState("")
  const [environmentId, setEnvironmentId] = React.useState("")
  const [vaultIds, setVaultIds] = React.useState<Array<string>>([])
  const [selectionHydrated, setSelectionHydrated] = React.useState(false)
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(
    null
  )
  const [title, setTitle] = React.useState("")
  const [markdownResources, setMarkdownResources] = React.useState<
    Array<EditableMarkdownResource>
  >([])
  const [fileResources, setFileResources] = React.useState<
    Array<EditableFileResource>
  >([])
  const [resourceDialogOpen, setResourceDialogOpen] = React.useState(false)
  const [editingResourceId, setEditingResourceId] = React.useState<
    string | null
  >(null)
  const [resourceDraft, setResourceDraft] = React.useState(
    newMarkdownResourceDraft()
  )
  const [fileResourceDialogOpen, setFileResourceDialogOpen] =
    React.useState(false)
  const [editingFileResourceId, setEditingFileResourceId] = React.useState<
    string | null
  >(null)
  const [fileResourceDraft, setFileResourceDraft] = React.useState(
    newExistingFileResourceDraft()
  )
  const [message, setMessage] = React.useState(
    "请用一句话介绍当前 session 可以做什么。"
  )
  const [customToolResults, setCustomToolResults] = React.useState<
    Record<string, string>
  >({})
  const [denyMessages, setDenyMessages] = React.useState<
    Record<string, string>
  >({})
  const [busyLabel, setBusyLabel] = React.useState<string | null>(null)
  const [clientError, setClientError] = React.useState<string | null>(null)
  const [turnState, setTurnState] = React.useState<TurnState>("idle")

  React.useEffect(() => {
    setAgentId(localStorage.getItem(STORAGE_KEYS.agentId) || "")
    setEnvironmentId(localStorage.getItem(STORAGE_KEYS.environmentId) || "")
    setVaultIds(readStoredVaultIds())
    setActiveSessionId(localStorage.getItem(STORAGE_KEYS.activeSessionId))
    setSelectionHydrated(true)
  }, [])

  React.useEffect(() => {
    if (selectionHydrated && agentId) {
      localStorage.setItem(STORAGE_KEYS.agentId, agentId)
    }
  }, [agentId, selectionHydrated])

  React.useEffect(() => {
    if (selectionHydrated && environmentId) {
      localStorage.setItem(STORAGE_KEYS.environmentId, environmentId)
    }
  }, [environmentId, selectionHydrated])

  React.useEffect(() => {
    if (selectionHydrated) {
      localStorage.setItem(STORAGE_KEYS.vaultIds, JSON.stringify(vaultIds))
    }
  }, [vaultIds, selectionHydrated])

  React.useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(STORAGE_KEYS.activeSessionId, activeSessionId)
    } else {
      localStorage.removeItem(STORAGE_KEYS.activeSessionId)
    }
  }, [activeSessionId])

  const configQuery = useQuery({
    queryKey: ["config"],
    queryFn: () => getConfigFn(),
  })

  const configReady =
    configQuery.data?.apiKeyConfigured === true &&
    configQuery.data.omaServerUrlConfigured === true

  const agentsQuery = useQuery({
    queryKey: ["managed-agents"],
    queryFn: () => listAgentsFn(),
    enabled: configReady,
  })

  const environmentsQuery = useQuery({
    queryKey: ["managed-environments"],
    queryFn: () => listEnvironmentsFn(),
    enabled: configReady,
  })

  const vaultsQuery = useQuery({
    queryKey: ["managed-vaults"],
    queryFn: () => listVaultsFn(),
    enabled: configReady,
  })

  const agents = agentsQuery.data?.agents ?? []
  const environments = environmentsQuery.data?.environments ?? []
  const vaults = vaultsQuery.data?.vaults ?? []

  React.useEffect(() => {
    if (!selectionHydrated || !agentsQuery.data) {
      return
    }

    setAgentId((current) =>
      agentsQuery.data.agents.some((agent) => agent.id === current)
        ? current
        : (agentsQuery.data.agents[0]?.id ?? "")
    )
  }, [agentsQuery.data, selectionHydrated])

  React.useEffect(() => {
    if (!selectionHydrated || !environmentsQuery.data) {
      return
    }

    setEnvironmentId((current) =>
      environmentsQuery.data.environments.some(
        (environment) => environment.id === current
      )
        ? current
        : (environmentsQuery.data.environments[0]?.id ?? "")
    )
  }, [environmentsQuery.data, selectionHydrated])

  React.useEffect(() => {
    if (!selectionHydrated || !vaultsQuery.data) {
      return
    }

    const availableIds = new Set(vaultsQuery.data.vaults.map((vault) => vault.id))
    setVaultIds((current) => current.filter((vaultId) => availableIds.has(vaultId)))
  }, [vaultsQuery.data, selectionHydrated])

  const sessionsQuery = useQuery({
    queryKey: ["sessions", agentId],
    queryFn: () => listSessionsFn({ data: { agentId } }),
    enabled: agentId.trim().length > 0,
  })

  const detailQuery = useQuery({
    queryKey: ["session", activeSessionId],
    queryFn: () => getDetailFn({ data: { sessionId: activeSessionId! } }),
    enabled: Boolean(activeSessionId),
  })

  const activeSession = detailQuery.data?.session ?? null
  const sessions = sessionsQuery.data?.sessions ?? []
  const events = detailQuery.data?.events ?? []
  const pendingActions = detailQuery.data?.pendingActions ?? []
  const pendingOpenActions = pendingActions.filter(
    (action) => action.status === "pending"
  )

  async function createSession() {
    setBusyLabel("Creating session")
    setClientError(null)

    try {
      const response = await createSessionFn({
        data: {
          agentId,
          environmentId,
          title: title.trim() || undefined,
          vaultIds: vaultIds.length > 0 ? vaultIds : undefined,
          markdownResources: markdownResources.map(
            ({ filename, mountPath, content }) => ({
              filename,
              mountPath,
              content,
            })
          ),
          fileResources: fileResources.map(({ fileId, mountPath }) => ({
            fileId,
            mountPath: mountPath?.trim() || undefined,
          })),
        },
      })

      if (!response.session) {
        throw new Error("Session was created remotely but not stored locally.")
      }

      setActiveSessionId(response.session.id)
      setTitle("")
      setMarkdownResources([])
      setFileResources([])
      await queryClient.invalidateQueries({ queryKey: ["sessions", agentId] })
      await queryClient.invalidateQueries({
        queryKey: ["session", response.session.id],
      })
    } catch (error) {
      setClientError(errorMessage(error))
    } finally {
      setBusyLabel(null)
    }
  }

  async function syncSession(sessionId = activeSessionId) {
    if (!sessionId) {
      return
    }

    setBusyLabel("Syncing session")
    setClientError(null)

    try {
      const detail = await syncSessionFn({ data: { sessionId } })
      queryClient.setQueryData(["session", sessionId], detail)
      await invalidateSession(sessionId)
    } catch (error) {
      setClientError(errorMessage(error))
    } finally {
      setBusyLabel(null)
    }
  }

  function openNewMarkdownResource() {
    setEditingResourceId(null)
    setResourceDraft(newMarkdownResourceDraft())
    setResourceDialogOpen(true)
  }

  function openMarkdownResource(resource: EditableMarkdownResource) {
    setEditingResourceId(resource.id)
    setResourceDraft({
      filename: resource.filename,
      mountPath: resource.mountPath,
      content: resource.content,
    })
    setResourceDialogOpen(true)
  }

  function saveMarkdownResource() {
    const filename = normalizeMarkdownFilename(resourceDraft.filename)
    const mountPath =
      resourceDraft.mountPath?.trim() || `/${filename.replace(/^\/+/, "")}`
    const nextResource = {
      id: editingResourceId ?? crypto.randomUUID(),
      filename,
      mountPath,
      content: resourceDraft.content,
    }

    setMarkdownResources((current) =>
      editingResourceId
        ? current.map((resource) =>
            resource.id === editingResourceId ? nextResource : resource
          )
        : [...current, nextResource]
    )
    setResourceDialogOpen(false)
  }

  function openNewFileResource() {
    setEditingFileResourceId(null)
    setFileResourceDraft(newExistingFileResourceDraft())
    setFileResourceDialogOpen(true)
  }

  function openFileResource(resource: EditableFileResource) {
    setEditingFileResourceId(resource.id)
    setFileResourceDraft({
      fileId: resource.fileId,
      mountPath: resource.mountPath,
    })
    setFileResourceDialogOpen(true)
  }

  function saveFileResource() {
    const nextResource = {
      id: editingFileResourceId ?? crypto.randomUUID(),
      fileId: fileResourceDraft.fileId.trim(),
      mountPath: fileResourceDraft.mountPath?.trim() || undefined,
    }

    setFileResources((current) =>
      editingFileResourceId
        ? current.map((resource) =>
            resource.id === editingFileResourceId ? nextResource : resource
          )
        : [...current, nextResource]
    )
    setFileResourceDialogOpen(false)
  }

  async function sendMessage() {
    if (!activeSessionId || !message.trim()) {
      return
    }

    const content = message.trim()
    setMessage("")

    await runTurn(activeSessionId, "Sending message", () =>
      sendMessageFn({
        data: {
          sessionId: activeSessionId,
          content,
        },
      })
    )
  }

  async function confirmTool(action: PendingAction, result: "allow" | "deny") {
    await runTurn(action.sessionId, `${result} ${action.toolName}`, () =>
      confirmToolFn({
        data: {
          sessionId: action.sessionId,
          eventId: action.eventId,
          result,
          denyMessage:
            result === "deny"
              ? (denyMessages[action.eventId] ?? "").trim()
              : undefined,
        },
      })
    )
  }

  async function submitCustomToolResult(action: PendingAction) {
    const content = (customToolResults[action.eventId] ?? "").trim()
    if (!content) {
      setClientError("Custom tool result is required.")
      return
    }

    await runTurn(action.sessionId, `Resolving ${action.toolName}`, () =>
      customToolResultFn({
        data: {
          sessionId: action.sessionId,
          eventId: action.eventId,
          content,
          isError: false,
        },
      })
    )
  }

  async function invalidateSession(sessionId: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sessions", agentId] }),
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] }),
    ])
  }

  async function runTurn(
    sessionId: string,
    label: string,
    action: () => Promise<SessionDetailResponse>
  ) {
    setBusyLabel(label)
    setClientError(null)
    setTurnState("running")

    try {
      const detail = await action()
      queryClient.setQueryData(["session", sessionId], detail)
      await invalidateSession(sessionId)
      setTurnState("ended")
    } catch (error) {
      setClientError(errorMessage(error))
      setTurnState("error")
    } finally {
      setBusyLabel(null)
    }
  }

  const canCreate =
    agentId.trim().length > 0 &&
    environmentId.trim().length > 0 &&
    !busyLabel &&
    configReady

  return (
    <main className="h-svh overflow-hidden bg-muted/40">
      <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(16rem,38svh)_minmax(0,1fr)] md:grid-cols-[340px_minmax(0,1fr)] md:grid-rows-1">
        <aside className="min-h-0 overflow-hidden border-border bg-background/95 md:border-r">
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-base font-semibold tracking-normal">
                    Managed Agent Console
                  </h1>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Local OMA session harness
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() =>
                        void Promise.all([
                          configQuery.refetch(),
                          agentsQuery.refetch(),
                          environmentsQuery.refetch(),
                        ])
                      }
                    >
                      <RefreshCcwIcon />
                      <span className="sr-only">Refresh config</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh config and catalogs</TooltipContent>
                </Tooltip>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <ConfigBadge
                  icon={<PlugZapIcon />}
                  label="OMA URL"
                  ready={configQuery.data?.omaServerUrlConfigured}
                />
                <ConfigBadge
                  icon={<KeyRoundIcon />}
                  label="API key"
                  ready={configQuery.data?.apiKeyConfigured}
                />
              </div>
            </div>

            <div className="space-y-3 border-b p-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="agent-id">Agent</Label>
                  <CatalogCount
                    count={agents.length}
                    fetching={agentsQuery.isFetching}
                  />
                </div>
                <Select
                  value={agentId}
                  disabled={agents.length === 0}
                  onValueChange={setAgentId}
                >
                  <SelectTrigger id="agent-id" className="w-full min-w-0">
                    <SelectValue
                      placeholder={catalogPlaceholder(
                        agentsQuery,
                        "No agents available"
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent className="max-w-[min(28rem,calc(100vw-2rem))]">
                    {agents.map((agent) => (
                      <SelectItem
                        key={agent.id}
                        value={agent.id}
                        detail={`${agent.id} · ${agent.model} · v${agent.version}`}
                      >
                        {agent.name || agent.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <CatalogSelectionMeta id={agentId} error={agentsQuery.error} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="environment-id">Environment</Label>
                  <CatalogCount
                    count={environments.length}
                    fetching={environmentsQuery.isFetching}
                  />
                </div>
                <Select
                  value={environmentId}
                  disabled={environments.length === 0}
                  onValueChange={setEnvironmentId}
                >
                  <SelectTrigger id="environment-id" className="w-full min-w-0">
                    <SelectValue
                      placeholder={catalogPlaceholder(
                        environmentsQuery,
                        "No environments available"
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent className="max-w-[min(28rem,calc(100vw-2rem))]">
                    {environments.map((environment) => (
                      <SelectItem
                        key={environment.id}
                        value={environment.id}
                        detail={`${environment.id} · ${environment.environmentType}`}
                      >
                        {environment.name || environment.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <CatalogSelectionMeta
                  id={environmentId}
                  error={environmentsQuery.error}
                />
              </div>

              <VaultCatalogField
                vaults={vaults}
                vaultIds={vaultIds}
                query={vaultsQuery}
                onVaultIdsChange={setVaultIds}
              />

              <div className="space-y-1.5">
                <Label htmlFor="session-title">Title</Label>
                <Input
                  id="session-title"
                  value={title}
                  placeholder="Optional"
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>Resources</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={openNewFileResource}
                    >
                      <FileKey2Icon />
                      File ID
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={openNewMarkdownResource}
                    >
                      <PlusIcon />
                      Markdown
                    </Button>
                  </div>
                </div>
                {markdownResources.length + fileResources.length > 0 ? (
                  <div className="max-h-28 space-y-1 overflow-y-auto">
                    {fileResources.map((resource) => (
                      <div
                        key={resource.id}
                        className="flex items-center gap-2 rounded-md border px-2 py-1.5"
                      >
                        <FileKey2Icon className="size-3.5 shrink-0 text-muted-foreground" />
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => openFileResource(resource)}
                        >
                          <span className="block truncate text-xs font-medium">
                            {resource.fileId}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {resource.mountPath || "Default mount path"}
                          </span>
                        </button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              onClick={() =>
                                setFileResources((current) =>
                                  current.filter(
                                    (item) => item.id !== resource.id
                                  )
                                )
                              }
                            >
                              <Trash2Icon />
                              <span className="sr-only">
                                Remove {resource.fileId}
                              </span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove resource</TooltipContent>
                        </Tooltip>
                      </div>
                    ))}
                    {markdownResources.map((resource) => (
                      <div
                        key={resource.id}
                        className="flex items-center gap-2 rounded-md border px-2 py-1.5"
                      >
                        <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => openMarkdownResource(resource)}
                        >
                          <span className="block truncate text-xs font-medium">
                            {resource.filename}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {resource.mountPath}
                          </span>
                        </button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              onClick={() =>
                                setMarkdownResources((current) =>
                                  current.filter(
                                    (item) => item.id !== resource.id
                                  )
                                )
                              }
                            >
                              <Trash2Icon />
                              <span className="sr-only">
                                Remove {resource.filename}
                              </span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove resource</TooltipContent>
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md border border-dashed px-2.5 py-2 text-left text-xs text-muted-foreground transition hover:bg-muted"
                    onClick={openNewMarkdownResource}
                  >
                    <FilePlus2Icon className="size-3.5" />
                    Add a file ID or generated Markdown
                  </button>
                )}
              </div>

              <Button
                className="w-full"
                disabled={!canCreate}
                onClick={() => void createSession()}
              >
                {busyLabel === "Creating session" ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <MessageSquareIcon />
                )}
                Create session
              </Button>
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <div className="text-xs font-medium text-muted-foreground uppercase">
                Sessions
              </div>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() =>
                  void sessionsQuery.refetch().then(() => {
                    if (activeSessionId) {
                      void detailQuery.refetch()
                    }
                  })
                }
              >
                <RefreshCcwIcon />
                <span className="sr-only">Refresh sessions</span>
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1 px-2 pb-3">
              <div className="space-y-1">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition hover:bg-muted",
                      activeSessionId === session.id
                        ? "border-primary/30 bg-muted"
                        : "border-transparent"
                    )}
                    onClick={() => setActiveSessionId(session.id)}
                  >
                    <SessionStatusDot status={session.status} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {session.title || shortId(session.id)}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {shortId(session.id)} · {session.status}
                      </div>
                    </div>
                    <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                  </button>
                ))}

                {sessions.length === 0 && (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No local sessions yet.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <header className="shrink-0 border-b bg-background px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-semibold">
                    {activeSession?.title || activeSession?.id || "No session"}
                  </h2>
                  {activeSession && (
                    <Badge variant="outline">
                      <ActivityIcon />
                      {activeSession.status}
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    <DatabaseIcon />
                    SQLite
                  </Badge>
                  <Badge variant="secondary">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        turnState === "running"
                          ? "bg-emerald-500"
                          : turnState === "error"
                            ? "bg-red-500"
                            : turnState === "ended"
                              ? "bg-sky-500"
                              : "bg-muted-foreground/50"
                      )}
                    />
                    {turnState}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {activeSession
                    ? `${activeSession.agentId} · ${activeSession.environmentId}`
                    : "Create or select a session to begin."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!activeSessionId || Boolean(busyLabel)}
                  onClick={() => void syncSession()}
                >
                  <RefreshCcwIcon />
                  Sync
                </Button>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="xl:hidden">
                      <ShieldCheckIcon />
                      Actions
                      {pendingOpenActions.length > 0 && (
                        <Badge variant="secondary">
                          {pendingOpenActions.length}
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full gap-0 sm:max-w-md">
                    <SheetHeader>
                      <SheetTitle>Actions</SheetTitle>
                      <SheetDescription>
                        Tool gates and custom tool results.
                      </SheetDescription>
                    </SheetHeader>
                    <ActionsPanel
                      busy={Boolean(busyLabel)}
                      events={events}
                      pendingActions={pendingOpenActions}
                      customToolResults={customToolResults}
                      denyMessages={denyMessages}
                      onCustomToolChange={(eventId, value) =>
                        setCustomToolResults((current) => ({
                          ...current,
                          [eventId]: value,
                        }))
                      }
                      onDenyChange={(eventId, value) =>
                        setDenyMessages((current) => ({
                          ...current,
                          [eventId]: value,
                        }))
                      }
                      onAllow={(action) => void confirmTool(action, "allow")}
                      onDeny={(action) => void confirmTool(action, "deny")}
                      onCustomToolResult={(action) =>
                        void submitCustomToolResult(action)
                      }
                    />
                  </SheetContent>
                </Sheet>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!activeSessionId}
                    >
                      <CodeIcon />
                      Debug
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full gap-0 sm:max-w-2xl">
                    <SheetHeader>
                      <SheetTitle>Raw session state</SheetTitle>
                      <SheetDescription>
                        SQLite snapshot, pending actions, and persisted events.
                      </SheetDescription>
                    </SheetHeader>
                    <ScrollArea className="min-h-0 flex-1 border-t">
                      <pre className="p-4 text-xs leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(detailQuery.data ?? {}, null, 2)}
                      </pre>
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
              <MessageScrollerProvider
                autoScroll
                defaultScrollPosition="last-anchor"
                scrollPreviousItemPeek={64}
              >
                <MessageScroller className="bg-muted/20">
                  <MessageScrollerViewport>
                    <MessageScrollerContent>
                      {clientError && (
                        <MessageScrollerItem messageId="client-error">
                          <Alert variant="destructive">
                            <AlertCircleIcon />
                            <AlertTitle>Request failed</AlertTitle>
                            <AlertDescription>{clientError}</AlertDescription>
                          </Alert>
                        </MessageScrollerItem>
                      )}

                      {activeSession?.lastError && !clientError && (
                        <MessageScrollerItem messageId="server-error">
                          <Alert variant="destructive">
                            <AlertCircleIcon />
                            <AlertTitle>Last server error</AlertTitle>
                            <AlertDescription>
                              {activeSession.lastError}
                            </AlertDescription>
                          </Alert>
                        </MessageScrollerItem>
                      )}

                      {busyLabel && (
                        <MessageScrollerItem messageId="turn-busy">
                          <Alert>
                            <Loader2Icon className="animate-spin" />
                            <AlertTitle>{busyLabel}</AlertTitle>
                            <AlertDescription>
                              Waiting for the managed agent turn to settle.
                            </AlertDescription>
                          </Alert>
                        </MessageScrollerItem>
                      )}

                      {events.length === 0 && !busyLabel && (
                        <MessageScrollerItem messageId="empty-state">
                          <EmptyState />
                        </MessageScrollerItem>
                      )}

                      {events.map((event) => {
                        const messageId = `${event.eventId}-${event.localId}`

                        return (
                          <MessageScrollerItem
                            key={messageId}
                            messageId={messageId}
                            scrollAnchor={event.type === "user.message"}
                          >
                            <EventRow event={event} />
                          </MessageScrollerItem>
                        )
                      })}
                    </MessageScrollerContent>
                  </MessageScrollerViewport>
                  <MessageScrollerButton />
                </MessageScroller>
              </MessageScrollerProvider>

              <MessageComposer
                value={message}
                busy={busyLabel === "Sending message"}
                disabled={!activeSessionId || Boolean(busyLabel)}
                onChange={setMessage}
                onSubmit={() => void sendMessage()}
              />
            </div>

            <aside className="hidden min-h-0 overflow-hidden bg-background xl:block xl:border-l">
              <div className="flex h-full min-h-0 flex-col">
                <div className="border-b p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">Actions</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tool gates and custom tool results.
                      </p>
                    </div>
                    <Badge
                      variant={
                        pendingOpenActions.length ? "default" : "outline"
                      }
                    >
                      {pendingOpenActions.length} pending
                    </Badge>
                  </div>
                </div>

                <ActionsPanel
                  busy={Boolean(busyLabel)}
                  events={events}
                  pendingActions={pendingOpenActions}
                  customToolResults={customToolResults}
                  denyMessages={denyMessages}
                  onCustomToolChange={(eventId, value) =>
                    setCustomToolResults((current) => ({
                      ...current,
                      [eventId]: value,
                    }))
                  }
                  onDenyChange={(eventId, value) =>
                    setDenyMessages((current) => ({
                      ...current,
                      [eventId]: value,
                    }))
                  }
                  onAllow={(action) => void confirmTool(action, "allow")}
                  onDeny={(action) => void confirmTool(action, "deny")}
                  onCustomToolResult={(action) =>
                    void submitCustomToolResult(action)
                  }
                />
              </div>
            </aside>
          </div>
        </section>
      </div>

      <Dialog open={resourceDialogOpen} onOpenChange={setResourceDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingResourceId ? <PencilIcon /> : <FilePlus2Icon />}
              {editingResourceId
                ? "Edit Markdown resource"
                : "Add Markdown resource"}
            </DialogTitle>
            <DialogDescription>
              The content is generated in memory, uploaded through the Files
              API, and mounted when the session is created.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="resource-filename">Filename</Label>
              <Input
                id="resource-filename"
                value={resourceDraft.filename}
                spellCheck={false}
                onChange={(event) => {
                  const previousFilename = normalizeMarkdownFilename(
                    resourceDraft.filename
                  )
                  const nextFilename = event.target.value
                  setResourceDraft((current) => ({
                    ...current,
                    filename: nextFilename,
                    mountPath:
                      current.mountPath === `/${previousFilename}`
                        ? `/${normalizeMarkdownFilename(nextFilename)}`
                        : current.mountPath,
                  }))
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="resource-mount-path">Mount path</Label>
              <Input
                id="resource-mount-path"
                value={resourceDraft.mountPath}
                spellCheck={false}
                onChange={(event) =>
                  setResourceDraft((current) => ({
                    ...current,
                    mountPath: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="resource-content">Markdown</Label>
              <Textarea
                id="resource-content"
                className="min-h-72 resize-y font-mono text-xs"
                value={resourceDraft.content}
                spellCheck={false}
                onChange={(event) =>
                  setResourceDraft((current) => ({
                    ...current,
                    content: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter showCloseButton>
            <Button
              disabled={!isMarkdownResourceDraftValid(resourceDraft)}
              onClick={saveMarkdownResource}
            >
              <CheckIcon />
              {editingResourceId ? "Save changes" : "Add resource"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={fileResourceDialogOpen}
        onOpenChange={setFileResourceDialogOpen}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingFileResourceId ? <PencilIcon /> : <FileKey2Icon />}
              {editingFileResourceId
                ? "Edit file resource"
                : "Add file resource"}
            </DialogTitle>
            <DialogDescription>
              Mount an existing Files API object when the session is created.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="file-resource-id">File ID</Label>
              <Input
                id="file-resource-id"
                value={fileResourceDraft.fileId}
                placeholder="file_..."
                spellCheck={false}
                onChange={(event) =>
                  setFileResourceDraft((current) => ({
                    ...current,
                    fileId: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="file-resource-mount-path">Mount path</Label>
              <Input
                id="file-resource-mount-path"
                value={fileResourceDraft.mountPath ?? ""}
                placeholder="/data/input.md (optional)"
                spellCheck={false}
                onChange={(event) =>
                  setFileResourceDraft((current) => ({
                    ...current,
                    mountPath: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter showCloseButton>
            <Button
              disabled={!isExistingFileResourceDraftValid(fileResourceDraft)}
              onClick={saveFileResource}
            >
              <CheckIcon />
              {editingFileResourceId ? "Save changes" : "Add resource"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function newMarkdownResourceDraft(): MarkdownSessionResource {
  return {
    filename: "context.md",
    mountPath: "/context.md",
    content: "# Session Context\n\n",
  }
}

function newExistingFileResourceDraft(): ExistingFileSessionResource {
  return {
    fileId: "",
    mountPath: "",
  }
}

function normalizeMarkdownFilename(filename: string) {
  const trimmed = filename.trim()
  if (!trimmed) {
    return ""
  }
  return /\.md$/i.test(trimmed) ? trimmed : `${trimmed}.md`
}

function isMarkdownResourceDraftValid(resource: MarkdownSessionResource) {
  const filename = normalizeMarkdownFilename(resource.filename)
  const mountPath = resource.mountPath?.trim() ?? ""

  return (
    filename.length > 3 &&
    filename.length <= 255 &&
    !/[<>:"|?*\/\\\x00-\x1f]/.test(filename.replace(/\.md$/i, "")) &&
    mountPath.startsWith("/") &&
    mountPath.length <= 1024 &&
    !mountPath.split("/").some((segment) => segment === "..") &&
    resource.content.length <= 10_000_000
  )
}

function isExistingFileResourceDraftValid(
  resource: ExistingFileSessionResource
) {
  const mountPath = resource.mountPath?.trim() ?? ""

  return (
    /^file_[A-Za-z0-9]+$/.test(resource.fileId.trim()) &&
    (mountPath.length === 0 ||
      (mountPath.startsWith("/") &&
        mountPath.length <= 1024 &&
        !mountPath.split("/").some((segment) => segment === "..")))
  )
}

function CatalogCount({
  count,
  fetching,
}: {
  count: number
  fetching: boolean
}) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
      {fetching ? <Loader2Icon className="size-3 animate-spin" /> : null}
      {count}
    </span>
  )
}

function VaultCatalogField({
  vaults,
  vaultIds,
  query,
  onVaultIdsChange,
}: VaultCatalogProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>Vaults</Label>
        <CatalogCount count={vaults.length} fetching={query.isFetching} />
      </div>
      <VaultCatalogBody
        vaults={vaults}
        vaultIds={vaultIds}
        query={query}
        onVaultIdsChange={onVaultIdsChange}
      />
      <p className="text-[10px] text-muted-foreground">
        {vaultIds.length > 0
          ? `${vaultIds.length} selected · attached via vault_ids`
          : "Optional · MCP credentials for this session"}
      </p>
    </div>
  )
}

function VaultCatalogBody({
  vaults,
  vaultIds,
  query,
  onVaultIdsChange,
}: VaultCatalogProps) {
  if (query.isError) {
    return <CatalogSelectionMeta id="" error={query.error} />
  }

  if (vaults.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-2 py-2 text-[11px] text-muted-foreground">
        {catalogPlaceholder(query, "No vaults available")}
      </p>
    )
  }

  return (
    <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border p-1">
      {vaults.map((vault) => {
        const selected = vaultIds.includes(vault.id)

        return (
          <button
            key={vault.id}
            type="button"
            className={cn(
              "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
              selected
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted/60"
            )}
            onClick={() =>
              onVaultIdsChange((current) => toggleId(current, vault.id))
            }
          >
            <span
              className={cn(
                "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-muted-foreground/40"
              )}
            >
              {selected ? <CheckIcon className="size-2.5" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">
                {vault.name || vault.id}
              </span>
              <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                {vault.id}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function CatalogSelectionMeta({ id, error }: { id: string; error: unknown }) {
  if (error) {
    return (
      <p className="line-clamp-2 text-[10px] leading-4 text-destructive">
        {errorMessage(error)}
      </p>
    )
  }

  return id ? (
    <p className="truncate font-mono text-[10px] text-muted-foreground">{id}</p>
  ) : null
}

function catalogPlaceholder(
  query: { isLoading: boolean; isError: boolean },
  emptyLabel: string
) {
  if (query.isLoading) {
    return "Loading..."
  }
  if (query.isError) {
    return "Failed to load"
  }
  return emptyLabel
}

function readStoredVaultIds(): Array<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.vaultIds)
    if (!raw) {
      return []
    }

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (value): value is string =>
        typeof value === "string" && VAULT_ID_PATTERN.test(value)
    )
  } catch {
    return []
  }
}

function toggleId(ids: Array<string>, id: string): Array<string> {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}

function ConfigBadge({
  icon,
  label,
  ready,
}: {
  icon: React.ReactNode
  label: string
  ready?: boolean
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
      <span className={ready ? "text-emerald-600" : "text-amber-600"}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="truncate font-medium">{label}</div>
        <div className="text-muted-foreground">
          {ready ? "configured" : "missing"}
        </div>
      </div>
    </div>
  )
}

function SessionStatusDot({ status }: { status: StoredSession["status"] }) {
  return (
    <span
      className={cn(
        "size-2.5 shrink-0 rounded-full",
        status === "running" && "bg-emerald-500",
        status === "idle" && "bg-sky-500",
        status === "rescheduling" && "bg-amber-500",
        status === "terminated" && "bg-red-500",
        status === "unknown" && "bg-muted-foreground/50"
      )}
    />
  )
}

function EmptyState() {
  return (
    <div className="flex min-h-[20rem] items-center justify-center rounded-md border border-dashed bg-background">
      <div className="max-w-sm px-6 text-center">
        <BotIcon className="mx-auto size-8 text-muted-foreground" />
        <h3 className="mt-3 text-sm font-semibold">Ready for a turn</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a message and this panel will fill with persisted session events.
        </p>
      </div>
    </div>
  )
}

function MessageComposer({
  value,
  busy,
  disabled,
  onChange,
  onSubmit,
}: {
  value: string
  busy: boolean
  disabled: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  const canSubmit = !disabled && value.trim().length > 0

  return (
    <div className="shrink-0 border-t bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto max-w-4xl">
        <div className="relative rounded-lg border bg-background shadow-sm transition-[border-color,box-shadow] focus-within:border-ring/50 focus-within:ring-3 focus-within:ring-ring/20">
          <Textarea
            aria-label="Message"
            value={value}
            disabled={disabled}
            placeholder="Message this session... (Enter to send, Shift+Enter for newline)"
            className="max-h-40 min-h-20 resize-none overflow-y-auto border-0 bg-transparent py-3 pr-14 pl-3 shadow-none focus-visible:border-transparent focus-visible:ring-0 disabled:bg-transparent"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                if (canSubmit) {
                  onSubmit()
                }
              }
            }}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                className="absolute right-2 bottom-2"
                disabled={!canSubmit}
                onClick={onSubmit}
              >
                {busy ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
                <span className="sr-only">Send message</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send message</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

function ActionsPanel({
  busy,
  events,
  pendingActions,
  customToolResults,
  denyMessages,
  onCustomToolChange,
  onDenyChange,
  onAllow,
  onDeny,
  onCustomToolResult,
}: {
  busy: boolean
  events: StoredSessionEvent[]
  pendingActions: PendingAction[]
  customToolResults: Record<string, string>
  denyMessages: Record<string, string>
  onCustomToolChange: (eventId: string, value: string) => void
  onDenyChange: (eventId: string, value: string) => void
  onAllow: (action: PendingAction) => void
  onDeny: (action: PendingAction) => void
  onCustomToolResult: (action: PendingAction) => void
}) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="space-y-3 p-4">
        {pendingActions.map((action) => (
          <PendingActionCard
            key={`${action.actionType}-${action.eventId}`}
            action={action}
            busy={busy}
            customToolValue={customToolResults[action.eventId] ?? ""}
            denyValue={denyMessages[action.eventId] ?? ""}
            onCustomToolChange={(value) =>
              onCustomToolChange(action.eventId, value)
            }
            onDenyChange={(value) => onDenyChange(action.eventId, value)}
            onAllow={() => onAllow(action)}
            onDeny={() => onDeny(action)}
            onCustomToolResult={() => onCustomToolResult(action)}
          />
        ))}

        {pendingActions.length === 0 && (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No pending tool gates.
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase">
            Recent events
          </div>
          {events
            .slice(-8)
            .reverse()
            .map((event) => (
              <div
                key={`recent-${event.eventId}`}
                className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-xs"
              >
                <span className="truncate font-medium">{event.type}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatTime(event.processedAt ?? event.createdAt)}
                </span>
              </div>
            ))}
        </div>
      </div>
    </ScrollArea>
  )
}

function EventRow({ event }: { event: StoredSessionEvent }) {
  const type = event.type
  const payload = event.payload

  if (type === "user.message") {
    return (
      <MessageBubble
        role="user"
        title="You"
        text={contentText(payload.content)}
        time={formatTime(event.processedAt ?? event.createdAt)}
      />
    )
  }

  if (type === "agent.message") {
    return (
      <MessageBubble
        role="agent"
        title="Agent"
        text={contentText(payload.content)}
        time={formatTime(event.processedAt ?? event.createdAt)}
      />
    )
  }

  if (
    type === "agent.tool_use" ||
    type === "agent.mcp_tool_use" ||
    type === "agent.custom_tool_use"
  ) {
    return (
      <ToolEventCard
        title={toolName(payload)}
        subtitle={type}
        input={recordValue(payload.input) ?? {}}
      />
    )
  }

  if (type === "session.error") {
    const error = recordValue(payload.error)
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>{stringValue(error?.type) ?? "session.error"}</AlertTitle>
        <AlertDescription>
          {stringValue(error?.message) ?? "The session reported an error."}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex items-start gap-3 rounded-md border bg-background p-3 text-sm">
      <TerminalIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{type}</span>
          <span className="text-xs text-muted-foreground">
            {formatTime(event.processedAt ?? event.createdAt)}
          </span>
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {shortId(event.eventId)}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({
  role,
  title,
  text,
  time,
  streaming = false,
}: {
  role: "user" | "agent"
  title: string
  text: string
  time?: string
  streaming?: boolean
}) {
  return (
    <div
      className={cn("flex", role === "user" ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[min(100%,52rem)] rounded-md border px-3 py-2 text-sm shadow-sm",
          role === "user"
            ? "border-primary/20 bg-primary text-primary-foreground"
            : "bg-background"
        )}
      >
        <div className="mb-1 flex items-center gap-2 text-xs opacity-75">
          <span>{title}</span>
          {time && <span>{time}</span>}
          {streaming && <Loader2Icon className="size-3 animate-spin" />}
        </div>
        <div className="leading-relaxed whitespace-pre-wrap">
          {text || "(empty)"}
        </div>
      </div>
    </div>
  )
}

function ToolEventCard({
  title,
  subtitle,
  input,
}: {
  title: string
  subtitle: string
  input: JsonRecord
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <TerminalIcon className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="max-h-56 overflow-auto rounded-md bg-muted p-2 text-xs">
          {JSON.stringify(input, null, 2)}
        </pre>
      </CardContent>
    </Card>
  )
}

function PendingActionCard({
  action,
  busy,
  customToolValue,
  denyValue,
  onCustomToolChange,
  onDenyChange,
  onAllow,
  onDeny,
  onCustomToolResult,
}: {
  action: PendingAction
  busy: boolean
  customToolValue: string
  denyValue: string
  onCustomToolChange: (value: string) => void
  onDenyChange: (value: string) => void
  onAllow: () => void
  onDeny: () => void
  onCustomToolResult: () => void
}) {
  const isCustom = action.actionType === "custom_tool_result"

  return (
    <Card className="border-amber-300/70 bg-amber-50/60 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {isCustom ? (
            <SquareIcon className="size-4 text-amber-600" />
          ) : (
            <ShieldCheckIcon className="size-4 text-amber-600" />
          )}
          {action.toolName}
        </CardTitle>
        <CardDescription>{action.eventId}</CardDescription>
        <CardAction>
          <Badge variant="outline">{action.actionType}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <pre className="max-h-40 overflow-auto rounded-md bg-background/80 p-2 text-xs">
          {JSON.stringify(action.toolInput, null, 2)}
        </pre>

        {isCustom ? (
          <>
            <Textarea
              value={customToolValue}
              className="min-h-24 resize-none bg-background"
              placeholder="Tool result"
              onChange={(event) => onCustomToolChange(event.target.value)}
            />
            <Button
              className="w-full"
              disabled={busy || !customToolValue.trim()}
              onClick={onCustomToolResult}
            >
              <CheckIcon />
              Send result
            </Button>
          </>
        ) : (
          <>
            <Textarea
              value={denyValue}
              className="min-h-16 resize-none bg-background"
              placeholder="Optional deny reason"
              onChange={(event) => onDenyChange(event.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={busy} onClick={onDeny}>
                <XIcon />
                Deny
              </Button>
              <Button disabled={busy} onClick={onAllow}>
                <CheckIcon />
                Allow
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function contentText(content: unknown) {
  if (!Array.isArray(content)) {
    return ""
  }

  return content
    .map((block) => {
      const record = recordValue(block)
      if (!record) {
        return ""
      }

      if (record.type === "text") {
        return stringValue(record.text) ?? ""
      }

      return JSON.stringify(record)
    })
    .filter(Boolean)
    .join("\n")
}

function toolName(payload: JsonRecord) {
  const type = stringValue(payload.type)
  const name = stringValue(payload.name) ?? "tool"
  const serverName = stringValue(payload.mcp_server_name)

  if (type === "agent.mcp_tool_use" && serverName) {
    return `${serverName}.${name}`
  }

  return name
}

function recordValue(value: unknown): JsonRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord
  }

  return null
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function shortId(value: string) {
  if (value.length <= 16) {
    return value
  }

  return `${value.slice(0, 8)}...${value.slice(-6)}`
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error"
}
