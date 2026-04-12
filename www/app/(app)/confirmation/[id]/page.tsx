"use client"

import { use, useEffect, useState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Check, ArrowRight, Loader2, AlertTriangle, ShoppingBag, MapPin } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface OrderData {
  id: string
  status: string
  paymentStatus?: string
  total: number
  restaurantName?: string
  restaurantAddress?: string
  orderType?: string
  deliveryAddress?: string
  scheduledPickupTime?: string
}

type PaymentState = "verifying" | "confirmed" | "failed"

export default function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const isOnSitePickup = searchParams.get("payment") === "on_site"
  const [showCheck, setShowCheck] = useState(false)
  const [order, setOrder] = useState<OrderData | null>(null)
  const [paymentState, setPaymentState] = useState<PaymentState>("verifying")
  const pollCount = useRef(0)

  // Poll order status until confirmed or failed (max 30s)
  useEffect(() => {
    // On-site pickup: already confirmed, no need to poll payment
    if (isOnSitePickup) {
      setPaymentState("confirmed")
      return
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${id}`)
        if (!res.ok) return

        const data: OrderData = await res.json()
        setOrder(data)

        if (data.status === "confirmed" || data.paymentStatus === "paid") {
          setPaymentState("confirmed")
          return
        }

        if (data.paymentStatus === "failed") {
          setPaymentState("failed")
          return
        }
      } catch {
        // Continue polling on network errors
      }

      pollCount.current++
      if (pollCount.current >= 15) {
        // 30s timeout — still show as confirmed (webhook may arrive later)
        setPaymentState("confirmed")
        return
      }

      // Poll again in 2s
      timerId = setTimeout(poll, 2000)
    }

    let timerId: ReturnType<typeof setTimeout>
    poll()

    return () => clearTimeout(timerId)
  }, [id, isOnSitePickup])

  // Animate checkmark when confirmed
  useEffect(() => {
    if (paymentState === "confirmed") {
      const timer = setTimeout(() => setShowCheck(true), 100)
      return () => clearTimeout(timer)
    }
  }, [paymentState])

  if (paymentState === "verifying") {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <Loader2 size={40} className="mx-auto animate-spin text-muted-foreground" />
          <div className="space-y-2">
            <h1 className="text-xl font-bold">Paiement en cours de vérification...</h1>
            <p className="text-sm text-muted-foreground">
              Merci de patienter quelques instants
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (paymentState === "failed") {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle size={36} className="text-red-600 dark:text-red-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Paiement échoué</h1>
            <p className="text-sm text-muted-foreground">
              Le paiement n&apos;a pas pu être traité. Veuillez réessayer.
            </p>
          </div>
          <Link
            href="/restaurants"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Retour aux restaurants
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Checkmark Animation */}
        <div
          className={cn(
            "mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-foreground text-background transition-all duration-500",
            showCheck ? "scale-100 opacity-100" : "scale-50 opacity-0"
          )}
        >
          <Check size={36} strokeWidth={3} />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Commande confirmée !</h1>
          <p className="text-sm text-muted-foreground">
            Commande #{id.slice(0, 8)}
          </p>
        </div>

        {/* Recap */}
        {order ? (
          <div className="rounded-2xl border p-4 text-left space-y-3">
            {order.restaurantName && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Restaurant</span>
                <span className="font-medium">{order.restaurantName}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{order.total.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">
                {order.orderType === "delivery" ? "Livraison" : order.orderType === "pickup" ? "Click & Collect" : "Sur place"}
              </span>
            </div>
            {order.orderType === "pickup" && (
              <>
                {order.restaurantAddress && (
                  <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 mt-1">
                    <ShoppingBag size={14} className="mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Adresse de retrait</p>
                      <p className="text-sm font-medium">{order.restaurantAddress}</p>
                    </div>
                  </div>
                )}
                {order.scheduledPickupTime && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Heure de retrait</span>
                    <span className="font-medium">
                      {new Date(order.scheduledPickupTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}
                {isOnSitePickup && (
                  <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                    <MapPin size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">Paiement sur place à la caisse</p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}

        <Link
          href={`/suivi/${id}`}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Suivre ma commande
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}
