"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Loader2,
  Search,
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Percent,
  DollarSign,
  Truck,
} from "lucide-react"
import { toast } from "sonner"
import {
  listPromos,
  updatePromo,
  deletePromo,
  type PromoCode,
} from "@/lib/admin-client"

const DISCOUNT_TYPE_ICONS = {
  percentage: Percent,
  fixed_amount: DollarSign,
  free_delivery: Truck,
}

const DISCOUNT_TYPE_LABELS = {
  percentage: "Pourcentage",
  fixed_amount: "Montant fixe",
  free_delivery: "Livraison gratuite",
}

export default function AdminPromosPage() {
  const [promos, setPromos] = useState<PromoCode[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)

  const pageSize = 20

  const loadPromos = async () => {
    setLoading(true)
    try {
      const data = await listPromos(page, pageSize, search || undefined)
      setPromos(data.promos || [])
      setTotal(data.total || 0)
    } catch {
      toast.error("Erreur chargement codes promo")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPromos()
  }, [page])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1)
      loadPromos()
    }, 300)
    return () => clearTimeout(timeout)
  }, [search])

  const handleToggleActive = async (promo: PromoCode) => {
    try {
      await updatePromo(promo.id, { isActive: !promo.isActive })
      toast.success(promo.isActive ? "Code promo désactivé" : "Code promo activé")
      loadPromos()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  const handleDelete = async (promo: PromoCode) => {
    if (!confirm(`Supprimer le code "${promo.code}" ?`)) return
    try {
      await deletePromo(promo.id)
      toast.success("Code promo supprimé")
      loadPromos()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  const formatDiscount = (promo: PromoCode) => {
    switch (promo.discountType) {
      case "percentage":
        return `${promo.discountValue}%`
      case "fixed_amount":
        return `${promo.discountValue.toFixed(2)} €`
      case "free_delivery":
        return "Gratuite"
    }
  }

  const isExpired = (promo: PromoCode) => {
    if (!promo.expiresAt) return false
    return new Date(promo.expiresAt) < new Date()
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="px-4 py-4 md:px-8 md:py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Codes promo</h1>
          <p className="text-sm text-muted-foreground">{total} codes</p>
        </div>
        <Link
          href="/admin/promos/new"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:bg-foreground/90"
        >
          <Plus size={16} />
          Nouveau code
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un code..."
            className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
        {/* Desktop table (sm+) */}
        <div className="hidden sm:block rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.02] border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Réduction</th>
                <th className="text-left px-4 py-3 font-medium">Utilisations</th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="text-left px-4 py-3 font-medium">Validité</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {promos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucun code promo
                  </td>
                </tr>
              ) : (
                promos.map((promo) => {
                  const Icon = DISCOUNT_TYPE_ICONS[promo.discountType]
                  return (
                    <tr key={promo.id} className="hover:bg-foreground/[0.02]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-base">{promo.code}</span>
                          {promo.isPrivate && (
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                              Privé
                            </span>
                          )}
                          {promo.requiresClaim && (
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              Claim
                            </span>
                          )}
                        </div>
                        {promo.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                            {promo.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Icon size={14} />
                          {DISCOUNT_TYPE_LABELS[promo.discountType]}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatDiscount(promo)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground">
                          {promo.currentUses}
                          {promo.maxTotalUses ? ` / ${promo.maxTotalUses}` : ""}
                        </span>
                        {promo.isPrivate && promo.assignedCount > 0 && (
                          <p className="text-[10px] text-muted-foreground">
                            {promo.assignedCount} attribués, {promo.claimedCount} réclamés
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isExpired(promo) ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            Expiré
                          </span>
                        ) : promo.isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            Inactif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {promo.expiresAt ? (
                          <>
                            Jusqu&apos;au {new Date(promo.expiresAt).toLocaleDateString("fr-FR")}
                          </>
                        ) : (
                          "Sans limite"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setActionMenuId(actionMenuId === promo.id ? null : promo.id)}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {actionMenuId === promo.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border bg-background shadow-lg z-50">
                              <div className="p-1">
                                <Link
                                  href={`/admin/promos/${promo.id}`}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
                                  onClick={() => setActionMenuId(null)}
                                >
                                  <Pencil size={14} /> Modifier
                                </Link>
                                <button
                                  onClick={() => { handleToggleActive(promo); setActionMenuId(null) }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
                                >
                                  {promo.isActive ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                                  {promo.isActive ? "Désactiver" : "Activer"}
                                </button>
                                <div className="my-1 border-t" />
                                <button
                                  onClick={() => { handleDelete(promo); setActionMenuId(null) }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 size={14} /> Supprimer
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list (< sm) */}
        <div className="sm:hidden rounded-2xl border divide-y">
          {promos.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Aucun code promo</p>
          ) : (
            promos.map((promo) => {
              const Icon = DISCOUNT_TYPE_ICONS[promo.discountType]
              return (
                <div key={promo.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    {/* Left: code + badges */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-bold text-base">{promo.code}</span>
                        {promo.isPrivate && (
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                            Privé
                          </span>
                        )}
                        {promo.requiresClaim && (
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            Claim
                          </span>
                        )}
                        {isExpired(promo) ? (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">Expiré</span>
                        ) : promo.isActive ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">Actif</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">Inactif</span>
                        )}
                      </div>
                      {promo.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">{promo.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Icon size={12} />
                          {DISCOUNT_TYPE_LABELS[promo.discountType]}
                        </span>
                        <span className="font-medium text-foreground">{formatDiscount(promo)}</span>
                        <span>
                          {promo.currentUses}{promo.maxTotalUses ? ` / ${promo.maxTotalUses}` : ""} utilisation{promo.currentUses !== 1 ? "s" : ""}
                        </span>
                        {promo.expiresAt && (
                          <span>Jusqu&apos;au {new Date(promo.expiresAt).toLocaleDateString("fr-FR")}</span>
                        )}
                      </div>
                    </div>
                    {/* Right: action menu */}
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setActionMenuId(actionMenuId === promo.id ? null : promo.id)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {actionMenuId === promo.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border bg-background shadow-lg z-50">
                          <div className="p-1">
                            <Link
                              href={`/admin/promos/${promo.id}`}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
                              onClick={() => setActionMenuId(null)}
                            >
                              <Pencil size={14} /> Modifier
                            </Link>
                            <button
                              onClick={() => { handleToggleActive(promo); setActionMenuId(null) }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
                            >
                              {promo.isActive ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                              {promo.isActive ? "Désactiver" : "Activer"}
                            </button>
                            <div className="my-1 border-t" />
                            <button
                              onClick={() => { handleDelete(promo); setActionMenuId(null) }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 size={14} /> Supprimer
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Précédent
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} sur {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      )}

      {/* Click outside to close menu */}
      {actionMenuId && (
        <div className="fixed inset-0 z-40" onClick={() => setActionMenuId(null)} />
      )}
    </div>
  )
}
