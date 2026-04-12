"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Loader2, Store, Pencil, Settings, ToggleLeft, ToggleRight, Trash2, ChevronUp, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { listAdminRestaurants, updateRestaurant, deleteRestaurant, reorderRestaurants } from "@/lib/admin-client"
import type { Restaurant } from "@/lib/restaurant-types"
import { cn } from "@/lib/utils"

export default function AdminRestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Restaurant | null>(null)
  const [reordering, setReordering] = useState(false)

  const load = () => {
    setLoading(true)
    listAdminRestaurants()
      .then(setRestaurants)
      .catch(() => toast.error("Erreur chargement restaurants"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const toggleActive = async (r: Restaurant) => {
    try {
      await updateRestaurant(r.id, { isActive: !r.isActive })
      setRestaurants((prev) =>
        prev.map((item) => (item.id === r.id ? { ...item, isActive: !item.isActive } : item))
      )
      toast.success(r.isActive ? "Restaurant désactivé" : "Restaurant activé")
    } catch {
      toast.error("Erreur")
    }
  }

  const confirmAndDelete = async () => {
    if (!confirmDelete) return
    const r = confirmDelete
    setConfirmDelete(null)
    setDeletingId(r.id)
    try {
      await deleteRestaurant(r.id)
      setRestaurants((prev) => prev.filter((item) => item.id !== r.id))
      toast.success(`${r.name} supprimé`)
    } catch {
      toast.error("Erreur lors de la suppression")
    } finally {
      setDeletingId(null)
    }
  }

  const move = async (index: number, direction: "up" | "down") => {
    const newList = [...restaurants]
    const swapIndex = direction === "up" ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newList.length) return
    ;[newList[index], newList[swapIndex]] = [newList[swapIndex], newList[index]]
    setRestaurants(newList)
    setReordering(true)
    try {
      await reorderRestaurants(newList.map((r) => r.id))
    } catch {
      toast.error("Erreur lors de la réorganisation")
      load() // rollback from server
    } finally {
      setReordering(false)
    }
  }

  return (
    <div className="px-4 py-4 md:px-8 md:py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Restaurants</h1>
          <p className="mt-1 text-sm text-muted-foreground">{restaurants.length} restaurants</p>
        </div>
        <Link
          href="/admin/restaurants/new"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus size={16} />
          Nouveau
        </Link>
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : restaurants.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground/5">
            <Store size={28} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Aucun restaurant pour le moment</p>
          <Link href="/admin/restaurants/new" className="text-sm font-medium underline">
            Créer votre premier restaurant
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {restaurants.map((r, index) => (
            <div
              key={r.id}
              className="rounded-2xl border p-4 transition-colors hover:border-foreground/10 sm:p-5"
            >
              <div className="flex items-center gap-3">
                {/* Reorder arrows */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => move(index, "up")}
                    disabled={index === 0 || reordering}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted disabled:opacity-20"
                    title="Monter"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => move(index, "down")}
                    disabled={index === restaurants.length - 1 || reordering}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted disabled:opacity-20"
                    title="Descendre"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/5 sm:h-12 sm:w-12">
                  <Store size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground truncate sm:text-sm">
                    {r.slug} · {r.address || "Pas d'adresse"}
                  </p>
                </div>

                {/* Desktop actions */}
                <div className="hidden sm:flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      r.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    )}
                  >
                    {r.isActive ? "Actif" : "Inactif"}
                  </span>
                  <button
                    onClick={() => toggleActive(r)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                    title={r.isActive ? "Désactiver" : "Activer"}
                  >
                    {r.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} className="text-muted-foreground" />}
                  </button>
                  <Link
                    href={`/admin/restaurants/${r.id}/edit`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                    title="Modifier"
                  >
                    <Settings size={16} />
                  </Link>
                  <Link
                    href={`/admin/restaurants/${r.id}/menu`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                    title="Menu"
                  >
                    <Pencil size={16} />
                  </Link>
                  <button
                    onClick={() => setConfirmDelete(r)}
                    disabled={deletingId === r.id}
                    className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors disabled:opacity-50"
                    title="Supprimer"
                  >
                    {deletingId === r.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </div>
              </div>

              {/* Mobile actions */}
              <div className="mt-3 flex items-center justify-between sm:hidden">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                    r.isActive
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  )}
                >
                  {r.isActive ? "Actif" : "Inactif"}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(r)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                    title={r.isActive ? "Désactiver" : "Activer"}
                  >
                    {r.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} className="text-muted-foreground" />}
                  </button>
                  <Link
                    href={`/admin/restaurants/${r.id}/edit`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                    title="Modifier"
                  >
                    <Settings size={16} />
                  </Link>
                  <Link
                    href={`/admin/restaurants/${r.id}/menu`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                    title="Menu"
                  >
                    <Pencil size={16} />
                  </Link>
                  <button
                    onClick={() => setConfirmDelete(r)}
                    disabled={deletingId === r.id}
                    className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors disabled:opacity-50"
                    title="Supprimer"
                  >
                    {deletingId === r.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setConfirmDelete(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Supprimer le restaurant ?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Vous êtes sur le point de supprimer{" "}
              <span className="font-medium text-foreground">« {confirmDelete.name} »</span>.
              Cette action est irréversible.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                Annuler
              </button>
              <button
                onClick={confirmAndDelete}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
