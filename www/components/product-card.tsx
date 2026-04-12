"use client"

import Image from "next/image"
import { Plus } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import type { Product } from "@/lib/restaurant-types"
import { useAppStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"

interface ProductCardProps {
  product: Product
  restaurantSlug: string
  categoryName?: string
  onCustomize?: (product: Product, categoryName?: string) => void
  accentColor?: string
  textColor?: string
  mutedColor?: string
}

export function ProductCard({ product, restaurantSlug, categoryName, onCustomize, accentColor, textColor, mutedColor }: ProductCardProps) {
  const router = useRouter()
  const pathname = usePathname()

  // Batched selector with shallow comparison
  const { user, addToCart } = useAppStore(
    useShallow((s) => ({
      user: s.user,
      addToCart: s.addToCart,
    }))
  )

  const hasOptions = product.options && product.options.length > 0

  const handleAdd = () => {
    // Check if user is authenticated
    if (!user) {
      router.push(`/authentification?redirect=${encodeURIComponent(pathname)}`)
      return
    }

    if (hasOptions && onCustomize) {
      onCustomize(product, categoryName)
    } else {
      addToCart({
        id: product.id,
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.imageUrl || "/placeholder-product.svg",
        restaurantSlug,
        categoryName,
      })
    }
  }

  return (
    <div className="flex gap-4 py-4 border-b last:border-b-0">
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <h3 className="font-semibold text-sm" style={textColor ? { color: textColor } : undefined}>{product.name}</h3>
          <p className="mt-1 text-xs line-clamp-2" style={{ color: mutedColor || "var(--muted-foreground)" }}>{product.description}</p>
          {hasOptions && (
            <p className="mt-1 text-[10px]" style={{ color: mutedColor || "var(--muted-foreground)" }}>Personnalisable</p>
          )}
        </div>
        <p className="mt-2 text-sm font-semibold" style={textColor ? { color: textColor } : undefined}>{product.price.toFixed(2)} €</p>
      </div>
      <div className="relative h-24 w-24 flex-shrink-0">
        <Image
          src={product.imageUrl || "/placeholder-product.svg"}
          alt={product.name}
          fill
          className="rounded-xl object-cover"
          sizes="96px"
        />
        <button
          onClick={handleAdd}
          className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95"
          style={accentColor ? { backgroundColor: accentColor, color: "#FFFFFF" } : { backgroundColor: "var(--foreground)", color: "var(--background)" }}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}
