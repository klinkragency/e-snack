import { authedBackendFetch } from "@/lib/api-auth"
import { queryPostHog } from "@/lib/posthog-server"

export const dynamic = "force-dynamic"

interface Order {
  id: string
  restaurantId: string
  status: string
  orderType: string
  total: number
  createdAt: string
  paymentStatus: string
}

interface Restaurant { id: string; name: string }

function dayKey(iso: string) { return iso.slice(0, 10) }

function dateRange(days: number) {
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

type TrendsResult = { results: { days: string[]; data: number[] }[] }
type HogQLResult = { results: (string | number)[][] }

async function phTrend(event: string, period: number, math?: string) {
  return queryPostHog<TrendsResult>({
    query: {
      kind: "TrendsQuery",
      series: [{ kind: "EventsNode", event, ...(math ? { math } : {}) }],
      dateRange: { date_from: `-${period}d` },
      interval: "day",
    },
  })
}

async function phHogQL(sql: string) {
  return queryPostHog<HogQLResult>({ query: { kind: "HogQLQuery", query: sql } })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const period = parseInt(url.searchParams.get("period") ?? "30", 10)

  // ── 1. Fetch all restaurants ──────────────────────────────────────────────
  const restRes = await authedBackendFetch("/api/v1/restaurants")
  const restBody = await restRes.json().catch(() => ({ restaurants: [] }))
  const restaurants: Restaurant[] = restBody.restaurants ?? []

  // ── 2. Fetch orders for each restaurant ───────────────────────────────────
  const allOrders: Order[] = []
  await Promise.all(
    restaurants.map(async (r) => {
      const res = await authedBackendFetch(`/api/v1/admin/restaurants/${r.id}/orders`)
      const body = await res.json().catch(() => ({ orders: [] }))
      const orders: Order[] = (body.orders ?? []).map((o: Order) => ({
        ...o,
        restaurantId: o.restaurantId || r.id,
      }))
      allOrders.push(...orders)
    })
  )

  // ── 3. Filter to the requested period ─────────────────────────────────────
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - period)
  const filtered = allOrders.filter((o) => {
    const d = new Date(o.createdAt)
    return d >= cutoff && o.status !== "cancelled"
  })
  const cancelled = allOrders.filter((o) => {
    const d = new Date(o.createdAt)
    return d >= cutoff && o.status === "cancelled"
  })

  // ── 4. Aggregate ──────────────────────────────────────────────────────────
  const days = dateRange(period)

  const byDay: Record<string, { orders: number; revenue: number }> = {}
  days.forEach((d) => { byDay[d] = { orders: 0, revenue: 0 } })
  filtered.forEach((o) => {
    const k = dayKey(o.createdAt)
    if (byDay[k]) { byDay[k].orders++; byDay[k].revenue += o.total }
  })
  const trend = days.map((date) => ({ date, ...byDay[date] }))

  const byResto: Record<string, { name: string; orders: number; revenue: number }> = {}
  restaurants.forEach((r) => { byResto[r.id] = { name: r.name, orders: 0, revenue: 0 } })
  filtered.forEach((o) => {
    if (byResto[o.restaurantId]) {
      byResto[o.restaurantId].orders++
      byResto[o.restaurantId].revenue += o.total
    }
  })
  const byRestaurant = Object.values(byResto).sort((a, b) => b.revenue - a.revenue)

  const byType: Record<string, number> = { delivery: 0, pickup: 0, "dine-in": 0 }
  filtered.forEach((o) => { byType[o.orderType] = (byType[o.orderType] ?? 0) + 1 })
  const orderTypes = Object.entries(byType).map(([type, count]) => ({ type, count }))

  const today = new Date().toISOString().slice(0, 10)
  const todayOrders = filtered.filter((o) => dayKey(o.createdAt) === today)
  const totalRevenue = filtered.reduce((s, o) => s + o.total, 0)
  const avgOrderValue = filtered.length > 0 ? totalRevenue / filtered.length : 0

  // ── 5. PostHog: all metrics in parallel ───────────────────────────────────
  const posthogConfigured = !!(process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID)

  let posthogError: string | null = null
  let posthog: {
    pageviews: { date: string; count: number; visitors: number }[]
    totals: { sessions: number; users: number; pageviews: number }
    topPages: { path: string; views: number; visitors: number }[]
    countries: { country: string; count: number }[]
    devices: { device: string; count: number }[]
    browsers: { browser: string; count: number }[]
    topProducts: { name: string; addToCartCount: number; orderCount: number }[]
  } | null = null

  if (posthogConfigured) {
    try {
      const [pvTrend, dauTrend, totalsRes, pagesRes, countriesRes, devicesRes, browsersRes] =
        await Promise.all([
          phTrend("$pageview", period),
          phTrend("$pageview", period, "dau"),
          phHogQL(
            `SELECT count(distinct $session_id) as sessions,
                    count(distinct person_id) as users,
                    count() as pageviews
             FROM events
             WHERE event = '$pageview'
               AND timestamp >= now() - INTERVAL ${period} DAY`
          ),
          phHogQL(
            `SELECT properties.$pathname as path,
                    count() as views,
                    count(distinct person_id) as visitors
             FROM events
             WHERE event = '$pageview'
               AND timestamp >= now() - INTERVAL ${period} DAY
             GROUP BY path ORDER BY views DESC LIMIT 10`
          ),
          phHogQL(
            `SELECT properties.$geoip_country_name as country, count() as cnt
             FROM events
             WHERE event = '$pageview'
               AND timestamp >= now() - INTERVAL ${period} DAY
             GROUP BY country ORDER BY cnt DESC LIMIT 10`
          ),
          phHogQL(
            `SELECT properties.$device_type as device, count() as cnt
             FROM events
             WHERE event = '$pageview'
               AND timestamp >= now() - INTERVAL ${period} DAY
             GROUP BY device ORDER BY cnt DESC`
          ),
          phHogQL(
            `SELECT properties.$browser as browser, count() as cnt
             FROM events
             WHERE event = '$pageview'
               AND timestamp >= now() - INTERVAL ${period} DAY
             GROUP BY browser ORDER BY cnt DESC LIMIT 8`
          ),
        ])

      // Products: run separately so a failure doesn't kill the main data
      const topProductsRes = await phHogQL(
        `SELECT properties.product_name as name, count() as cnt
         FROM events
         WHERE event = 'product_added_to_cart'
           AND timestamp >= now() - INTERVAL ${period} DAY
         GROUP BY name ORDER BY cnt DESC LIMIT 15`
      ).catch(() => null)

      const pvDays = pvTrend?.results?.[0]
      const dauDays = dauTrend?.results?.[0]

      const topProducts = (topProductsRes?.results ?? [])
        .filter((r) => r[0])
        .map((r) => ({ name: String(r[0]), addToCartCount: Number(r[1]) || 0, orderCount: 0 }))

      posthog = {
        pageviews: pvDays
          ? pvDays.days.map((date, i) => ({
              date,
              count: pvDays.data[i] ?? 0,
              visitors: dauDays?.data[i] ?? 0,
            }))
          : [],
        totals: totalsRes?.results?.[0]
          ? {
              sessions: Number(totalsRes.results[0][0]) || 0,
              users: Number(totalsRes.results[0][1]) || 0,
              pageviews: Number(totalsRes.results[0][2]) || 0,
            }
          : { sessions: 0, users: 0, pageviews: 0 },
        topPages: (pagesRes?.results ?? []).map((r) => ({
          path: String(r[0] || "/"),
          views: Number(r[1]) || 0,
          visitors: Number(r[2]) || 0,
        })),
        countries: (countriesRes?.results ?? [])
          .filter((r) => r[0])
          .map((r) => ({ country: String(r[0]), count: Number(r[1]) || 0 })),
        devices: (devicesRes?.results ?? [])
          .filter((r) => r[0])
          .map((r) => ({ device: String(r[0]), count: Number(r[1]) || 0 })),
        browsers: (browsersRes?.results ?? [])
          .filter((r) => r[0])
          .map((r) => ({ browser: String(r[0]), count: Number(r[1]) || 0 })),
        topProducts,
      }
    } catch (e: unknown) {
      const err = e as Error & { status?: number }
      posthogError = err.status === 403 ? "missing_scope" : "query_failed"
      console.error("[PostHog] analytics error:", err.message)
    }
  }

  return Response.json({
    period,
    kpis: {
      totalOrders: filtered.length,
      todayOrders: todayOrders.length,
      totalRevenue,
      avgOrderValue,
      cancelledOrders: cancelled.length,
      cancelRate: allOrders.filter((o) => new Date(o.createdAt) >= cutoff).length > 0
        ? (cancelled.length / allOrders.filter((o) => new Date(o.createdAt) >= cutoff).length) * 100
        : 0,
      paidOrders: filtered.filter((o) => o.paymentStatus === "paid").length,
    },
    trend,
    byRestaurant,
    orderTypes,
    posthogConfigured,
    posthogError,
    posthog,
  })
}
