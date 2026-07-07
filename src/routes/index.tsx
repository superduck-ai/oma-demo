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
  KeyRoundIcon,
  Loader2Icon,
  MessageSquareIcon,
  PlugZapIcon,
  RefreshCcwIcon,
  SendIcon,
  ShieldCheckIcon,
  SquareIcon,
  TerminalIcon,
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
import { DEFAULT_AGENT_ID, DEFAULT_ENVIRONMENT_ID } from "@/lib/managed-agents"
import type {
  JsonRecord,
  PendingAction,
  SessionDetailResponse,
  StoredSession,
  StoredSessionEvent,
} from "@/lib/managed-agents"
import {
  createManagedSession,
  getAppConfig,
  getSessionDetail,
  listLocalSessions,
  sendCustomToolResult,
  sendSessionMessage,
  sendToolConfirmation,
  syncManagedSession,
} from "@/lib/managed-agents-functions"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/")({ component: App })

type TurnState = "idle" | "running" | "ended" | "error"

const STORAGE_KEYS = {
  agentId: "oma-demo.agent-id",
  environmentId: "oma-demo.environment-id",
  activeSessionId: "oma-demo.active-session-id",
}

function App() {
  const queryClient = useQueryClient()
  const getConfigFn = useServerFn(getAppConfig)
  const listSessionsFn = useServerFn(listLocalSessions)
  const getDetailFn = useServerFn(getSessionDetail)
  const createSessionFn = useServerFn(createManagedSession)
  const syncSessionFn = useServerFn(syncManagedSession)
  const sendMessageFn = useServerFn(sendSessionMessage)
  const confirmToolFn = useServerFn(sendToolConfirmation)
  const customToolResultFn = useServerFn(sendCustomToolResult)
  const [agentId, setAgentId] = React.useState(DEFAULT_AGENT_ID)
  const [environmentId, setEnvironmentId] = React.useState(
    DEFAULT_ENVIRONMENT_ID
  )
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(
    null
  )
  const [title, setTitle] = React.useState("")
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
    setAgentId(localStorage.getItem(STORAGE_KEYS.agentId) || DEFAULT_AGENT_ID)
    setEnvironmentId(
      localStorage.getItem(STORAGE_KEYS.environmentId) || DEFAULT_ENVIRONMENT_ID
    )
    setActiveSessionId(localStorage.getItem(STORAGE_KEYS.activeSessionId))
  }, [])

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.agentId, agentId)
  }, [agentId])

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.environmentId, environmentId)
  }, [environmentId])

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
        },
      })

      if (!response.session) {
        throw new Error("Session was created remotely but not stored locally.")
      }

      setActiveSessionId(response.session.id)
      setTitle("")
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

  const configReady =
    configQuery.data?.apiKeyConfigured === true &&
    configQuery.data.omaServerUrlConfigured === true
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
                      onClick={() => void configQuery.refetch()}
                    >
                      <RefreshCcwIcon />
                      <span className="sr-only">Refresh config</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh config</TooltipContent>
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
                <Label htmlFor="agent-id">Agent ID</Label>
                <Input
                  id="agent-id"
                  value={agentId}
                  spellCheck={false}
                  onChange={(event) => setAgentId(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="environment-id">Environment ID</Label>
                <Input
                  id="environment-id"
                  value={environmentId}
                  spellCheck={false}
                  onChange={(event) => setEnvironmentId(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="session-title">Title</Label>
                <Input
                  id="session-title"
                  value={title}
                  placeholder="Optional"
                  onChange={(event) => setTitle(event.target.value)}
                />
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
    </main>
  )
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
            placeholder="Message this session..."
            className="max-h-40 min-h-20 resize-none overflow-y-auto border-0 bg-transparent py-3 pr-14 pl-3 shadow-none focus-visible:border-transparent focus-visible:ring-0 disabled:bg-transparent"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                onSubmit()
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
