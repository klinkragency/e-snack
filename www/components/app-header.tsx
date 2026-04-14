"use client"

import { MapPin, ShoppingBag, UserCircle, Home } from "lucide-react"
import Link from "next/link"
import { useAppStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { useState } from "react"
import { CartDrawer } from "./cart-drawer"

export function AppHeader() {
  // Batched selector — include cart array so shallow comparison detects cart changes
  const { hydrated, address, cart } = useAppStore(
    useShallow((s) => ({
      hydrated: s._hydrated,
      address: s.address,
      cart: s.cart,
    }))
  )
  const count = hydrated ? cart.reduce((sum, i) => sum + i.quantity, 0) : 0
  const [cartOpen, setCartOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto max-w-5xl px-4 py-3 md:px-6">
          {/* Main row: logo + address (sm+) + icons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
                title="Accueil"
              >
                <Home size={18} />
              </Link>
              <Link href="/restaurants" className="text-lg font-bold tracking-tight">
                e-SNACK
              </Link>
            </div>

            {/* Address pill — inline on sm+, hidden on mobile (shown below) */}
            {hydrated && address && (
              <Link
                href="/onboarding"
                className="hidden sm:flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium max-w-[200px]"
              >
                <MapPin size={12} className="flex-shrink-0" />
                <span className="truncate">{address}</span>
              </Link>
            )}

            <div className="flex items-center gap-1">
              <Link
                href="/account"
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
              >
                <UserCircle size={20} />
              </Link>
              <button
                onClick={() => setCartOpen(true)}
                className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
              >
                <ShoppingBag size={20} />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
                    {count}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Address pill — second row on mobile only */}
          {hydrated && address && (
            <Link
              href="/onboarding"
              className="mt-2 flex sm:hidden items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium w-fit max-w-full"
            >
              <MapPin size={12} className="flex-shrink-0" />
              <span className="truncate">{address}</span>
            </Link>
          )}
        </div>
      </header>

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </>
  )
}
