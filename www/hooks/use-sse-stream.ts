"use client"

import { useEffect, useRef, useCallback } from "react"

type SSEEvent = {
  type: string
  orderId?: string
  restaurantName?: string
  status?: string
}

type UseSSEStreamOptions = {
  /** Called when an order_event arrives */
  onOrderEvent: (event: SSEEvent) => void
  /** Only subscribe when true (e.g. page is mounted) */
  enabled?: boolean
}

/**
 * Connects to /api/events/stream (SSE) and calls onOrderEvent for each order_event.
 * Auto-reconnects on disconnect. Pauses when the tab is hidden.
 */
export function useSSEStream({ onOrderEvent, enabled = true }: UseSSEStreamOptions) {
  const esRef = useRef<EventSource | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onOrderEventRef = useRef(onOrderEvent)
  onOrderEventRef.current = onOrderEvent

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }

    if (!enabled || document.visibilityState === "hidden") return

    const es = new EventSource("/api/events/stream")
    esRef.current = es

    es.addEventListener("order_event", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as SSEEvent
        onOrderEventRef.current(data)
      } catch {
        // Ignore parse errors
      }
    })

    es.addEventListener("error", () => {
      es.close()
      esRef.current = null
      // Reconnect after 3s
      reconnectTimer.current = setTimeout(connect, 3_000)
    })
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    connect()

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        connect()
      } else {
        esRef.current?.close()
        esRef.current = null
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      esRef.current?.close()
      esRef.current = null
    }
  }, [enabled, connect])
}
