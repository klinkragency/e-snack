"use client"

import { use, useEffect, useState } from "react"
import { Printer, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface OrderItem {
  productName: string
  quantity: number
  unitPrice: number
  total: number
  notes?: string
  options?: { optionName: string; choiceName: string; priceModifier: number }[]
  formulaName?: string
  formulaProducts?: { productName: string; options?: { optionName: string; choiceName: string; priceModifier: number }[] }[]
}

interface OrderDetail {
  id: string
  status: string
  orderType: string
  restaurantName?: string
  customerName?: string
  customerEmail?: string
  deliveryAddress?: string
  items: OrderItem[]
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  paymentStatus: string
  createdAt: string
}

const ORDER_TYPE_LABEL: Record<string, string> = {
  delivery: "Livraison à domicile",
  pickup: "Click & Collect",
  dine_in: "Sur place",
}

const PAYMENT_LABEL: Record<string, string> = {
  paid: "Payé en ligne",
  on_site: "Paiement en boutique",
  cash: "Espèces",
  pending: "En attente",
}

export default function FacturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Commande introuvable")
        return r.json()
      })
      .then(setOrder)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error || "Commande introuvable"}</p>
        <Link href="/account/orders" className="text-sm underline">Retour aux commandes</Link>
      </div>
    )
  }

  const date = new Date(order.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .invoice-container { box-shadow: none !important; border: none !important; max-width: 100% !important; }
        }
      `}</style>

      {/* Nav bar — hidden when printing */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
        <Link href="/account/orders" className="flex items-center gap-2 text-sm font-medium hover:opacity-70">
          <ArrowLeft size={16} />
          Mes commandes
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-80"
        >
          <Printer size={14} />
          Imprimer / PDF
        </button>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="invoice-container rounded-2xl border bg-white p-8 shadow-sm dark:bg-card">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Beldys</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">beldys.fr</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">Facture</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>

          <div className="mt-6 h-px bg-border" />

          {/* Order meta */}
          <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</p>
              <p className="mt-1">{date}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mode de commande</p>
              <p className="mt-1">{ORDER_TYPE_LABEL[order.orderType] || order.orderType}</p>
            </div>
            {order.restaurantName && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Restaurant</p>
                <p className="mt-1">{order.restaurantName}</p>
              </div>
            )}
            {order.customerName && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client</p>
                <p className="mt-1">{order.customerName}</p>
                {order.customerEmail && <p className="text-xs text-muted-foreground">{order.customerEmail}</p>}
              </div>
            )}
            {order.deliveryAddress && (
              <div className="col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Adresse de livraison</p>
                <p className="mt-1">{order.deliveryAddress}</p>
              </div>
            )}
          </div>

          <div className="mt-6 h-px bg-border" />

          {/* Items table */}
          <div className="mt-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Articles</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 text-left">Article</th>
                  <th className="pb-2 text-center">Qté</th>
                  <th className="pb-2 text-right">P.U.</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2.5">
                      <p className="font-medium">{item.productName}</p>
                      {item.options?.map((opt, j) => (
                        <p key={j} className="text-[11px] text-muted-foreground">
                          {opt.optionName}: {opt.choiceName}
                          {opt.priceModifier > 0 && ` (+${opt.priceModifier.toFixed(2)} €)`}
                        </p>
                      ))}
                    </td>
                    <td className="py-2.5 text-center text-muted-foreground">{item.quantity}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{(item.unitPrice ?? 0).toFixed(2)} €</td>
                    <td className="py-2.5 text-right font-medium">{(item.total ?? 0).toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 h-px bg-border" />

          {/* Totals */}
          <div className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Sous-total</span>
              <span>{(order.subtotal || 0).toFixed(2)} €</span>
            </div>
            {(order.deliveryFee ?? 0) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Frais de livraison</span>
                <span>{order.deliveryFee.toFixed(2)} €</span>
              </div>
            )}
            {(order.discount ?? 0) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Réduction</span>
                <span>-{order.discount.toFixed(2)} €</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <span>Total</span>
              <span>{(order.total ?? 0).toFixed(2)} €</span>
            </div>
          </div>

          <div className="mt-5 h-px bg-border" />

          {/* Payment */}
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Mode de paiement</span>
            <span className="font-medium">{PAYMENT_LABEL[order.paymentStatus] || order.paymentStatus}</span>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-[11px] text-muted-foreground">
            Merci pour votre commande · Beldys, Monaco
          </p>
        </div>
      </div>
    </>
  )
}
