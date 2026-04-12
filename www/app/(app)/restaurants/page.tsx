"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { RestaurantCard } from "@/components/restaurant-card"
import { listRestaurants } from "@/lib/restaurant-client"
import type { Restaurant } from "@/lib/restaurant-types"

export default function RestaurantsPage() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [showOpen, setShowOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState("")
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Debounce search input (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    listRestaurants()
      .then(setRestaurants)
      .catch(() => setError("Impossible de charger les restaurants"))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => {
    const cats = new Set<string>()
    restaurants.forEach((r) => { if (r.category) cats.add(r.category) })
    return Array.from(cats).sort()
  }, [restaurants])

  const filtered = useMemo(() => {
    let result = restaurants.filter((r) => {
      if (showOpen && !r.isOpen) return false
      if (activeCategory && r.category !== activeCategory) return false
      if (
        debouncedSearch &&
        !r.name.toLowerCase().includes(debouncedSearch.toLowerCase()) &&
        !(r.category ?? "").toLowerCase().includes(debouncedSearch.toLowerCase())
      )
        return false
      return true
    })
    return result
  }, [restaurants, showOpen, activeCategory, debouncedSearch])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <h1 className="text-xl font-bold tracking-tight md:text-2xl">Restaurants</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {loading ? "Chargement..." : `${restaurants.length} restaurants à proximité`}
      </p>

      {/* Search + Filter */}
      <div className="mt-4 flex items-center gap-2 md:mt-6 md:gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground md:left-4" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full rounded-full border bg-background py-2.5 pl-9 pr-3 text-sm outline-none transition-all focus:ring-2 focus:ring-foreground/20 md:pl-10 md:pr-4"
          />
        </div>
        <button
          onClick={() => setShowOpen(!showOpen)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-2.5 text-sm font-medium transition-colors md:px-4",
            showOpen ? "bg-foreground text-background" : "hover:bg-muted"
          )}
        >
          Ouvert
        </button>
      </div>

      {/* Category tags */}
      {categories.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveCategory("")}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              !activeCategory ? "bg-foreground text-background" : "border hover:bg-muted"
            )}
          >
            Tous
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? "" : cat)}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                activeCategory === cat ? "bg-foreground text-background" : "border hover:bg-muted"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-16 flex justify-center">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-12 text-center">
          <p className="text-sm text-red-500">{error}</p>
          <button
            onClick={() => {
              setError(null)
              setLoading(true)
              listRestaurants()
                .then(setRestaurants)
                .catch(() => setError("Impossible de charger les restaurants"))
                .finally(() => setLoading(false))
            }}
            className="mt-3 text-sm font-medium underline"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Grid */}
      {!loading && !error && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:mt-8 md:gap-6">
          {filtered.map((r) => (
            <RestaurantCard key={r.id} restaurant={r} />
          ))}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p className="mt-12 text-center text-sm text-muted-foreground">Aucun restaurant trouvé</p>
      )}
    </div>
  )
}
