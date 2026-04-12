"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Search, Truck, Clock, CheckCircle2, XCircle, ChevronRight, User } from "lucide-react"
import { toast } from "sonner"
import { listDrivers, type DriverDetails } from "@/lib/admin-client"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<string, string> = {
  offline: "Hors ligne",
  available: "Disponible",
  busy: "Occupé",
  on_delivery: "En livraison",
}

const STATUS_STYLES: Record<string, string> = {
  offline: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  available: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  busy: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  on_delivery: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
}

const STATUS_ICONS: Record<string, typeof Clock> = {
  offline: XCircle,
  available: CheckCircle2,
  busy: Clock,
  on_delivery: Truck,
}

const STATUS_FILTERS = [
  { value: "", label: "Tous" },
  { value: "available", label: "Disponibles" },
  { value: "on_delivery", label: "En livraison" },
  { value: "busy", label: "Occupés" },
  { value: "offline", label: "Hors ligne" },
]

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "À l'instant"
  if (diffMins < 60) return `Il y a ${diffMins} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays < 30) return `Il y a ${diffDays}j`
  return new Date(dateStr).toLocaleDateString("fr-FR")
}

export default function AdminDriversPage() {
  const router = useRouter()
  const [drivers, setDrivers] = useState<DriverDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    setLoading(true)
    listDrivers(statusFilter || undefined, page)
      .then((data) => {
        setDrivers(data.drivers || [])
        setTotal(data.total)
      })
      .catch(() => toast.error("Erreur chargement livreurs"))
      .finally(() => setLoading(false))
  }, [statusFilter, page])

  // Client-side search
  const filteredDrivers = search
    ? drivers.filter(
        (d) =>
          (d.name && d.name.toLowerCase().includes(search.toLowerCase())) ||
          d.email.toLowerCase().includes(search.toLowerCase())
      )
    : drivers

  // Stats from current page data
  const availableCount = drivers.filter((d) => d.status?.status === "available").length
  const onDeliveryCount = drivers.filter((d) => d.status?.status === "on_delivery").length
  const totalPages = Math.ceil(total / 20)

  return (
    <div className="px-4 py-4 md:px-8 md:py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Livreurs</h1>
          <span className="rounded-full bg-foreground/10 px-3 py-0.5 text-sm font-medium tabular-nums">
            {total}
          </span>
        </div>
        <div className="flex gap-3 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            {availableCount} disponible{availableCount > 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            {onDeliveryCount} en livraison
          </span>
        </div>
      </div>

      {/* Filters row */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status pill buttons */}
        <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.value}
              onClick={() => { setStatusFilter(s.value); setPage(1) }}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition-colors shrink-0",
                statusFilter === s.value
                  ? "bg-foreground text-background"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou email..."
            className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="mt-12 flex justify-center">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="mt-12 text-center">
          <User size={48} className="mx-auto text-muted-foreground opacity-50" />
          <p className="mt-4 text-sm text-muted-foreground">Aucun livreur trouvé</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cliquez sur un livreur pour voir son relevé
          </p>
        </div>
      ) : (
        <>
        {/* Desktop table (sm+) */}
        <div className="mt-6 hidden sm:block rounded-2xl border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-foreground/[0.02] border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Livreur</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Téléphone</th>
                  <th className="text-left px-4 py-3 font-medium">Statut</th>
                  <th className="text-right px-4 py-3 font-medium">Livr. auj.</th>
                  <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Heures</th>
                  <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">Total</th>
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredDrivers.map((driver) => {
                  const status = driver.status?.status || "offline"
                  const Icon = STATUS_ICONS[status] || XCircle
                  const lastSeen = status === "offline" && driver.status?.lastSeenAt
                    ? formatRelativeTime(driver.status.lastSeenAt)
                    : null

                  return (
                    <tr
                      key={driver.id}
                      onClick={() => router.push(`/admin/drivers/${driver.id}`)}
                      className="cursor-pointer hover:bg-foreground/[0.04] transition-colors group"
                    >
                      {/* Avatar + Name + Email */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold dark:bg-blue-900/40 dark:text-blue-300">
                            {(driver.name || driver.email)[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{driver.name || "Sans nom"}</p>
                            <p className="text-xs text-muted-foreground truncate">{driver.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {driver.phone || "—"}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                          STATUS_STYLES[status]
                        )}>
                          <Icon size={12} />
                          {STATUS_LABELS[status]}
                        </span>
                        {lastSeen && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">{lastSeen}</p>
                        )}
                      </td>

                      {/* Deliveries today */}
                      <td className="px-4 py-3 text-right tabular-nums">
                        {driver.stats?.deliveriesToday ?? 0}
                      </td>

                      {/* Hours today */}
                      <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell">
                        {(driver.stats?.hoursWorkedToday ?? 0).toFixed(1)}h
                      </td>

                      {/* Total deliveries */}
                      <td className="px-4 py-3 text-right tabular-nums hidden lg:table-cell">
                        {driver.stats?.deliveriesTotal ?? 0}
                      </td>

                      {/* Chevron */}
                      <td className="px-2 py-3">
                        <ChevronRight
                          size={16}
                          className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile card list (< sm) */}
        <div className="mt-6 sm:hidden rounded-2xl border divide-y">
          {filteredDrivers.map((driver) => {
            const status = driver.status?.status || "offline"
            const Icon = STATUS_ICONS[status] || XCircle
            const lastSeen = status === "offline" && driver.status?.lastSeenAt
              ? formatRelativeTime(driver.status.lastSeenAt)
              : null
            return (
              <button
                key={driver.id}
                onClick={() => router.push(`/admin/drivers/${driver.id}`)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-foreground/[0.03]"
              >
                {/* Avatar */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold dark:bg-blue-900/40 dark:text-blue-300">
                  {(driver.name || driver.email)[0].toUpperCase()}
                </div>
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{driver.name || "Sans nom"}</p>
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      STATUS_STYLES[status]
                    )}>
                      <Icon size={10} />
                      {STATUS_LABELS[status]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{driver.email}</p>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                    {lastSeen && <span>{lastSeen}</span>}
                    <span>{driver.stats?.deliveriesToday ?? 0} livr. auj.</span>
                    <span>{(driver.stats?.hoursWorkedToday ?? 0).toFixed(1)}h</span>
                  </div>
                </div>
                {/* Chevron */}
                <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
              </button>
            )
          })}
        </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Affichage {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} sur {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50 hover:bg-muted transition-colors"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50 hover:bg-muted transition-colors"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
