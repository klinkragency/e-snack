"use client"

import { use, useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, MapPin, Phone, Navigation, Package, Check, Loader2, Clock, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import {
  listMyDeliveries,
  updateDeliveryStatus,
  type DeliveryAssignment,
} from "@/lib/driver-client"

type DeliveryStage = "pickup" | "on_the_way" | "delivered"

export default function DeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = use(params)
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()

  const [assignment, setAssignment] = useState<DeliveryAssignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [stage, setStage] = useState<DeliveryStage>("pickup")

  const fetchDelivery = useCallback(async () => {
    try {
      const deliveries = await listMyDeliveries("accepted")
      const found = deliveries.find((d) => d.orderId === orderId)
      if (found) {
        setAssignment(found)
        // Determine stage based on order status
        if (found.order?.status === "out_for_delivery") {
          setStage("on_the_way")
        } else if (found.order?.status === "delivered") {
          setStage("delivered")
        } else {
          setStage("pickup")
        }
      }
    } catch (err) {
      console.error("Failed to fetch delivery:", err)
      toast.error("Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    if (user?.role === "livreur") {
      fetchDelivery()
    }
  }, [user, fetchDelivery])

  const handlePickedUp = async () => {
    if (!assignment) return
    setUpdating(true)
    try {
      await updateDeliveryStatus(assignment.id, "picked_up")
      setStage("on_the_way")
      toast.success("Commande récupérée")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setUpdating(false)
    }
  }

  const handleDelivered = async () => {
    if (!assignment) return
    setUpdating(true)
    try {
      await updateDeliveryStatus(assignment.id, "delivered")
      setStage("delivered")
      toast.success("Livraison terminée !")
      // Redirect back to dashboard after a delay
      setTimeout(() => {
        router.push("/livreur")
      }, 2000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setUpdating(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user || user.role !== "livreur") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6">
        <h1 className="text-2xl font-bold">Accès refusé</h1>
        <Link
          href="/authentification"
          className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background"
        >
          Se connecter
        </Link>
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6">
        <AlertCircle size={48} className="text-muted-foreground" />
        <h1 className="text-xl font-bold">Livraison non trouvée</h1>
        <Link
          href="/livreur"
          className="rounded-full border px-6 py-3 text-sm font-semibold hover:bg-muted transition-colors"
        >
          Retour au tableau de bord
        </Link>
      </div>
    )
  }

  const order = assignment.order

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">

      {/* ── Fixed header ── */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/80 backdrop-blur-md px-4 py-3">
        <Link
          href="/livreur"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold truncate">Livraison #{orderId.slice(0, 8)}</h1>
          <p className="text-xs text-muted-foreground">
            {stage === "pickup" ? "Récupération au restaurant" : stage === "on_the_way" ? "En route vers le client" : "Livraison terminée"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold">{order?.total.toFixed(2)} €</p>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto pb-8">
        <div className="mx-auto max-w-lg px-4 pt-5 space-y-4">

          {/* Progress steps */}
          <div className="rounded-2xl border bg-background p-5">
            <div className="flex items-center">
              <StageStep active={stage === "pickup"} completed={stage !== "pickup"} label="Récupération" />
              <div className="flex-1 mx-2 h-0.5 bg-muted overflow-hidden rounded-full">
                <div className={cn(
                  "h-full bg-foreground transition-all duration-500",
                  stage === "pickup" ? "w-0" : "w-full"
                )} />
              </div>
              <StageStep active={stage === "on_the_way"} completed={stage === "delivered"} label="En route" />
              <div className="flex-1 mx-2 h-0.5 bg-muted overflow-hidden rounded-full">
                <div className={cn("h-full bg-foreground transition-all duration-500", stage === "delivered" ? "w-full" : "w-0")} />
              </div>
              <StageStep active={stage === "delivered"} completed={false} label="Livrée" />
            </div>
          </div>

          {/* Stage content */}
          {stage === "pickup" && order && (
            <>
              <div className="rounded-2xl border bg-background p-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Restaurant</p>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30">
                    <Package size={18} />
                  </div>
                  <div>
                    <p className="font-bold">{order.restaurantName}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{order.restaurantAddress}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm">
                  <Clock size={14} className="text-muted-foreground" />
                  <span>{order.itemCount} article{order.itemCount > 1 ? "s" : ""} à récupérer</span>
                </div>
              </div>

              <button
                onClick={handlePickedUp}
                disabled={updating}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-foreground text-background py-5 text-base font-semibold transition-transform hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                {updating ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                Commande récupérée
              </button>
            </>
          )}

          {stage === "on_the_way" && order && (
            <>
              {/* Delivery address card */}
              <div className="rounded-2xl border bg-background p-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adresse de livraison</p>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <p className="font-bold">{order.deliveryAddress}</p>
                    {order.deliveryInstructions && (
                      <p className="text-sm text-muted-foreground mt-1 italic">"{order.deliveryInstructions}"</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid gap-3 grid-cols-2">
                {order.customerPhone && (
                  <a
                    href={`tel:${order.customerPhone}`}
                    className="flex items-center justify-center gap-2 rounded-2xl border bg-background py-4 text-sm font-semibold hover:bg-muted transition-colors active:scale-[0.97]"
                  >
                    <Phone size={16} />
                    Appeler
                  </a>
                )}
                <a
                  href={`https://maps.google.com/?daddr=${encodeURIComponent(order.deliveryAddress || "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-2xl border bg-background py-4 text-sm font-semibold hover:bg-muted transition-colors active:scale-[0.97]",
                    !order.customerPhone && "col-span-2"
                  )}
                >
                  <Navigation size={16} />
                  Maps
                </a>
              </div>

              <button
                onClick={handleDelivered}
                disabled={updating}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-green-600 text-white py-5 text-base font-semibold hover:bg-green-700 transition-colors active:scale-[0.98] disabled:opacity-50"
              >
                {updating ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                Marquer comme livrée
              </button>
            </>
          )}

          {stage === "delivered" && (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
                <Check size={44} className="text-green-600" />
              </div>
              <h2 className="text-2xl font-bold">Livraison terminée !</h2>
              <p className="text-sm text-muted-foreground mt-2">Redirection vers le tableau de bord...</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function StageStep({
  active,
  completed,
  label,
}: {
  active: boolean
  completed: boolean
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
          completed || active ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
        )}
      >
        {completed ? <Check size={14} /> : active ? "•" : ""}
      </div>
      <span className={cn("text-[10px]", active || completed ? "font-medium" : "text-muted-foreground")}>
        {label}
      </span>
    </div>
  )
}
