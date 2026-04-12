"use client"

import { use, useEffect, useState, useCallback, useRef } from "react"
import { ArrowLeft, MapPin, Loader2, Wifi, WifiOff, Store, Clock } from "lucide-react"
import Link from "next/link"
import { OrderTimeline } from "@/components/order-status"
import {
  createOrderTrackingClient,
  WebSocketClient,
  type OrderStatusPayload,
} from "@/lib/websocket-client"

interface OrderDetail {
  id: string
  status: string
  orderType: string
  deliveryAddress?: string
  deliveryLat?: number
  deliveryLng?: number
  driverLat?: number
  driverLng?: number
  total: number
  deliveryFee: number
  scheduledPickupTime?: string
  estimatedPrepMinutes?: number
  items: { productName: string; quantity: number; price: number; total: number }[]
  createdAt: string
}

const STATUS_ORDER_DELIVERY = ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"]
const STATUS_ORDER_PICKUP   = ["pending", "confirmed", "preparing", "ready", "delivered"]

const STATUS_LABELS_DELIVERY: Record<string, string> = {
  pending: "Commande reçue",
  confirmed: "Commande confirmée",
  preparing: "En préparation",
  ready: "Prête",
  out_for_delivery: "En cours de livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
}

const STATUS_LABELS_PICKUP: Record<string, string> = {
  pending: "Commande reçue",
  confirmed: "Commande confirmée",
  preparing: "En préparation",
  ready: "Prête à récupérer 🎉",
  delivered: "Récupérée",
  cancelled: "Annulée",
}

function buildTimeline(currentStatus: string, isPickup: boolean) {
  const order = isPickup ? STATUS_ORDER_PICKUP : STATUS_ORDER_DELIVERY
  const labels = isPickup ? STATUS_LABELS_PICKUP : STATUS_LABELS_DELIVERY
  const currentIdx = order.indexOf(currentStatus)
  return order.map((s, idx) => ({
    label: labels[s] || s,
    done: idx < currentIdx || currentStatus === "delivered",
    time: "",
  }))
}

function formatScheduledTime(iso: string): string {
  try {
    const d = new Date(iso)
    const h = d.getHours().toString().padStart(2, "0")
    const m = d.getMinutes().toString().padStart(2, "0")
    return `${h}h${m}`
  } catch {
    return iso
  }
}

function estimateEta(
  status: string,
  isPickup: boolean,
  scheduledTime?: string,
  prepMinutes?: number,
  createdAt?: string,
): string {
  // Scheduled order: always show the booked time
  if (scheduledTime) {
    if (status === "delivered") return isPickup ? "Récupérée ✓" : "Livrée !"
    if (status === "cancelled") return "--"
    return formatScheduledTime(scheduledTime)
  }

  // Admin has set a prep time → compute real ETA from createdAt + prepMinutes
  if (prepMinutes && prepMinutes > 0 && createdAt) {
    if (status === "delivered") return isPickup ? "Récupérée ✓" : "Livrée !"
    if (status === "cancelled") return "--"
    if (status === "ready" && isPickup) return "Prête !"
    if (status === "out_for_delivery") return "En chemin"
    // delivery buffer: ~15 min for delivery orders
    const deliveryBuffer = isPickup ? 0 : 15
    const eta = new Date(new Date(createdAt).getTime() + (prepMinutes + deliveryBuffer) * 60_000)
    const h = eta.getHours().toString().padStart(2, "0")
    const m = eta.getMinutes().toString().padStart(2, "0")
    return `${h}h${m}`
  }

  // Fallback: generic range estimates
  if (isPickup) {
    switch (status) {
      case "pending":   return "20-30 min"
      case "confirmed": return "15-25 min"
      case "preparing": return "10-15 min"
      case "ready":     return "Prête !"
      case "delivered": return "Récupérée ✓"
      default:          return "--"
    }
  }
  switch (status) {
    case "pending":           return "30-40 min"
    case "confirmed":         return "25-35 min"
    case "preparing":         return "15-25 min"
    case "ready":             return "10-15 min"
    case "out_for_delivery":  return "5-10 min"
    case "delivered":         return "Livrée !"
    default:                  return "--"
  }
}

export default function SuiviPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const wsClientRef = useRef<WebSocketClient | null>(null)

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${id}`)
      if (!res.ok) throw new Error("Erreur chargement")
      const data = await res.json()
      setOrder(data)
      setError(null)
    } catch {
      setError("Impossible de charger la commande")
    } finally {
      setLoading(false)
    }
  }, [id])

  // Chargement initial
  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  // Polling toutes les 8s — démarre immédiatement, indépendant du WebSocket
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchOrder()
    }, 8_000)
    return () => clearInterval(interval)
  }, [fetchOrder])

  // WebSocket pour les mises à jour temps réel (en complément du polling)
  useEffect(() => {
    if (!order) return
    if (order.status === "delivered" || order.status === "cancelled") return

    let wsClient: WebSocketClient | null = null
    let checkInterval: NodeJS.Timeout | null = null

    fetch("/api/auth/ws-token")
      .then((r) => r.ok ? r.json() : { token: undefined })
      .then(({ token }) => {
        wsClient = createOrderTrackingClient(id, token)
        wsClientRef.current = wsClient

        wsClient.on<OrderStatusPayload>("ORDER_STATUS", (payload) => {
          setOrder((prev) => prev ? { ...prev, status: payload.status } : prev)
          if (payload.status === "delivered" || payload.status === "cancelled") {
            setConnected(false)
            wsClient?.disconnect()
          }
        })

        wsClient.connect()
        setConnected(true)

        checkInterval = setInterval(() => {
          setConnected(wsClient?.isConnected ?? false)
        }, 1000)
      })
      .catch(() => { /* polling prend le relais */ })

    return () => {
      wsClient?.disconnect()
      wsClientRef.current = null
      if (checkInterval) clearInterval(checkInterval)
    }
  }, [id, order?.status])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">{error || "Commande introuvable"}</p>
        <button onClick={fetchOrder} className="text-sm font-medium underline">Réessayer</button>
      </div>
    )
  }

  const isTerminal = order.status === "delivered" || order.status === "cancelled"
  const isPickup = order.orderType === "pickup"
  const isScheduled = !!order.scheduledPickupTime
  const hasPrepTime = !isScheduled && !!order.estimatedPrepMinutes && order.estimatedPrepMinutes > 0
  const timeline = buildTimeline(order.status, isPickup)
  const eta = estimateEta(order.status, isPickup, order.scheduledPickupTime, order.estimatedPrepMinutes, order.createdAt)

  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/account/orders"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Suivi commande</h1>
          <p className="text-xs text-muted-foreground">#{id.slice(0, 8)}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {!isTerminal && connected ? (
            <>
              <Wifi size={12} className="text-green-500" />
              <span>En direct</span>
            </>
          ) : isTerminal ? (
            <>
              <WifiOff size={12} />
              <span>Terminée</span>
            </>
          ) : null}
        </div>
      </div>

      {/* ETA / Status card */}
      <div className={`rounded-2xl border p-5 mb-8 text-center ${isPickup ? "bg-muted/30" : ""}`}>
        {isPickup ? (
          <>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Store size={16} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Click &amp; Collect</p>
            </div>
            <p className="text-3xl font-bold mt-1">{eta}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {STATUS_LABELS_PICKUP[order.status] || order.status}
            </p>
            {order.status === "ready" && (
              <p className="mt-3 text-sm font-medium text-green-600 dark:text-green-400">
                🎉 Votre commande vous attend au restaurant !
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock size={16} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isScheduled && order.status !== "delivered" && order.status !== "out_for_delivery"
                  ? "Livraison planifiée pour"
                  : hasPrepTime && order.status !== "delivered" && order.status !== "out_for_delivery" && order.status !== "ready"
                    ? "Livraison estimée pour"
                    : "Livraison estimée"}
              </p>
            </div>
            <p className="text-3xl font-bold mt-1">{eta}</p>
            <p className="text-xs text-muted-foreground mt-2">{STATUS_LABELS_DELIVERY[order.status] || order.status}</p>
          </>
        )}
      </div>

      {/* Timeline */}
      <OrderTimeline statuses={timeline} />

      {/* Order Details */}
      <div className="mt-8 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Détails
        </h2>

        {!isPickup && order.deliveryAddress && (
          <div className="flex items-start gap-3 rounded-2xl border p-4">
            <MapPin size={16} className="mt-0.5 text-muted-foreground flex-shrink-0" />
            <p className="text-sm">{order.deliveryAddress}</p>
          </div>
        )}
        {isPickup && (
          <div className="flex items-start gap-3 rounded-2xl border p-4">
            <Store size={16} className="mt-0.5 text-muted-foreground flex-shrink-0" />
            <p className="text-sm">Récupérez votre commande directement au restaurant</p>
          </div>
        )}

        <div className="rounded-2xl border p-4 space-y-2">
          {order.items?.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{item.quantity}x {item.productName}</span>
              <span className="font-medium">{item.total.toFixed(2)} €</span>
            </div>
          ))}
          {order.deliveryFee > 0 && (
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Livraison</span>
              <span>{order.deliveryFee.toFixed(2)} €</span>
            </div>
          )}
          <div className="flex justify-between font-bold pt-2 border-t">
            <span>Total</span>
            <span>{order.total.toFixed(2)} €</span>
          </div>
        </div>
      </div>

      <Link
        href="/restaurants"
        className="mt-8 flex w-full items-center justify-center rounded-full border py-3.5 text-sm font-semibold transition-colors hover:bg-muted"
      >
        Retour aux restaurants
      </Link>
    </div>
  )
}
