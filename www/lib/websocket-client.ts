/**
 * WebSocket client for real-time delivery tracking
 */

export type WSMessageType =
  | "DRIVER_LOCATION"
  | "ORDER_STATUS"
  | "NEW_ASSIGNMENT"
  | "ASSIGNMENT_UPDATE"
  | "PING"
  | "PONG"

export interface WSMessage<T = unknown> {
  type: WSMessageType
  payload: T
}

export interface DriverLocationPayload {
  lat: number
  lng: number
  heading?: number
  speed?: number
  updatedAt: string
}

export interface OrderStatusPayload {
  status: string
  updatedAt: string
}

export interface NewAssignmentPayload {
  assignmentId: string
  orderId: string
}

type MessageHandler<T = unknown> = (payload: T) => void
type ConnectionHandler = () => void

interface WebSocketClientOptions {
  url: string
  token?: string
  reconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  onOpen?: ConnectionHandler
  onClose?: ConnectionHandler
  onError?: (error: Event) => void
}

export class WebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private token?: string
  private reconnect: boolean
  private reconnectInterval: number
  private maxReconnectAttempts: number
  private reconnectAttempts = 0
  private reconnectTimeout: NodeJS.Timeout | null = null
  private pingInterval: NodeJS.Timeout | null = null
  private handlers: Map<WSMessageType, Set<MessageHandler>> = new Map()
  private onOpen?: ConnectionHandler
  private onClose?: ConnectionHandler
  private onError?: (error: Event) => void

  constructor(options: WebSocketClientOptions) {
    this.url = options.url
    this.token = options.token
    this.reconnect = options.reconnect ?? true
    this.reconnectInterval = options.reconnectInterval ?? 3000
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10
    this.onOpen = options.onOpen
    this.onClose = options.onClose
    this.onError = options.onError
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    // Build URL with token if provided
    let wsUrl = this.url
    if (this.token) {
      const separator = wsUrl.includes("?") ? "&" : "?"
      wsUrl = `${wsUrl}${separator}token=${encodeURIComponent(this.token)}`
    }

    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      console.log("[WS] Connected to", this.url)
      this.reconnectAttempts = 0
      this.startPing()
      this.onOpen?.()
    }

    this.ws.onclose = () => {
      console.log("[WS] Disconnected from", this.url)
      this.stopPing()
      this.onClose?.()
      this.attemptReconnect()
    }

    this.ws.onerror = (error) => {
      console.error("[WS] Error:", error)
      this.onError?.(error)
    }

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WSMessage
        this.handleMessage(message)
      } catch (e) {
        console.error("[WS] Failed to parse message:", e)
      }
    }
  }

  disconnect(): void {
    this.reconnect = false
    this.stopPing()
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  send<T>(type: WSMessageType, payload: T): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn("[WS] Cannot send message, not connected")
      return
    }

    const message: WSMessage<T> = { type, payload }
    this.ws.send(JSON.stringify(message))
  }

  on<T>(type: WSMessageType, handler: MessageHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler as MessageHandler)

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler as MessageHandler)
    }
  }

  off<T>(type: WSMessageType, handler: MessageHandler<T>): void {
    this.handlers.get(type)?.delete(handler as MessageHandler)
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private handleMessage(message: WSMessage): void {
    // Handle pong internally
    if (message.type === "PONG") {
      return
    }

    const handlers = this.handlers.get(message.type)
    if (handlers) {
      handlers.forEach((handler) => handler(message.payload))
    }
  }

  private attemptReconnect(): void {
    if (!this.reconnect) return
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[WS] Max reconnect attempts reached")
      return
    }

    this.reconnectAttempts++
    console.log(`[WS] Reconnecting in ${this.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    this.reconnectTimeout = setTimeout(() => {
      this.connect()
    }, this.reconnectInterval)
  }

  private startPing(): void {
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      this.send("PING", {})
    }, 30000)
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }
}

/**
 * Create a WebSocket client for order tracking
 */
export function createOrderTrackingClient(
  orderID: string,
  token?: string
): WebSocketClient {
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:"
  const host = typeof window !== "undefined" ? window.location.host : "localhost:8080"
  // In development, API is on a different port
  const apiHost = process.env.NEXT_PUBLIC_API_WS_URL || `${protocol}//${host}`

  return new WebSocketClient({
    url: `${apiHost}/ws/tracking/${orderID}`,
    token,
    reconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10,
  })
}

/**
 * Create a WebSocket client for driver operations
 */
export function createDriverClient(token: string): WebSocketClient {
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:"
  const host = typeof window !== "undefined" ? window.location.host : "localhost:8080"
  const apiHost = process.env.NEXT_PUBLIC_API_WS_URL || `${protocol}//${host}`

  return new WebSocketClient({
    url: `${apiHost}/ws/driver`,
    token,
    reconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10,
  })
}
