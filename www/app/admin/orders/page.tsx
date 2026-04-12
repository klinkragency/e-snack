"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import {
  Loader2, ChevronDown, ChevronUp, Clock, CheckCircle2, Truck, Package, XCircle,
  UserPlus, UserMinus, User, Phone, Mail, MapPin, MessageSquare, CreditCard, Bell, Timer,
  ShoppingBag, CalendarClock, Store, Receipt, Volume2,
} from "lucide-react"
import { toast } from "sonner"
import { listAdminRestaurants, listRestaurantOrders, updateOrderStatus, updateOrderPrepTime, unassignDriverFromOrder, cancelOrder, markOrderPaid, type AdminOrder } from "@/lib/admin-client"
import type { Restaurant } from "@/lib/restaurant-types"
import { AssignDriverModal } from "@/components/admin/assign-driver-modal"
import { TicketModal } from "@/components/admin/ticket-modal"
import { cn } from "@/lib/utils"
import { useSSEStream } from "@/hooks/use-sse-stream"

const ORDER_STATUSES = [
  { value: "", label: "Tous" },
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmée" },
  { value: "preparing", label: "En préparation" },
  { value: "ready", label: "Prête" },
  { value: "out_for_delivery", label: "En livraison" },
  { value: "delivered", label: "Livrée" },
  { value: "cancelled", label: "Annulée" },
]

const ORDER_TYPES = [
  { value: "", label: "Tous" },
  { value: "delivery", label: "Livraison" },
  { value: "pickup", label: "Click & Collect" },
  { value: "dine_in", label: "Sur place" },
  { value: "scheduled", label: "Planifiées" },
]

const STATUS_FLOW_DELIVERY = ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"]
const STATUS_FLOW_PICKUP   = ["pending", "confirmed", "preparing", "ready", "delivered"]

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  preparing: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  ready: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  out_for_delivery: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  refunded: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
}

const STATUS_ICON: Record<string, typeof Clock> = {
  pending: Clock,
  confirmed: CheckCircle2,
  preparing: Package,
  ready: CheckCircle2,
  out_for_delivery: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
}

const PAYMENT_LABELS: Record<string, { label: string; style: string }> = {
  pending: { label: "En attente", style: "text-yellow-600" },
  paid: { label: "Payé", style: "text-green-600" },
  on_site: { label: "Sur place", style: "text-blue-600" },
  failed: { label: "Echoué", style: "text-red-600" },
  refunded: { label: "Remboursé", style: "text-gray-600" },
}

function statusLabel(status: string, orderType?: string): string {
  if (orderType === "pickup") {
    const pickupLabels: Record<string, string> = {
      pending: "En attente",
      confirmed: "Confirmée",
      preparing: "En préparation",
      ready: "Prête à récupérer",
      delivered: "Récupérée",
      cancelled: "Annulée",
    }
    if (pickupLabels[status]) return pickupLabels[status]
  }
  return ORDER_STATUSES.find((s) => s.value === status)?.label || status
}

function formatScheduledTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function OrderCard({
  order,
  onNextStatus,
  onAssign,
  onUnassign,
  onCancel,
  onPrepTimeUpdate,
  onMarkPaid,
  onTicketClient,
  onTicketRestaurant,
}: {
  order: AdminOrder
  onNextStatus: () => void
  onAssign: () => void
  onUnassign: () => void
  onCancel: () => void
  onPrepTimeUpdate: (updated: AdminOrder) => void
  onMarkPaid: () => void
  onTicketClient: () => void
  onTicketRestaurant: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [prepMinutes, setPrepMinutes] = useState<number>(order.estimatedPrepMinutes ?? 0)
  const [savingPrep, setSavingPrep] = useState(false)
  const [markingPaid, setMarkingPaid] = useState(false)

  const isOnSitePickup = order.orderType === "pickup" && order.paymentStatus === "on_site"

  const handleMarkPaid = async () => {
    if (!confirm("Confirmer le paiement en boutique pour cette commande ?")) return
    setMarkingPaid(true)
    try {
      await markOrderPaid(order.id)
      toast.success("Commande marquée comme payée")
      onMarkPaid()
    } catch {
      toast.error("Erreur lors de la mise à jour du paiement")
    } finally {
      setMarkingPaid(false)
    }
  }

  const isPickup = order.orderType === "pickup"
  const statusFlow = isPickup ? STATUS_FLOW_PICKUP : STATUS_FLOW_DELIVERY
  const Icon = STATUS_ICON[order.status] || Clock
  const canAdvance = statusFlow.indexOf(order.status) >= 0 && statusFlow.indexOf(order.status) < statusFlow.length - 1
  const nextStatus = canAdvance ? statusFlow[statusFlow.indexOf(order.status) + 1] : null
  const payment = PAYMENT_LABELS[order.paymentStatus] || { label: order.paymentStatus || "—", style: "text-muted-foreground" }

  const isUnpaid = order.paymentStatus !== "paid" && order.paymentStatus !== "on_site" && order.status !== "cancelled"

  const handleSetPrepTime = async (mins: number) => {
    setSavingPrep(true)
    try {
      const updated = await updateOrderPrepTime(order.id, mins)
      setPrepMinutes(mins)
      onPrepTimeUpdate(updated)
      toast.success(`Temps de préparation : ${mins} min`)
    } catch {
      toast.error("Erreur lors de la mise à jour")
    } finally {
      setSavingPrep(false)
    }
  }

  return (
    <div className={cn("rounded-2xl border transition-shadow hover:shadow-sm", isUnpaid && "opacity-60 border-dashed")}>
      {/* Header — always visible, clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start justify-between p-4 text-left sm:p-5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">#{order.id.slice(0, 8)}</p>
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              STATUS_STYLE[order.status]
            )}>
              <Icon size={11} />
              {statusLabel(order.status, order.orderType)}
            </span>
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
              isPickup ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "bg-muted text-muted-foreground"
            )}>
              {isPickup ? <><Store size={10} /> Click &amp; Collect</> : order.orderType === "dine_in" ? "Sur place" : "Livraison"}
            </span>
            {order.scheduledPickupTime && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                <CalendarClock size={10} />
                {formatScheduledTime(order.scheduledPickupTime)}
              </span>
            )}
            {isUnpaid && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <CreditCard size={10} />
                Non payé
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {order.customerName && <span>{order.customerName}</span>}
            {order.customerEmail && <span>{order.customerEmail}</span>}
            <span>{new Date(order.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pl-3">
          <p className="text-lg font-bold">{order.total.toFixed(2)} €</p>
          {/* Ticket buttons — stop propagation so they don't toggle expand */}
          <button
            onClick={(e) => { e.stopPropagation(); onTicketClient() }}
            title="Ticket client"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Receipt size={14} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Client */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client</p>
              <div className="space-y-1 text-sm">
                {order.customerName && (
                  <div className="flex items-center gap-2">
                    <User size={13} className="text-muted-foreground" />
                    <span>{order.customerName}</span>
                  </div>
                )}
                {order.customerEmail && (
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="text-muted-foreground" />
                    <span className="truncate">{order.customerEmail}</span>
                  </div>
                )}
                {order.customerPhone && (
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-muted-foreground" />
                    <a href={`tel:${order.customerPhone}`} className="underline">{order.customerPhone}</a>
                  </div>
                )}
                {!order.customerName && !order.customerEmail && (
                  <p className="text-xs text-muted-foreground italic">ID: {order.userId.slice(0, 8)}</p>
                )}
              </div>
            </div>

            {/* Livreur */}
            {order.orderType === "delivery" && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Livreur</p>
                {order.driverId ? (
                  <div className="space-y-1 text-sm">
                    {order.driverName && (
                      <div className="flex items-center gap-2">
                        <Truck size={13} className="text-muted-foreground" />
                        <span>{order.driverName}</span>
                      </div>
                    )}
                    {order.driverPhone && (
                      <div className="flex items-center gap-2">
                        <Phone size={13} className="text-muted-foreground" />
                        <a href={`tel:${order.driverPhone}`} className="underline">{order.driverPhone}</a>
                      </div>
                    )}
                    {!order.driverName && (
                      <p className="text-xs text-muted-foreground italic">ID: {order.driverId.slice(0, 8)}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Aucun livreur assigné</p>
                )}
              </div>
            )}

            {/* Delivery address */}
            {order.deliveryAddress && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Adresse</p>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
                  <span>{order.deliveryAddress}</span>
                </div>
                {order.deliveryInstructions && (
                  <div className="flex items-start gap-2 text-sm">
                    <MessageSquare size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
                    <span className="italic text-muted-foreground">{order.deliveryInstructions}</span>
                  </div>
                )}
              </div>
            )}

            {/* Customer Notes */}
            {order.customerNotes && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Note du client</p>
                <div className="flex items-start gap-2 text-sm">
                  <MessageSquare size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="italic">{order.customerNotes}</span>
                </div>
              </div>
            )}

            {/* Payment */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Paiement</p>
              <div className="flex items-center gap-2 text-sm">
                <CreditCard size={13} className="text-muted-foreground" />
                <span className={cn("font-medium", payment.style)}>{payment.label}</span>
              </div>
              <div className="space-y-0.5 text-xs text-muted-foreground">
                <p>Sous-total: {order.subtotal.toFixed(2)} €</p>
                {order.deliveryFee > 0 && <p>Livraison: {order.deliveryFee.toFixed(2)} €</p>}
                {order.discount > 0 && <p className="text-green-600">Réduction: -{order.discount.toFixed(2)} €</p>}
                <p className="font-semibold text-foreground">Total: {order.total.toFixed(2)} €</p>
              </div>
            </div>
          </div>

          {/* Items */}
          {order.items && order.items.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Articles commandés</p>
              <div className="mt-1.5 divide-y rounded-xl border">
                {order.items.map((item, i) => (
                  <div key={i} className="px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        <span className="font-medium">{item.quantity}x</span> {item.productName}
                      </span>
                      <span className="text-sm font-medium">{item.total.toFixed(2)} €</span>
                    </div>
                    {item.options && item.options.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1.5">
                        {item.options.map((opt, j) => (
                          <span key={j} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {opt.optionName}: {opt.choiceName}
                            {opt.priceModifier > 0 && ` (+${opt.priceModifier.toFixed(2)} €)`}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.notes && (
                      <p className="mt-0.5 text-[11px] italic text-muted-foreground">Note: {item.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 space-y-3">
            {/* Prep time — visible when order is active (not delivered/cancelled) */}
            {order.status !== "delivered" && order.status !== "cancelled" && (
              <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-3 dark:border-orange-900/30 dark:bg-orange-900/10">
                <div className="mb-2 flex items-center gap-1.5">
                  <Timer size={13} className="text-orange-600 dark:text-orange-400" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-400">
                    Temps de préparation
                    {prepMinutes > 0 && <span className="ml-1 normal-case font-normal">— {prepMinutes} min estimé</span>}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 15, 20, 30, 45].map((m) => (
                    <button
                      key={m}
                      disabled={savingPrep}
                      onClick={() => handleSetPrepTime(m)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        prepMinutes === m
                          ? "bg-orange-500 text-white"
                          : "border border-orange-200 bg-white text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:bg-transparent dark:text-orange-400 dark:hover:bg-orange-900/30"
                      )}
                    >
                      {m} min
                    </button>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={300}
                      placeholder="autre"
                      disabled={savingPrep}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const v = parseInt((e.target as HTMLInputElement).value)
                          if (v > 0) handleSetPrepTime(v)
                        }
                      }}
                      className="w-16 rounded-full border border-orange-200 bg-white px-2 py-1 text-xs text-center outline-none focus:ring-2 focus:ring-orange-300 dark:border-orange-800 dark:bg-transparent dark:text-orange-400"
                    />
                    <span className="text-[10px] text-muted-foreground">min ↵</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {canAdvance && nextStatus && (
                <button
                  onClick={onNextStatus}
                  className="rounded-full bg-foreground px-5 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  &rarr; {statusLabel(nextStatus, order.orderType)}
                </button>
              )}
              {order.orderType === "delivery" && !order.driverId && order.status !== "delivered" && order.status !== "cancelled" && (
                <button
                  onClick={onAssign}
                  className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
                >
                  <UserPlus size={12} />
                  Assigner livreur
                </button>
              )}
              {order.driverId && order.status !== "delivered" && order.status !== "cancelled" && (
                <button
                  onClick={onUnassign}
                  className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                >
                  <UserMinus size={12} />
                  Désassigner
                </button>
              )}
              {(order.status === "pending" || order.status === "confirmed") && (
                <button
                  onClick={onCancel}
                  className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                >
                  <XCircle size={12} />
                  Annuler
                </button>
              )}
              {isOnSitePickup && order.status !== "cancelled" && (
                <button
                  onClick={handleMarkPaid}
                  disabled={markingPaid}
                  className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100 disabled:opacity-60 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
                >
                  <CheckCircle2 size={12} />
                  {markingPaid ? "…" : "Payé en boutique"}
                </button>
              )}
              {/* Ticket buttons */}
              <button
                onClick={onTicketClient}
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >
                <Receipt size={12} />
                Ticket client
              </button>
              <button
                onClick={onTicketRestaurant}
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >
                <Receipt size={12} />
                Bon cuisine
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminOrdersPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [assigningOrder, setAssigningOrder] = useState<AdminOrder | null>(null)
  const [newOrdersCount, setNewOrdersCount] = useState(0)
  const [ticketOrder, setTicketOrder] = useState<AdminOrder | null>(null)
  const [ticketType, setTicketType] = useState<"client" | "restaurant">("client")

  // Audio unlock: browsers block autoplay until user interacts with the page.
  // We create and resume an AudioContext on first click, then play sounds via it.
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioUnlocked = useRef(false)

  // Create AudioContext immediately (suspended) and resume on first interaction.
  // This ensures it's ready before any SSE event arrives.
  useEffect(() => {
    try {
      audioCtxRef.current = new AudioContext()
    } catch {}

    const unlock = () => {
      if (audioUnlocked.current) return
      audioUnlocked.current = true
      audioCtxRef.current?.resume().catch(() => {})
    }
    document.addEventListener("click", unlock, { once: true })
    document.addEventListener("keydown", unlock, { once: true })
    return () => {
      document.removeEventListener("click", unlock)
      document.removeEventListener("keydown", unlock)
    }
  }, [])

  const fetchOrders = useCallback(() => {
    if (!selectedRestaurant) return
    setLoadingOrders(true)
    listRestaurantOrders(selectedRestaurant, statusFilter || undefined, typeFilter || undefined)
      .then(setOrders)
      .catch(() => toast.error("Erreur chargement commandes"))
      .finally(() => setLoadingOrders(false))
  }, [selectedRestaurant, statusFilter, typeFilter])

  // All filtering is now server-side via BFF; orders is the source of truth
  const filteredOrders = orders

  // Play notification sound — uses AudioContext to bypass autoplay policy
  const playNotificationSound = useCallback(async () => {
    const restaurant = restaurants.find((r) => r.id === selectedRestaurant)
    const soundUrl = restaurant?.notificationSoundUrl
    if (!soundUrl) return

    try {
      // Ensure context is resumed (required after browser suspend)
      const ctx = audioCtxRef.current
      if (!ctx) return
      if (ctx.state === "suspended") await ctx.resume()

      // Proxy via BFF to avoid CORS issues with R2/MinIO origins
      const proxyUrl = `/api/audio-proxy?url=${encodeURIComponent(soundUrl)}`
      const res = await fetch(proxyUrl)
      if (!res.ok) throw new Error(`fetch ${res.status}`)
      const buf = await res.arrayBuffer()
      const decoded = await ctx.decodeAudioData(buf)
      const src = ctx.createBufferSource()
      src.buffer = decoded
      src.connect(ctx.destination)
      src.start(0)
    } catch {
      // Last-resort fallback
      try { new Audio(soundUrl).play().catch(() => {}) } catch {}
    }
  }, [restaurants, selectedRestaurant])

  // SSE real-time updates
  useSSEStream({
    onOrderEvent: (event) => {
      if (event.type === "NEW_ORDER") {
        setNewOrdersCount((c) => c + 1)
        toast.info(`🔔 Nouvelle commande — ${event.restaurantName}`, { duration: 8000 })
        playNotificationSound()
        fetchOrders()
      } else if (event.type === "ORDER_STATUS") {
        fetchOrders()
      }
    },
    enabled: !!selectedRestaurant,
  })

  // Polling fallback: refresh every 5s when tab is visible
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchOrders()
    }, 5_000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  useEffect(() => {
    listAdminRestaurants()
      .then((r) => {
        setRestaurants(r)
        if (r.length > 0) setSelectedRestaurant(r[0].id)
      })
      .catch(() => toast.error("Erreur chargement restaurants"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleNextStatus = async (order: AdminOrder) => {
    const statusFlow = order.orderType === "pickup" ? STATUS_FLOW_PICKUP : STATUS_FLOW_DELIVERY
    const currentIndex = statusFlow.indexOf(order.status)
    if (currentIndex === -1 || currentIndex >= statusFlow.length - 1) return
    const nextStatus = statusFlow[currentIndex + 1]
    try {
      const updated = await updateOrderStatus(order.id, nextStatus)
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: updated.status || nextStatus } : o))
      )
      toast.success(`Commande → ${statusLabel(nextStatus, order.orderType)}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  const handleDriverAssigned = (orderId: string, driverId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, driverId } : o))
    )
  }

  const handleUnassignDriver = async (order: AdminOrder) => {
    if (!confirm(`Désassigner le livreur de la commande #${order.id.slice(0, 8)} ?`)) return
    try {
      await unassignDriverFromOrder(order.id)
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, driverId: undefined, driverName: undefined, driverPhone: undefined } : o))
      )
      toast.success("Livreur désassigné")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la désassignation")
    }
  }

  const handleCancelOrder = async (order: AdminOrder) => {
    if (!confirm(`Annuler la commande #${order.id.slice(0, 8)} ? Cette action est irréversible.`)) return
    try {
      await cancelOrder(order.id, "Annulée par l'administrateur")
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: "cancelled" } : o))
      )
      toast.success("Commande annulée")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'annulation")
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Commandes</h1>
        {newOrdersCount > 0 && (
          <button
            onClick={() => { setNewOrdersCount(0); fetchOrders() }}
            className="flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white shadow-md animate-bounce hover:animate-none hover:bg-orange-600 transition-colors"
          >
            <Bell size={12} />
            {newOrdersCount} nouvelle{newOrdersCount > 1 ? "s" : ""}
          </button>
        )}
        {restaurants.find((r) => r.id === selectedRestaurant)?.notificationSoundUrl && (
          <button
            onClick={() => playNotificationSound()}
            title="Tester le son de notification"
            className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <Volume2 size={12} />
            Test son
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Gérer les commandes de vos restaurants</p>

      {/* Filters */}
      <div className="mt-4 flex flex-col gap-2 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="relative">
          <select
            value={selectedRestaurant}
            onChange={(e) => setSelectedRestaurant(e.target.value)}
            className="w-full appearance-none rounded-xl border bg-background py-2.5 pl-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-foreground/20 sm:w-auto"
          >
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>

        {/* Status filter */}
        <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {ORDER_STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={cn(
                "rounded-full px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap",
                statusFilter === s.value
                  ? "bg-foreground text-background"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {ORDER_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={cn(
                "rounded-full px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap",
                typeFilter === t.value
                  ? t.value === "pickup"
                    ? "bg-indigo-600 text-white"
                    : t.value === "scheduled"
                      ? "bg-sky-600 text-white"
                      : "bg-foreground text-background"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              {t.value === "scheduled"
                ? <span className="flex items-center gap-1"><CalendarClock size={10} />{t.label}</span>
                : t.value === "pickup"
                  ? <span className="flex items-center gap-1"><Store size={10} />{t.label}</span>
                  : t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders list */}
      {loadingOrders && orders.length === 0 ? (
        <div className="mt-12 flex justify-center">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <p className="mt-12 text-center text-sm text-muted-foreground">Aucune commande</p>
      ) : (
        <div className="mt-4 space-y-3 sm:mt-6">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onNextStatus={() => handleNextStatus(order)}
              onAssign={() => setAssigningOrder(order)}
              onUnassign={() => handleUnassignDriver(order)}
              onCancel={() => handleCancelOrder(order)}
              onPrepTimeUpdate={(updated) => setOrders((prev) => prev.map((o) => o.id === updated.id ? { ...o, estimatedPrepMinutes: updated.estimatedPrepMinutes } : o))}
              onMarkPaid={() => setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, paymentStatus: "paid" } : o))}
              onTicketClient={() => { setTicketOrder(order); setTicketType("client") }}
              onTicketRestaurant={() => { setTicketOrder(order); setTicketType("restaurant") }}
            />
          ))}
        </div>
      )}

      {/* Assign Driver Modal */}
      {assigningOrder && (
        <AssignDriverModal
          order={assigningOrder}
          onClose={() => setAssigningOrder(null)}
          onAssigned={(driverId) => handleDriverAssigned(assigningOrder.id, driverId)}
        />
      )}

      {ticketOrder && (
        <TicketModal
          order={ticketOrder}
          restaurantName={restaurants.find((r) => r.id === selectedRestaurant)?.name ?? "Restaurant"}
          defaultType={ticketType}
          onClose={() => setTicketOrder(null)}
        />
      )}
    </div>
  )
}
