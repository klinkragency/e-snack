"use client"

import { use, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { ArrowLeft, Clock, Star, ShoppingBag, Loader2 } from "lucide-react"
import Link from "next/link"
import { ProductCard } from "@/components/product-card"
import { FormulaCard } from "@/components/formula-card"
import { ProductOptionsDrawer } from "@/components/product-options-drawer"
import { FormulaOptionsDrawer } from "@/components/formula-options-drawer"
import { useAppStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { CartDrawer } from "@/components/cart-drawer"
import { getRestaurant, getMenu } from "@/lib/restaurant-client"
import type { Restaurant, Product, Formula, Menu } from "@/lib/restaurant-types"

export default function RestaurantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)

  // Batched selector with shallow comparison
  const { count, total } = useAppStore(
    useShallow((s) =>
      s.cart.reduce(
        (acc, item) => ({
          count: acc.count + item.quantity,
          total: acc.total + item.price * item.quantity,
        }),
        { count: 0, total: 0 }
      )
    )
  )
  const [cartOpen, setCartOpen] = useState(false)
  const [customizeProduct, setCustomizeProduct] = useState<{ product: Product; categoryName: string } | null>(null)
  const [customizeFormula, setCustomizeFormula] = useState<{ formula: Formula; categoryName: string } | null>(null)

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getRestaurant(slug), getMenu(slug)])
      .then(([r, m]) => {
        setRestaurant(r)
        setMenu(m)
        if (!r) setError("Restaurant introuvable")
      })
      .catch(() => setError("Impossible de charger le restaurant"))
      .finally(() => setLoading(false))
  }, [slug])

  const categories = useMemo(() => {
    if (!menu) return []
    return menu.categories.filter((c) => c.isActive).sort((a, b) => a.position - b.position)
  }, [menu])

  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !restaurant) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">{error || "Restaurant introuvable"}</p>
        <Link href="/restaurants" className="text-sm font-medium underline">
          Retour aux restaurants
        </Link>
      </div>
    )
  }

  const bannerImage = restaurant.bannerUrl || "/placeholder-restaurant.svg"
  const bannerPos = (() => {
    if (!restaurant.bannerPosition) return { x: 50, y: 50 }
    if (typeof restaurant.bannerPosition === "string") {
      try { return JSON.parse(restaurant.bannerPosition) } catch { return { x: 50, y: 50 } }
    }
    return restaurant.bannerPosition
  })()
  const deliveryFee = restaurant.deliveryFee ?? 0
  const deliveryTime = restaurant.deliveryTime ?? ""
  const rating = restaurant.rating ?? 0

  // Customization
  const customization = restaurant.customization
  const primaryColor = customization?.primaryColor || "#000000"
  const secondaryColor = customization?.secondaryColor || "#FFFFFF"
  const fontFamily = customization?.font || "Inter"
  const isDarkTheme = customization?.theme === "dark"

  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat)
    sectionRefs.current[cat]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const customStyles = {
    "--restaurant-primary": primaryColor,
    "--restaurant-secondary": secondaryColor,
    "--restaurant-bg": isDarkTheme ? "#121212" : "#FFFFFF",
    "--restaurant-text": isDarkTheme ? "#FFFFFF" : "#121212",
    "--restaurant-muted": isDarkTheme ? "#888888" : "#666666",
  } as React.CSSProperties

  return (
    <>
      <div
        className="mx-auto max-w-3xl"
        style={{ ...customStyles, fontFamily, backgroundColor: "var(--restaurant-bg)", color: "var(--restaurant-text)" }}
      >
        {/* Hero — image only on mobile, overlay on md+ */}
        <div className="relative aspect-[16/9] w-full md:aspect-[2/1]">
          <Image src={bannerImage} alt={restaurant.name} fill className="object-cover" style={{ objectPosition: `${bannerPos.x}% ${bannerPos.y}%` }} sizes="(max-width: 768px) 100vw, 768px" priority />
          {/* Gradient for the text overlay — md+ only */}
          <div className="absolute inset-0 hidden bg-gradient-to-t from-black/70 via-black/20 to-transparent md:block" />
          <Link
            href="/restaurants"
            aria-label="Retour"
            className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white transition-colors hover:bg-black/60 md:left-4 md:top-4"
          >
            <ArrowLeft size={18} />
          </Link>
          {/* Overlay text (desktop / tablet) */}
          <div className="absolute bottom-0 left-0 right-0 hidden p-6 text-white md:block">
            <h1 className="text-2xl font-bold">{restaurant.name}</h1>
            {restaurant.description && (
              <p className="mt-1 text-sm text-white/80">{restaurant.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/80">
              {rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star size={12} fill="currentColor" /> {rating}
                </span>
              )}
              {deliveryTime && (
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {deliveryTime}
                </span>
              )}
              <span>{deliveryFee.toFixed(2)} € livraison</span>
            </div>
          </div>
        </div>

        {/* Header block (mobile only) — clean text block below the hero */}
        <div
          className="border-b px-5 pt-4 pb-5 md:hidden"
          style={{ borderColor: isDarkTheme ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
        >
          <h1 className="text-2xl font-bold leading-tight" style={{ color: "var(--restaurant-text)" }}>
            {restaurant.name}
          </h1>
          {restaurant.description && (
            <p
              className="mt-1.5 text-sm leading-snug"
              style={{ color: "var(--restaurant-muted)" }}
            >
              {restaurant.description}
            </p>
          )}
          <div
            className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
            style={{ color: "var(--restaurant-muted)" }}
          >
            {rating > 0 && (
              <span className="flex items-center gap-1">
                <Star size={12} fill="currentColor" className="text-amber-500" /> {rating}
              </span>
            )}
            {deliveryTime && (
              <span className="flex items-center gap-1">
                <Clock size={12} /> {deliveryTime}
              </span>
            )}
            <span>{deliveryFee.toFixed(2)} € livraison</span>
          </div>
        </div>

        {/* Category Tabs */}
        <div
          className="sticky top-[57px] z-30 border-b backdrop-blur-lg overflow-x-auto"
          style={{ backgroundColor: isDarkTheme ? "rgba(18,18,18,0.8)" : "rgba(255,255,255,0.8)" }}
        >
          <div className="flex gap-1 px-4 py-2 md:px-6">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.name)}
                className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors"
                style={
                  activeCategory === cat.name
                    ? { backgroundColor: primaryColor, color: secondaryColor }
                    : { color: "var(--restaurant-text)" }
                }
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products */}
        <div className="px-4 pb-32 md:px-6">
          {categories.map((cat) => (
            <div
              key={cat.id}
              ref={(el) => { sectionRefs.current[cat.name] = el }}
              className="pt-6"
            >
              <h2 className="text-lg font-bold" style={{ color: "var(--restaurant-text)" }}>{cat.name}</h2>
              <div>
                {/* Formulas first */}
                {cat.formulas?.filter((f) => f.isAvailable).map((formula) => (
                  <FormulaCard
                    key={formula.id}
                    formula={formula}
                    restaurantSlug={restaurant.slug}
                    categoryName={cat.name}
                    onCustomize={(f, catName) => setCustomizeFormula({ formula: f, categoryName: catName || cat.name })}
                    accentColor={primaryColor}
                    textColor={isDarkTheme ? "#FFFFFF" : "#121212"}
                    mutedColor={isDarkTheme ? "#888888" : "#666666"}
                  />
                ))}
                {/* Products */}
                {cat.products
                  .filter((p) => p.isAvailable)
                  .map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      restaurantSlug={restaurant.slug}
                      categoryName={cat.name}
                      onCustomize={(p, catName) => setCustomizeProduct({ product: p, categoryName: catName || cat.name })}
                      accentColor={primaryColor}
                      textColor={isDarkTheme ? "#FFFFFF" : "#121212"}
                      mutedColor={isDarkTheme ? "#888888" : "#666666"}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sticky Cart Bar */}
        {count > 0 && (
          <div
            className="fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-lg"
            style={{ backgroundColor: isDarkTheme ? "rgba(18,18,18,0.8)" : "rgba(255,255,255,0.8)" }}
          >
            <div className="mx-auto max-w-3xl px-6 py-3">
              <button
                onClick={() => setCartOpen(true)}
                className="flex w-full items-center justify-between rounded-full px-6 py-3.5 text-sm font-semibold transition-transform hover:scale-[1.01] active:scale-[0.99]"
                style={{ backgroundColor: primaryColor, color: secondaryColor }}
              >
                <span className="flex items-center gap-2">
                  <ShoppingBag size={16} />
                  Voir le panier ({count})
                </span>
                <span>{total.toFixed(2)} €</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <ProductOptionsDrawer
        product={customizeProduct?.product ?? null}
        restaurantSlug={slug}
        categoryName={customizeProduct?.categoryName}
        open={!!customizeProduct}
        onOpenChange={(v) => { if (!v) setCustomizeProduct(null) }}
      />
      <FormulaOptionsDrawer
        formula={customizeFormula?.formula ?? null}
        restaurantSlug={slug}
        categoryName={customizeFormula?.categoryName}
        open={!!customizeFormula}
        onOpenChange={(v) => { if (!v) setCustomizeFormula(null) }}
      />
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </>
  )
}
