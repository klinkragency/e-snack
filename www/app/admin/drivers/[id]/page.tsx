"use client"

import { use, useEffect, useState } from "react"
import { ArrowLeft, Loader2, Clock, Truck, Phone, Mail, User } from "lucide-react"
import { toast } from "sonner"
import { getDriverReport, type DriverReport } from "@/lib/admin-client"
import { cn } from "@/lib/utils"
import Link from "next/link"

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

function defaultDateRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  }
}

export default function DriverReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const defaults = defaultDateRange()
  const [report, setReport] = useState<DriverReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState(defaults.from)
  const [toDate, setToDate] = useState(defaults.to)

  useEffect(() => {
    setLoading(true)
    getDriverReport(id, fromDate, toDate)
      .then(setReport)
      .catch(() => toast.error("Erreur chargement du relevé"))
      .finally(() => setLoading(false))
  }, [id, fromDate, toDate])

  const driver = report?.driver

  return (
    <div className="px-4 py-4 md:px-8 md:py-8 max-w-4xl">
      {/* Back link */}
      <Link
        href="/admin/drivers"
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Livreurs
      </Link>

      {loading && !report ? (
        <div className="mt-12 flex justify-center">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : !driver ? (
        <p className="mt-12 text-center text-muted-foreground">Livreur introuvable</p>
      ) : (
        <>
          {/* Driver header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-lg font-bold dark:bg-blue-900/40 dark:text-blue-300">
                {(driver.name || driver.email)[0].toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{driver.name || "Sans nom"}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Mail size={13} /> {driver.email}</span>
                  {driver.phone && <span className="flex items-center gap-1"><Phone size={13} /> {driver.phone}</span>}
                </div>
              </div>
            </div>
            {driver.status && (
              <span className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                STATUS_STYLES[driver.status.status] || STATUS_STYLES.offline
              )}>
                {STATUS_LABELS[driver.status.status] || driver.status.status}
              </span>
            )}
          </div>

          {/* Summary cards */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border p-5 text-center">
              <Clock size={20} className="mx-auto text-muted-foreground" />
              <p className="mt-2 text-3xl font-bold">{(report?.totalHours ?? 0).toFixed(1)}h</p>
              <p className="mt-1 text-xs text-muted-foreground uppercase">Heures travaillées</p>
            </div>
            <div className="rounded-2xl border p-5 text-center">
              <Truck size={20} className="mx-auto text-muted-foreground" />
              <p className="mt-2 text-3xl font-bold">{report?.totalDeliveries ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground uppercase">Livraisons</p>
            </div>
          </div>

          {/* Date range picker */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <label className="text-sm text-muted-foreground">Du</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-foreground/20"
            />
            <label className="text-sm text-muted-foreground">au</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>

          {/* Daily breakdown table */}
          {loading ? (
            <div className="mt-8 flex justify-center">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-foreground/[0.02] border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-right px-4 py-3 font-medium">Heures</th>
                    <th className="text-right px-4 py-3 font-medium">Livraisons</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...(report?.days || [])].reverse().map((day) => {
                    const hasActivity = day.hoursWorked > 0 || day.deliveriesCompleted > 0
                    return (
                      <tr
                        key={day.date}
                        className={cn(
                          "transition-colors",
                          hasActivity
                            ? "bg-foreground/[0.02] hover:bg-foreground/[0.04]"
                            : "opacity-50"
                        )}
                      >
                        <td className="px-4 py-3 font-medium">{formatDate(day.date)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {day.hoursWorked > 0 ? `${day.hoursWorked.toFixed(1)}h` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {day.deliveriesCompleted > 0 ? day.deliveriesCompleted : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold bg-foreground/[0.02]">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums">{(report?.totalHours ?? 0).toFixed(1)}h</td>
                    <td className="px-4 py-3 text-right tabular-nums">{report?.totalDeliveries ?? 0}</td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}
