import { MessageScroller as MessageScrollerPrimitive } from "@shadcn/react/message-scroller"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

function MessageScrollerProvider({
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>) {
  return <MessageScrollerPrimitive.Provider {...props} />
}

function MessageScroller({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
  return (
    <MessageScrollerPrimitive.Root
      data-slot="message-scroller"
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function MessageScrollerViewport({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
  return (
    <MessageScrollerPrimitive.Viewport
      data-slot="message-scroller-viewport"
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none",
        className
      )}
      {...props}
    />
  )
}

function MessageScrollerContent({
  className,
  spacerClassName,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  return (
    <MessageScrollerPrimitive.Content
      data-slot="message-scroller-content"
      className={cn(
        "mx-auto flex w-full max-w-4xl flex-col gap-3 p-4",
        className
      )}
      spacerClassName={cn("shrink-0", spacerClassName)}
      {...props}
    />
  )
}

function MessageScrollerItem({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  return (
    <MessageScrollerPrimitive.Item
      data-slot="message-scroller-item"
      className={cn("min-w-0 scroll-mt-4", className)}
      {...props}
    />
  )
}

function MessageScrollerButton({
  className,
  direction = "end",
  children,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Button>) {
  const Icon = direction === "start" ? ArrowUpIcon : ArrowDownIcon

  return (
    <MessageScrollerPrimitive.Button
      aria-label={direction === "start" ? "Scroll to start" : "Scroll to end"}
      direction={direction}
      className={cn(
        "absolute bottom-3 left-1/2 z-10 inline-flex size-8 -translate-x-1/2 items-center justify-center rounded-full border bg-background/95 text-muted-foreground shadow-sm backdrop-blur transition hover:bg-muted hover:text-foreground data-[active=false]:pointer-events-none data-[active=false]:translate-y-1 data-[active=false]:opacity-0",
        className
      )}
      {...props}
    >
      {children ?? <Icon className="size-4" />}
    </MessageScrollerPrimitive.Button>
  )
}

export {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
}
