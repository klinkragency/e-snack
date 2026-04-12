"use client"

import { useEffect, useState, useCallback } from "react"
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import {
  ShoppingBag, TrendingUp, Euro, BarChart2, XCircle,
  RefreshCw, Users, Loader2, Globe, Monitor, MousePointer, Eye, ShoppingCart, Award,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPIs {
  totalOrders: number
  todayOrders: number
  totalRevenue: number
  avgOrderValue: number
  cancelledOrders: number
  cancelRate: number
  paidOrders: number
}

interface TrendPoint { date: string; orders: number; revenue: number }
interface RestoStat { name: string; orders: number; revenue: number }
interface TypeStat { type: string; count: number }

interface PostHogData {
  pageviews: { date: string; count: number; visitors: number }[]
  totals: { sessions: number; users: number; pageviews: number }
  topPages: { path: string; views: number; visitors: number }[]
  countries: { country: string; count: number }[]
  devices: { device: string; count: number }[]
  browsers: { browser: string; count: number }[]
  topProducts: { name: string; addToCartCount: number; orderCount: number }[]
}

interface Analytics {
  period: number
  kpis: KPIs
  trend: TrendPoint[]
  byRestaurant: RestoStat[]
  orderTypes: TypeStat[]
  posthogConfigured: boolean
  posthogError: string | null
  posthog: PostHogData | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n)

const fmtN = (n: number) =>
  new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(n)

const fmtShort = (d: string) => {
  const date = new Date(d)
  return `${date.getDate()}/${date.getMonth() + 1}`
}

const TYPE_LABELS: Record<string, string> = {
  delivery: "Livraison",
  pickup: "À emporter",
  "dine-in": "Sur place",
}

const PIE_COLORS = ["#0a0a0a", "#525252", "#a3a3a3"]
const BAR_COLORS = ["#0a0a0a", "#404040", "#737373", "#a3a3a3", "#d4d4d4", "#e5e5e5", "#f5f5f5", "#fafafa"]

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType
}) {
  return (
    <div className="rounded-2xl border bg-background p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
          <Icon size={15} className="text-foreground" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-black tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function SectionTitle({ children, badge }: { children: React.ReactNode; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <h2 className="text-sm font-bold">{children}</h2>
      {badge && (
        <span className="text-[10px] font-semibold uppercase tracking-widest bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border bg-background shadow-xl p-3 text-xs min-w-[130px]">
      <p className="font-bold text-muted-foreground mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold">
            {p.name === "Revenu" ? fmt(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PERIODS = [
  { label: "7j", value: 7 },
  { label: "30j", value: 30 },
  { label: "90j", value: 90 },
]

export default function AnalyticsPage() {
  const [period, setPeriod] = useState(30)
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/analytics?period=${period}`)
      if (!res.ok) throw new Error("Erreur serveur")
      setData(await res.json())
    } catch {
      setError("Impossible de charger les analytics")
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  const d = data

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Vue d&apos;ensemble de l&apos;activité</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border overflow-hidden text-xs font-semibold">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-2 transition-colors ${
                  period === p.value ? "bg-foreground text-background" : "hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="w-9 h-9 rounded-xl border flex items-center justify-center hover:bg-muted transition-colors"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading && !d ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 size={18} className="animate-spin" /> Chargement…
        </div>
      ) : d ? (
        <>
          {/* ── KPIs Commandes ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Commandes" value={String(d.kpis.totalOrders)} sub={`${d.kpis.todayOrders} aujourd'hui`} icon={ShoppingBag} />
            <KpiCard label="Revenu" value={fmt(d.kpis.totalRevenue)} sub={`Moy. ${fmt(d.kpis.avgOrderValue)}`} icon={Euro} />
            <KpiCard label="Payées" value={String(d.kpis.paidOrders)} sub={`${d.kpis.totalOrders > 0 ? Math.round(d.kpis.paidOrders / d.kpis.totalOrders * 100) : 0}% du total`} icon={TrendingUp} />
            <KpiCard label="Annulées" value={`${d.kpis.cancelRate.toFixed(1)}%`} sub={`${d.kpis.cancelledOrders} commandes`} icon={XCircle} />
          </div>

          {/* ── Trend Commandes ── */}
          <div className="rounded-2xl border bg-background p-4 sm:p-5">
            <SectionTitle>Évolution commandes & revenu</SectionTitle>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={d.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} interval={period <= 7 ? 0 : period <= 30 ? 4 : 13} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} width={20} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${v}€`} />
                <Tooltip content={<CustomTooltip />} />
                <Line yAxisId="left" type="monotone" dataKey="orders" name="Commandes" stroke="#0a0a0a" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenu" stroke="#737373" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ── Par restaurant + Types ── */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border bg-background p-4 sm:p-5">
              <SectionTitle>Par restaurant</SectionTitle>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={d.byRestaurant} layout="vertical" barSize={10}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} width={80} />
                  <Tooltip formatter={(v: number) => [v, "commandes"]} contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }} />
                  <Bar dataKey="orders" name="Commandes" fill="#0a0a0a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border bg-background p-4 sm:p-5">
              <SectionTitle>Types de commande</SectionTitle>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={d.orderTypes} dataKey="count" nameKey="type" cx="50%" cy="50%" innerRadius={32} outerRadius={52} paddingAngle={3}>
                      {d.orderTypes.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, name: string) => [v, TYPE_LABELS[name] ?? name]} contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 flex-1">
                  {d.orderTypes.map((t, i) => (
                    <div key={t.type} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {TYPE_LABELS[t.type] ?? t.type}
                      </span>
                      <span className="text-xs font-bold">{t.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── PostHog Section ── */}
          {d.posthogConfigured ? (
            d.posthogError === "missing_scope" ? (
              <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6">
                <p className="text-sm font-semibold text-amber-800">Clé API PostHog — scope manquant</p>
                <p className="text-xs text-amber-700 mt-1">Recréez votre clé avec le scope <code className="bg-amber-100 px-1 rounded">query:read</code> dans PostHog → Settings → Personal API keys</p>
              </div>
            ) : d.posthogError === "query_failed" ? (
              <div className="rounded-2xl border border-dashed border-red-200 bg-red-50 p-6">
                <p className="text-sm font-semibold text-red-800">Erreur PostHog</p>
                <p className="text-xs text-red-700 mt-1">Une requête a échoué. Vérifiez les logs du serveur.</p>
              </div>
            ) : d.posthog ? (
              <>
                {/* KPIs Comportementaux */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-sm font-bold">Comportement visiteurs</h2>
                    <span className="text-[10px] font-semibold uppercase tracking-widest bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">PostHog</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <KpiCard label="Pages vues" value={fmtN(d.posthog.totals.pageviews)} sub={`sur ${period} jours`} icon={Eye} />
                    <KpiCard label="Visiteurs uniques" value={fmtN(d.posthog.totals.users)} sub="personnes distinctes" icon={Users} />
                    <KpiCard label="Sessions" value={fmtN(d.posthog.totals.sessions)} sub="visites totales" icon={MousePointer} />
                  </div>
                </div>

                {/* Top Products */}
                {d.posthog.topProducts.length > 0 && (
                  <div className="rounded-2xl border bg-background p-4 sm:p-5">
                    <SectionTitle badge="PostHog">Articles les plus populaires</SectionTitle>
                    <div className="space-y-3">
                      {d.posthog.topProducts.map((p, i) => {
                        const maxScore = d.posthog!.topProducts[0]
                          ? d.posthog!.topProducts[0].addToCartCount + d.posthog!.topProducts[0].orderCount * 2
                          : 1
                        const score = p.addToCartCount + p.orderCount * 2
                        return (
                          <div key={p.name} className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                              i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-neutral-300 text-neutral-700" : i === 2 ? "bg-orange-300 text-white" : "bg-muted text-muted-foreground"
                            }`}>
                              {i < 3 ? <Award size={10} /> : i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold truncate">{p.name}</span>
                                <div className="flex items-center gap-2 ml-2 shrink-0">
                                  {p.addToCartCount > 0 && (
                                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                      <ShoppingCart size={9} /> {p.addToCartCount}
                                    </span>
                                  )}
                                  {p.orderCount > 0 && (
                                    <span className="flex items-center gap-1 text-[10px] font-semibold text-foreground">
                                      <ShoppingBag size={9} /> {p.orderCount}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${i === 0 ? "bg-amber-400" : i === 1 ? "bg-neutral-400" : "bg-foreground"}`}
                                  style={{ width: `${(score / maxScore) * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
                      <ShoppingCart size={9} /> = ajouts panier · <ShoppingBag size={9} /> = commandé · classement par score combiné
                    </p>
                  </div>
                )}

                {/* Trend Pageviews + Visiteurs */}
                <div className="rounded-2xl border bg-background p-4 sm:p-5">
                  <SectionTitle badge="PostHog">Pages vues & visiteurs uniques</SectionTitle>                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={d.posthog.pageviews}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} interval={period <= 7 ? 0 : period <= 30 ? 4 : 13} />
                      <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} width={20} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="count" name="Pages vues" stroke="#f97316" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="visitors" name="Visiteurs" stroke="#0a0a0a" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Top pages + Countries */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Top pages */}
                  <div className="rounded-2xl border bg-background p-4 sm:p-5">
                    <SectionTitle badge="PostHog">Pages les plus visitées</SectionTitle>
                    <div className="space-y-2">
                      {d.posthog.topPages.length > 0 ? d.posthog.topPages.map((p) => {
                        const maxViews = d.posthog!.topPages[0]?.views || 1
                        return (
                          <div key={p.path} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-medium truncate">{p.path || "/"}</span>
                                <span className="text-xs text-muted-foreground ml-2 shrink-0">{p.views} vues</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full bg-foreground rounded-full transition-all" style={{ width: `${(p.views / maxViews) * 100}%` }} />
                              </div>
                            </div>
                          </div>
                        )
                      }) : <p className="text-xs text-muted-foreground">Aucune donnée</p>}
                    </div>
                  </div>

                  {/* Countries */}
                  <div className="rounded-2xl border bg-background p-4 sm:p-5">
                    <SectionTitle badge="PostHog">Pays des visiteurs</SectionTitle>
                    {d.posthog.countries.length > 0 ? (
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={d.posthog.countries} layout="vertical" barSize={10}>
                          <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="country" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} width={70} />
                          <Tooltip formatter={(v: number) => [v, "vues"]} contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }} />
                          <Bar dataKey="count" name="Pages vues" fill="#f97316" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p className="text-xs text-muted-foreground">Aucune donnée géographique</p>}
                  </div>
                </div>

                {/* Devices + Browsers */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border bg-background p-4 sm:p-5">
                    <SectionTitle badge="PostHog">Appareils</SectionTitle>
                    {d.posthog.devices.length > 0 ? (
                      <div className="flex items-center gap-4">
                        <ResponsiveContainer width={110} height={110}>
                          <PieChart>
                            <Pie data={d.posthog.devices} dataKey="count" nameKey="device" cx="50%" cy="50%" innerRadius={28} outerRadius={48} paddingAngle={3}>
                              {d.posthog.devices.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-col gap-2 flex-1">
                          {d.posthog.devices.map((dv, i) => {
                            const total = d.posthog!.devices.reduce((s, x) => s + x.count, 0)
                            return (
                              <div key={dv.device} className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-xs">
                                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                  <Monitor size={11} className="text-muted-foreground" />
                                  {dv.device || "Inconnu"}
                                </span>
                                <span className="text-xs font-bold">{total > 0 ? Math.round(dv.count / total * 100) : 0}%</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : <p className="text-xs text-muted-foreground">Aucune donnée</p>}
                  </div>

                  <div className="rounded-2xl border bg-background p-4 sm:p-5">
                    <SectionTitle badge="PostHog">Navigateurs</SectionTitle>
                    {d.posthog.browsers.length > 0 ? (
                      <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={d.posthog.browsers} barSize={12}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="browser" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} width={20} />
                          <Tooltip formatter={(v: number) => [v, "vues"]} contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }} />
                          {d.posthog.browsers.map((b, i) => (
                            <Bar key={b.browser} dataKey="count" name={b.browser} fill={BAR_COLORS[i % BAR_COLORS.length]} radius={[3, 3, 0, 0]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-xs text-muted-foreground">Aucune donnée</p>
                    )}
                  </div>
                </div>

                {/* Globe icon banner */}
                <div className="rounded-2xl border bg-muted/30 p-4 flex items-center gap-3">
                  <Globe size={18} className="text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Données comportementales collectées via <span className="font-semibold text-foreground">PostHog</span> — projet <code className="bg-muted px-1 rounded text-[11px]">{process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID ?? "215785"}</code>
                  </p>
                  <a href="https://us.posthog.com/project/215785" target="_blank" rel="noopener noreferrer" className="ml-auto text-xs font-semibold text-orange-600 hover:underline shrink-0">
                    Ouvrir PostHog →
                  </a>
                </div>
              </>
            ) : null
          ) : (
            <div className="rounded-2xl border border-dashed bg-muted/30 p-6 flex flex-col items-center gap-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <BarChart2 size={18} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">PostHog non configuré</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ajoutez <code className="bg-muted px-1 rounded text-[11px]">POSTHOG_PERSONAL_API_KEY</code> et{" "}
                  <code className="bg-muted px-1 rounded text-[11px]">POSTHOG_PROJECT_ID</code> dans votre <code className="bg-muted px-1 rounded text-[11px]">.env</code>
                </p>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
