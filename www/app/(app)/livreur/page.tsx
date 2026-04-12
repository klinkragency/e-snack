"use client"

import { useEffect, useState, useCallback } from "react"
import React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Loader2, MapPin, Clock, Check, X, Navigation, Package,
  Wifi, WifiOff, Phone, User, MessageSquare, Store, ChevronRight,
  TrendingUp, History,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import {
  getMyStatus,
  setAvailability,
  listMyDeliveries,
  acceptDelivery,
  rejectDelivery,
  getMyStats,
  type DeliveryAssignment,
  type DriverStatus,
  type DriverStats,
} from "@/lib/driver-client"
import { createDriverClient, type NewAssignmentPayload } from "@/lib/websocket-client"

export default function LivreurDashboardPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [status, setStatus] = useState<DriverStatus | null>(null)
  const [stats, setStats] = useState<DriverStats | null>(null)
  const [assignments, setAssignments] = useState<DeliveryAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [statusData, assignmentsData, statsData] = await Promise.all([
        getMyStatus(),
        listMyDeliveries(),
        getMyStats().catch(() => null),
      ])
      setStatus(statusData)
      setAssignments(assignmentsData)
      if (statsData) setStats(statsData)
    } catch (err) {
      console.error("Failed to fetch data:", err)
      toast.error("Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role !== "livreur") return
    fetchData()
  }, [user, fetchData])

  // Polling: refresh every 5s when online and tab is visible (Safari-safe backup)
  useEffect(() => {
    if (!user || user.role !== "livreur") return

    let interval: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      if (interval) return
      interval = setInterval(() => {
        if (document.visibilityState === "visible") fetchData()
      }, 10000)
    }

    const stopPolling = () => {
      if (interval) { clearInterval(interval); interval = null }
    }

    startPolling()
    document.addEventListener("visibilitychange", () => {
      document.visibilityState === "visible" ? startPolling() : stopPolling()
    })

    return () => {
      stopPolling()
    }
  }, [user, fetchData])

  // WebSocket: instant notification (bonus on top of polling)
  useEffect(() => {
    if (!user || user.role !== "livreur") return
    let wsClient: ReturnType<typeof createDriverClient> | null = null
    fetch("/api/auth/ws-token")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.token) return
        wsClient = createDriverClient(data.token)
        wsClient.on<NewAssignmentPayload>("NEW_ASSIGNMENT", () => {
          toast.info("🛵 Nouvelle livraison assignée !")
          fetchData()
        })
        wsClient.connect()
      })
      .catch(() => {})
    return () => { wsClient?.disconnect() }
  }, [user, fetchData])

  const handleToggleAvailability = async () => {
    if (!status || toggling) return
    const newStatus = status.status === "available" ? "offline" : "available"
    setToggling(true)
    try {
      const updated = await setAvailability(newStatus)
      setStatus(updated)
      toast.success(newStatus === "available" ? "Vous êtes maintenant disponible" : "Vous êtes hors ligne")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setToggling(false)
    }
  }

  const handleAccept = async (assignment: DeliveryAssignment) => {
    try {
      await acceptDelivery(assignment.id)
      toast.success("Livraison acceptée")
      router.push(`/livreur/delivery/${assignment.orderId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  const handleReject = async (assignment: DeliveryAssignment) => {
    try {
      await rejectDelivery(assignment.id)
      toast.success("Livraison refusée")
      setAssignments((prev) => prev.filter((a) => a.id !== assignment.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user || user.role !== "livreur") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 bg-background">
        <h1 className="text-2xl font-bold">Accès refusé</h1>
        <p className="text-sm text-muted-foreground">Vous devez être livreur pour accéder à cette page.</p>
        <Link href="/authentification" className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background">
          Se connecter
        </Link>
      </div>
    )
  }

  const isOnline = status?.status === "available" || status?.status === "on_delivery"
  const isOnDelivery = status?.status === "on_delivery"
  const pendingAssignments = assignments.filter((a) => a.status === "pending")
  const acceptedAssignments = assignments.filter((a) => a.status === "accepted")

  return (
    <div className="flex min-h-dvh flex-col bg-background">

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className={cn(
              "h-2.5 w-2.5 rounded-full transition-colors",
              isOnDelivery ? "bg-blue-500 animate-pulse" :
              isOnline     ? "bg-green-500 animate-pulse" :
                             "bg-gray-400"
            )} />
            <span className="text-sm font-semibold">
              {isOnDelivery ? "En livraison" : isOnline ? "Disponible" : "Hors ligne"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:block">{user.email}</span>
            <Link
              href="/livreur/history"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <History size={13} />
              <span className="hidden sm:inline">Historique</span>
            </Link>
            <button
              onClick={() => { window.location.href = "/api/auth/logout" }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              Sortir
            </button>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:grid lg:grid-cols-[340px_1fr] lg:gap-6 lg:py-8">

          {/* ── LEFT: Status + Stats ── */}
          <div className="space-y-4 lg:sticky lg:top-[57px] lg:self-start">

            {/* Online mode toggle */}
            <OnlineModeCard
              isOnline={isOnline}
              isOnDelivery={isOnDelivery}
              toggling={toggling}
              currentOrderId={status?.currentOrderId}
              onToggle={handleToggleAvailability}
            />

            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  icon={<Package size={16} className="text-blue-500" />}
                  value={stats.deliveriesToday}
                  label="Auj."
                  highlight={stats.deliveriesToday > 0}
                />
                <StatCard
                  icon={<Clock size={16} className="text-orange-500" />}
                  value={`${Math.floor(stats.hoursWorkedToday)}h${String(Math.round((stats.hoursWorkedToday % 1) * 60)).padStart(2, "0")}`}
                  label="Temps"
                />
                <StatCard
                  icon={<TrendingUp size={16} className="text-green-500" />}
                  value={stats.deliveriesTotal}
                  label="Total"
                />
              </div>
            )}
          </div>

          {/* ── RIGHT: Assignments ── */}
          <div className="mt-4 space-y-4 lg:mt-0">
            {/* Pending */}
            {pendingAssignments.length > 0 && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Nouvelles assignations ({pendingAssignments.length})
                </p>
                <div className="space-y-3">
                  {pendingAssignments.map((a) => (
                    <AssignmentCard
                      key={a.id}
                      assignment={a}
                      onAccept={() => handleAccept(a)}
                      onReject={() => handleReject(a)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Accepted */}
            {acceptedAssignments.length > 0 && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  En cours ({acceptedAssignments.length})
                </p>
                <div className="space-y-3">
                  {acceptedAssignments.map((a) => (
                    <ActiveDeliveryCard key={a.id} assignment={a} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {pendingAssignments.length === 0 && acceptedAssignments.length === 0 && (
              <div className="flex flex-col items-center py-14 text-center text-muted-foreground">
                <div className={cn(
                  "flex h-20 w-20 items-center justify-center rounded-full mb-5",
                  isOnline ? "bg-green-50 dark:bg-green-900/20" : "bg-muted"
                )}>
                  <Package size={34} className={isOnline ? "text-green-500" : "opacity-40"} />
                </div>
                <p className="font-semibold text-foreground">Aucune livraison</p>
                <p className="text-sm mt-1 max-w-xs">
                  {isOnline
                    ? "Vous êtes en ligne. Les nouvelles commandes apparaîtront ici."
                    : "Passez en ligne pour commencer à recevoir des livraisons."}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

/* ─── Active delivery card (accepted) ─── */
function ActiveDeliveryCard({ assignment }: { assignment: DeliveryAssignment }) {
  const order = assignment.order
  return (
    <Link
      href={`/livreur/delivery/${assignment.orderId}`}
      className="block rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 hover:bg-blue-100/60 transition-colors active:scale-[0.99] dark:border-blue-900/50 dark:bg-blue-900/10"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Navigation size={14} />
            </span>
            <p className="font-bold truncate">{order?.restaurantName || "Restaurant"}</p>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground flex items-center gap-1 truncate">
            <MapPin size={12} className="shrink-0 text-blue-500" />
            {order?.deliveryAddress || "Adresse de livraison"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold">{order?.total.toFixed(2)} €</p>
          <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Acceptée</p>
        </div>
      </div>

      {/* Customer info */}
      {(order?.customerName || order?.customerPhone) && (
        <div className="mt-3 flex items-center gap-4 rounded-xl bg-white/70 dark:bg-black/10 px-3 py-2 text-sm">
          {order.customerName && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <User size={13} />
              <span className="font-medium text-foreground">{order.customerName}</span>
            </span>
          )}
          {order.customerPhone && (
            <a
              href={`tel:${order.customerPhone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-blue-600 hover:underline font-medium"
            >
              <Phone size={13} />
              {order.customerPhone}
            </a>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{order?.itemCount ?? 0} article{(order?.itemCount ?? 0) > 1 ? "s" : ""}</span>
        <span className="flex items-center gap-1 text-xs font-semibold text-blue-600">
          Voir le détail <ChevronRight size={13} />
        </span>
      </div>
    </Link>
  )
}

/* ─── Online Mode Card ─── */
function OnlineModeCard({
  isOnline,
  isOnDelivery,
  toggling,
  currentOrderId,
  onToggle,
}: {
  isOnline: boolean
  isOnDelivery: boolean
  toggling: boolean
  currentOrderId?: string
  onToggle: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [countdown, setCountdown] = useState(3)

  // Reset confirmation state when status changes externally
  useEffect(() => {
    setConfirming(false)
    setCountdown(3)
  }, [isOnline])

  // Countdown timer
  useEffect(() => {
    if (!confirming) return
    if (countdown <= 0) {
      setConfirming(false)
      setCountdown(3)
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [confirming, countdown])

  const handleFirstClick = () => {
    if (isOnDelivery || toggling) return
    setConfirming(true)
    setCountdown(3)
  }

  const handleConfirm = () => {
    setConfirming(false)
    setCountdown(3)
    onToggle()
  }

  const handleCancel = () => {
    setConfirming(false)
    setCountdown(3)
  }

  return (
    <div className={cn(
      "rounded-2xl border p-5 transition-all duration-500",
      confirming
        ? isOnline
          ? "border-orange-300 bg-orange-50 dark:border-orange-800/50 dark:bg-orange-900/10"
          : "border-green-300 bg-green-50 dark:border-green-800/50 dark:bg-green-900/10"
        : isOnDelivery
        ? "border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/10"
        : isOnline
        ? "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-900/10"
        : "border-border bg-muted/30"
    )}>
      {/* Status label */}
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
        Mode en ligne
      </p>

      {/* Power button + label */}
      <div className="flex items-center gap-5">
        {/* Big power button */}
        <button
          onClick={confirming ? handleConfirm : handleFirstClick}
          disabled={toggling || isOnDelivery}
          className={cn(
            "relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full transition-all duration-300 focus:outline-none",
            isOnDelivery
              ? "bg-blue-500 shadow-[0_0_0_8px_rgba(59,130,246,0.15)] cursor-not-allowed"
              : confirming
              ? isOnline
                ? "bg-orange-500 shadow-[0_0_0_8px_rgba(249,115,22,0.25)] scale-105"
                : "bg-green-500 shadow-[0_0_0_8px_rgba(34,197,94,0.25)] scale-105"
              : isOnline
              ? "bg-green-500 shadow-[0_0_0_8px_rgba(34,197,94,0.2)] hover:shadow-[0_0_0_12px_rgba(34,197,94,0.15)] active:scale-95"
              : "bg-foreground/10 hover:bg-foreground/15 active:scale-95",
            "disabled:opacity-70"
          )}
          aria-label="Toggle disponibilité"
        >
          {toggling ? (
            <Loader2 size={28} className={cn("animate-spin", isOnline ? "text-white" : "text-foreground")} />
          ) : confirming ? (
            <span className="text-white text-2xl font-bold tabular-nums">{countdown}</span>
          ) : isOnline ? (
            <Wifi size={28} className="text-white" />
          ) : (
            <WifiOff size={28} className="text-foreground/60" />
          )}
          {/* Pulse ring when online (not confirming) */}
          {isOnline && !isOnDelivery && !toggling && !confirming && (
            <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-20" />
          )}
        </button>

        {/* Label + action */}
        <div className="flex-1 min-w-0">
          {confirming ? (
            <>
              <p className="text-xl font-bold leading-tight">
                {isOnline ? "Passer hors ligne ?" : "Aller en ligne ?"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isOnline
                  ? "Tu ne recevras plus de commandes."
                  : "Tu seras bien en service et disponible ?"}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleConfirm}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-semibold text-white transition-colors",
                    isOnline ? "bg-orange-500 hover:bg-orange-600" : "bg-green-600 hover:bg-green-700"
                  )}
                >
                  {isOnline ? "Passer hors ligne" : "Oui, je suis dispo"}
                </button>
                <button
                  onClick={handleCancel}
                  className="rounded-full border px-4 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                >
                  Annuler
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xl font-bold leading-tight">
                {isOnDelivery ? "En livraison" : isOnline ? "En ligne" : "Hors ligne"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isOnDelivery
                  ? "Terminez votre livraison en cours"
                  : isOnline
                  ? "Appuyez pour passer hors ligne"
                  : "Appuyez pour aller en ligne"}
              </p>
              {!isOnDelivery && (
                <button
                  onClick={handleFirstClick}
                  disabled={toggling}
                  className={cn(
                    "mt-3 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                    isOnline
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-foreground text-background hover:bg-foreground/90"
                  )}
                >
                  {toggling ? "..." : isOnline ? "Se déconnecter" : "Aller en ligne"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isOnDelivery && currentOrderId && (
        <Link
          href={`/livreur/delivery/${currentOrderId}`}
          className="mt-4 flex items-center justify-center gap-2 rounded-full bg-blue-600 text-white py-3.5 text-sm font-semibold hover:bg-blue-700 transition-colors active:scale-[0.98]"
        >
          <Navigation size={16} />
          Voir ma livraison en cours
        </Link>
      )}
    </div>
  )
}

/* ─── Stat Card ─── */
function StatCard({ icon, value, label, highlight }: { icon: React.ReactNode; value: string | number; label: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl border bg-background p-4 text-center", highlight && "border-blue-200 bg-blue-50 dark:bg-blue-900/10")}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

/* ─── Assignment Card ─── */
function AssignmentCard({
  assignment,
  onAccept,
  onReject,
}: {
  assignment: DeliveryAssignment
  onAccept: () => void
  onReject: () => void
}) {
  const [accepting, setAccepting] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  const expiresAt = new Date(assignment.expiresAt)
  const minutesLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 60000))
  const isUrgent = minutesLeft <= 2

  const handleAccept = async () => { setAccepting(true); await onAccept(); setAccepting(false) }
  const handleReject = async () => { setRejecting(true); await onReject(); setRejecting(false) }

  const order = assignment.order
  const items = order?.items ?? []

  return (
    <div className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-5 dark:border-orange-900/50 dark:bg-orange-900/10">

      {/* ── Header: restaurant + total ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Store size={15} className="shrink-0 text-orange-600" />
            <p className="font-bold text-base truncate">{order?.restaurantName || "Restaurant"}</p>
          </div>
          {order?.restaurantAddress && (
            <p className="text-xs text-muted-foreground mt-0.5 ml-5 truncate">{order.restaurantAddress}</p>
          )}
        </div>
        <span className="shrink-0 text-2xl font-bold text-orange-700 dark:text-orange-400">{order?.total.toFixed(2)} €</span>
      </div>

      {/* ── Delivery address ── */}
      <div className="mt-2.5 flex items-start gap-1.5 text-sm text-muted-foreground">
        <MapPin size={13} className="shrink-0 mt-0.5 text-orange-500" />
        <span className="truncate">{order?.deliveryAddress || "Adresse de livraison"}</span>
      </div>

      {/* ── Customer info ── */}
      {(order?.customerName || order?.customerPhone) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-white/70 dark:bg-black/10 px-3 py-2 text-sm">
          {order.customerName && (
            <span className="flex items-center gap-1.5">
              <User size={13} className="text-muted-foreground" />
              <span className="font-medium">{order.customerName}</span>
            </span>
          )}
          {order.customerPhone && (
            <a
              href={`tel:${order.customerPhone}`}
              className="flex items-center gap-1.5 text-blue-600 hover:underline font-medium"
            >
              <Phone size={13} />
              {order.customerPhone}
            </a>
          )}
        </div>
      )}

      {/* ── Items ── */}
      {items.length > 0 && (
        <div className="mt-3 rounded-xl bg-white/70 dark:bg-black/10 divide-y divide-border">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px] font-bold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                  {item.quantity}
                </span>
                <span className="truncate">{item.productName}</span>
              </span>
              <span className="shrink-0 text-muted-foreground">{item.total.toFixed(2)} €</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Delivery instructions ── */}
      {order?.deliveryInstructions && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/40 px-3 py-2 text-sm">
          <MessageSquare size={13} className="mt-0.5 shrink-0 text-yellow-600" />
          <span className="text-yellow-800 dark:text-yellow-300 text-xs">{order.deliveryInstructions}</span>
        </div>
      )}

      {/* ── Timer ── */}
      <div className={cn(
        "mt-3 flex items-center gap-1.5 text-sm font-medium",
        isUrgent ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"
      )}>
        <Clock size={14} className={isUrgent ? "animate-pulse" : ""} />
        {isUrgent ? `⚠️ Expire dans ${minutesLeft} min` : `Expire dans ${minutesLeft} min`}
      </div>

      {/* ── Actions ── */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={handleReject}
          disabled={rejecting || accepting}
          className="flex items-center justify-center gap-2 rounded-full border border-red-200 bg-white py-3.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 active:scale-[0.97]"
        >
          {rejecting ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
          Refuser
        </button>
        <button
          onClick={handleAccept}
          disabled={accepting || rejecting}
          className="flex items-center justify-center gap-2 rounded-full bg-green-600 py-3.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50 active:scale-[0.97]"
        >
          {accepting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Accepter
        </button>
      </div>
    </div>
  )
}

