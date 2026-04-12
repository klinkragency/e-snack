"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Clock, Truck, TrendingUp, Calendar } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getMyReport, type DriverReport } from "@/lib/driver-client"

const QUICK_RANGES = [
  { label: "7 derniers jours", days: 7 },
  { label: "30 derniers jours", days: 30 },
  { label: "90 derniers jours", days: 90 },
]

function defaultRange(days = 30) {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days + 1)
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
}

function formatHours(h: number): string {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (hrs === 0) return mins > 0 ? `${mins}min` : "—"
  return mins > 0 ? `${hrs}h${String(mins).padStart(2, "0")}` : `${hrs}h`
}

export default function LivreurHistoryPage() {
  const defaults = defaultRange(30)
  const [report, setReport] = useState<DriverReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState(defaults.from)
  const [toDate, setToDate] = useState(defaults.to)
  const [activeRange, setActiveRange] = useState(30)

  const fetchReport = useCallback(() => {
    setLoading(true)
    getMyReport(fromDate, toDate)
      .then(setReport)
      .catch(() => toast.error("Erreur chargement de l'historique"))
      .finally(() => setLoading(false))
  }, [fromDate, toDate])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const applyQuickRange = (days: number) => {
    const r = defaultRange(days)
    setFromDate(r.from)
    setToDate(r.to)
    setActiveRange(days)
  }

  const activeDays = report?.days.filter((d) => d.hoursWorked > 0 || d.deliveriesCompleted > 0) ?? []
  const reversedDays = [...(report?.days ?? [])].reverse()

  return (
    <div className="min-h-dvh bg-background">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            href="/livreur"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl hover:bg-muted transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="font-bold text-lg">Mon historique</h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">

        {/* ── Quick range pills ── */}
        <div className="flex gap-2 flex-wrap">
          {QUICK_RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => applyQuickRange(r.days)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                activeRange === r.days
                  ? "bg-foreground text-background"
                  : "border hover:bg-muted text-muted-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* ── Custom date range ── */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-background p-4">
          <Calendar size={16} className="text-muted-foreground shrink-0" />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setActiveRange(0) }}
              className="rounded-xl border px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-foreground/20"
            />
            <span className="text-sm text-muted-foreground">→</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setActiveRange(0) }}
              className="rounded-xl border px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ── Summary cards ── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border bg-background p-4 text-center">
                <Clock size={18} className="mx-auto text-orange-500 mb-2" />
                <p className="text-2xl font-bold tabular-nums">
                  {formatHours(report?.totalHours ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Heures</p>
              </div>
              <div className="rounded-2xl border bg-background p-4 text-center">
                <Truck size={18} className="mx-auto text-blue-500 mb-2" />
                <p className="text-2xl font-bold tabular-nums">{report?.totalDeliveries ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Livraisons</p>
              </div>
              <div className="rounded-2xl border bg-background p-4 text-center">
                <TrendingUp size={18} className="mx-auto text-green-500 mb-2" />
                <p className="text-2xl font-bold tabular-nums">{activeDays.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Jours actifs</p>
              </div>
            </div>

            {/* ── Daily table ── */}
            {reversedDays.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-muted-foreground">
                <Truck size={40} className="opacity-30 mb-4" />
                <p className="font-medium">Aucune donnée sur cette période</p>
              </div>
            ) : (
              <div className="rounded-2xl border overflow-hidden">
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
                      {reversedDays.map((day) => {
                        const hasActivity = day.hoursWorked > 0 || day.deliveriesCompleted > 0
                        return (
                          <tr
                            key={day.date}
                            className={cn(
                              "transition-colors",
                              hasActivity
                                ? "hover:bg-foreground/[0.03]"
                                : "opacity-40"
                            )}
                          >
                            <td className="px-4 py-3 font-medium">{formatDate(day.date)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {day.hoursWorked > 0 ? (
                                <span className="font-semibold text-orange-600 dark:text-orange-400">
                                  {formatHours(day.hoursWorked)}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {day.deliveriesCompleted > 0 ? (
                                <span className="font-semibold text-blue-600 dark:text-blue-400">
                                  {day.deliveriesCompleted}
                                </span>
                              ) : "—"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-foreground/[0.02]">
                        <td className="px-4 py-3 font-bold">Total</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-orange-600 dark:text-orange-400">
                          {formatHours(report?.totalHours ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-blue-600 dark:text-blue-400">
                          {report?.totalDeliveries ?? 0}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
