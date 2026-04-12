"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShoppingBag, ChevronRight, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { listOrders } from "@/lib/account-client"

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Confirmée", color: "bg-blue-100 text-blue-700" },
  preparing: { label: "En préparation", color: "bg-purple-100 text-purple-700" },
  ready: { label: "Prête", color: "bg-green-100 text-green-700" },
  delivering: { label: "En livraison", color: "bg-indigo-100 text-indigo-700" },
  delivered: { label: "Livrée", color: "bg-green-100 text-green-700" },
  completed: { label: "Terminée", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Annulée", color: "bg-red-100 text-red-700" },
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    listOrders(page, 10)
      .then((data) => {
        setOrders(data.orders || [])
        setTotalCount(data.totalCount || 0)
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [page])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold">Mes commandes</h2>

      <div className="mt-6 space-y-2">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <ShoppingBag size={32} className="text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucune commande pour le moment
            </p>
          </div>
        ) : (
          orders.map((order) => {
            const status = statusLabels[(order.status as string) || ""] || {
              label: order.status as string,
              color: "bg-muted text-muted-foreground",
            }
            const items = (order.items as Array<Record<string, unknown>>) || []
            return (
              <Link
                key={order.id as string}
                href={`/suivi/${order.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 transition-colors hover:bg-muted sm:px-4 sm:py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="text-sm font-medium">
                      #{(order.id as string).slice(0, 8)}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium sm:text-xs", status.color)}>
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
                    {new Date(order.createdAt as string).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {items.length} article{items.length > 1 ? "s" : ""}
                    {" · "}
                    {((order.total as number) || 0).toFixed(2)} €
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      window.open(`/facture/${order.id}`, "_blank")
                    }}
                    className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted sm:text-xs"
                    title="Télécharger la facture"
                  >
                    <FileText size={12} />
                    Facture
                  </button>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {totalCount > 10 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Précédent
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} / {Math.ceil(totalCount / 10)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(totalCount / 10)}
            className="rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  )
}
