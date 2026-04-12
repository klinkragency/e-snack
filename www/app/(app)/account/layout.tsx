"use client"

import { useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { User, MapPin, ShoppingBag, Lock, LogOut, Settings, Truck, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isNavigatingToLogout = useRef(false)
  const { user, isLoading } = useAuth()

  const navItems = useMemo(() => {
    const items = [
      { href: "/account", label: "Profil", icon: User },
      { href: "/account/addresses", label: "Adresses", icon: MapPin },
      { href: "/account/orders", label: "Commandes", icon: ShoppingBag },
      { href: "/account/security", label: "Sécurité", icon: Lock },
    ]
    if (user?.role === "livreur") {
      items.push({ href: "/livreur", label: "Espace Livreur", icon: Truck })
    }
    if (user?.role === "admin") {
      items.push({ href: "/admin", label: "Administration", icon: Settings })
    }
    return items
  }, [user?.role])

  useEffect(() => {
    // Only redirect on session expiry, never during manual logout
    if (!isLoading && !user && !isNavigatingToLogout.current) {
      window.location.replace("/authentification?redirect=" + encodeURIComponent(pathname))
    }
  }, [isLoading, user, pathname])

  const handleLogout = () => {
    // Set flag BEFORE any state changes to prevent useEffect from racing
    isNavigatingToLogout.current = true
    // Navigate directly — DO NOT call reset() here.
    // reset() would set user=null → useEffect fires → double navigation → blank pages + logout GET never completes
    window.location.href = "/api/auth/logout"
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <h1 className="mb-4 text-xl font-bold tracking-tight md:mb-6 md:text-2xl">Mon compte</h1>

      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        {/* Sidebar (desktop) / Grid cards (mobile) */}
        <nav className="shrink-0 md:w-56">
          {/* Mobile: horizontal scrollable pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 md:hidden [&::-webkit-scrollbar]:hidden">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all",
                  pathname === href
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 transition-colors hover:bg-red-100"
            >
              <LogOut size={15} />
              Déconnexion
            </button>
          </div>

          {/* Desktop: vertical sidebar */}
          <div className="hidden space-y-1 md:block">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                  pathname === href
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}

            <div className="my-3 border-t" />

            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut size={16} />
              Déconnexion
            </button>
          </div>
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
