"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Store, ShoppingBag, ArrowRight, Users, Truck, Tag } from "lucide-react"
import { listAdminRestaurants, listAdminUsers, listDrivers } from "@/lib/admin-client"

export default function AdminDashboard() {
  const [stats, setStats] = useState({ restaurants: 0, users: 0, drivers: 0, driversAvailable: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const [restaurants, usersData, driversData, driversAvailData] = await Promise.all([
          listAdminRestaurants(),
          listAdminUsers(1, 1, ""),
          listDrivers(undefined, 1),
          listDrivers("available", 1),
        ])
        setStats({
          restaurants: restaurants.length,
          users: usersData.total || 0,
          drivers: driversData.total || 0,
          driversAvailable: driversAvailData.total || 0,
        })
      } catch {}
      finally { setLoading(false) }
    })()
  }, [])

  const cards = [
    { label: "Restaurants", value: stats.restaurants, href: "/admin/restaurants", icon: Store, pill: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
    { label: "Utilisateurs", value: stats.users, href: "/admin/users", icon: Users, pill: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" },
    { label: "Livreurs", value: stats.drivers, href: "/admin/drivers", icon: Truck, pill: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
    { label: "Disponibles", value: stats.driversAvailable, href: "/admin/drivers", icon: Truck, pill: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  ]

  const actions = [
    { label: "Nouveau restaurant", href: "/admin/restaurants/new", icon: Store },
    { label: "Voir commandes", href: "/admin/orders", icon: ShoppingBag },
    { label: "Nouveau code promo", href: "/admin/promos/new", icon: Tag },
    { label: "Gérer livreurs", href: "/admin/drivers", icon: Truck },
  ]

  return (
    <div className="px-4 py-4 md:px-8 md:py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Vue d&apos;ensemble de votre plateforme</p>
      </div>

      {/* Stats — 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 gap-3 mb-8 lg:grid-cols-4 lg:gap-5">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Link
              key={c.label}
              href={c.href}
              className="group flex flex-col gap-4 rounded-2xl border p-4 transition-all hover:border-foreground/20 hover:shadow-sm lg:p-6"
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${c.pill}`}>
                  <Icon size={17} />
                </div>
                <ArrowRight size={14} className="mt-1 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {loading ? <span className="inline-block h-7 w-10 animate-pulse rounded-lg bg-foreground/10" /> : c.value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.label}</p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Quick actions */}
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions rapides</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {actions.map((a) => {
          const Icon = a.icon
          return (
            <Link
              key={a.label}
              href={a.href}
              className="flex items-center gap-3 rounded-xl border p-3.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/5">
                <Icon size={15} />
              </div>
              <span className="leading-tight">{a.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
