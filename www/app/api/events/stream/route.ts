import { cookies } from "next/headers"
import { NextRequest } from "next/server"
import Redis from "ioredis"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"
const ADMIN_EVENTS_CHAN = "esnack:admin:events"

// ─── Singleton pub/sub manager ───────────────────────────────────────────────
// One shared Redis subscriber for the entire Node.js process.
// All SSE clients attach/detach their controllers without opening extra connections.

type SSEController = ReadableStreamDefaultController<Uint8Array>

interface ClientInfo {
  controller: SSEController
  role: string
}

const clients = new Map<string, ClientInfo>()
let redisSubscriber: Redis | null = null

function ensureSubscriber() {
  if (redisSubscriber) return

  redisSubscriber = new Redis(REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 3 })
  redisSubscriber.subscribe(ADMIN_EVENTS_CHAN)

  redisSubscriber.on("message", (_channel: string, message: string) => {
    try {
      const data = JSON.parse(message) as { type: string; orderId: string; restaurantName: string; status: string }
      const encoder = new TextEncoder()
      const payload = encoder.encode(`event: order_event\ndata: ${JSON.stringify(data)}\n\n`)

      for (const [, client] of clients) {
        const { controller, role } = client
        if (role === "admin") {
          try { controller.enqueue(payload) } catch { /* client gone */ }
        } else if (role === "livreur" && data.type === "ORDER_STATUS") {
          try { controller.enqueue(payload) } catch { /* client gone */ }
        }
      }
    } catch { /* ignore parse errors */ }
  })

  redisSubscriber.on("error", (err) => {
    console.error("[SSE] Redis subscriber error:", err)
  })
}

// ─────────────────────────────────────────────────────────────────────────────

async function getAuthUser(req: NextRequest): Promise<{ id: string; role: string } | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("access_token")?.value
    if (!token) return null

    const backendUrl = process.env.BACKEND_URL || "http://localhost:8080"
    const res = await fetch(`${backendUrl}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return { id: data.id, role: data.role }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || (user.role !== "admin" && user.role !== "livreur")) {
    return new Response("Unauthorized", { status: 401 })
  }

  ensureSubscriber()

  const clientId = `${user.id}-${Date.now()}`
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Register with the singleton broadcaster
      clients.set(clientId, { controller, role: user.role })

      // Initial connected event
      try {
        controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ userId: user.id, role: user.role })}\n\n`))
      } catch { /* ignore */ }

      // Keep-alive heartbeat every 25s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"))
        } catch {
          clearInterval(heartbeat)
        }
      }, 25_000)

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat)
        clients.delete(clientId)
        try { controller.close() } catch { /* already closed */ }
      })
    },

    cancel() {
      clients.delete(clientId)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
