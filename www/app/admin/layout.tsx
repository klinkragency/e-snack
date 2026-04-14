"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Store, ShoppingBag, LogOut, LayoutDashboard, Settings,
  Users, Tag, Truck, Menu, X, ChevronRight, ExternalLink, BarChart2,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { ErrorBoundary } from "@/components/error-boundary"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/admin",              label: "Dashboard",     icon: LayoutDashboard },
  { href: "/admin/analytics",    label: "Analytics",     icon: BarChart2 },
  { href: "/admin/restaurants",  label: "Restaurants",   icon: Store },
  { href: "/admin/orders",       label: "Commandes",     icon: ShoppingBag },
  { href: "/admin/drivers",      label: "Livreurs",      icon: Truck },
  { href: "/admin/promos",       label: "Codes promo",   icon: Tag },
  { href: "/admin/users",        label: "Utilisateurs",  icon: Users },
]

const BOTTOM_ITEMS = [
  { href: "/admin/settings", label: "Paramètres", icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, logout, isLoading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => { setSidebarOpen(false) }, [pathname])

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [sidebarOpen])

  // Current page label for mobile top bar
  const currentPage = [...NAV_ITEMS, ...BOTTOM_ITEMS].find(
    (item) => item.href === pathname || (item.href !== "/admin" && pathname.startsWith(item.href))
  )

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
        <h1 className="text-2xl font-bold">Accès refusé</h1>
        <p className="text-sm text-muted-foreground">Vous devez être administrateur pour accéder à cette page.</p>
        <Link
          href="/authentification"
          className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background"
        >
          Se connecter
        </Link>
      </div>
    )
  }

  const initials = (user.email || "A")[0].toUpperCase()

  return (
    <div className="flex min-h-dvh bg-background">

      {/* ── Mobile top bar ── */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b bg-background/80 backdrop-blur-md px-4 py-3 md:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors"
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <span className="text-sm font-semibold">
          {currentPage?.label ?? "Admin"}
        </span>
        {/* Avatar placeholder to keep title centered */}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold">
          {initials}
        </div>
      </div>

      {/* ── Backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 flex h-dvh w-64 flex-col border-r bg-background transition-transform duration-250 ease-in-out",
          "pt-14 md:pt-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "md:sticky md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b hidden md:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background text-xs font-black">
            B
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight leading-none">e-SNACK</p>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase mt-0.5">Admin</p>
          </div>
        </div>

        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon size={17} className={cn("shrink-0 transition-transform group-hover:scale-110", isActive && "group-hover:scale-100")} />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight size={14} className="opacity-50" />}
              </Link>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t px-3 pt-3 pb-4 space-y-0.5">
          {BOTTOM_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon size={17} className="shrink-0" />
                {item.label}
              </Link>
            )
          })}

          {/* Back to account */}
          <Link
            href="/account"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink size={17} className="shrink-0" />
            Mon compte
          </Link>

          {/* User card */}
          <div className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted transition-colors cursor-default">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate leading-none">{user.name || user.email}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Administrateur</p>
            </div>
            <button
              onClick={logout}
              title="Déconnexion"
              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 overflow-auto pt-14 md:pt-0">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  )
}
