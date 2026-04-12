"use client"

import Image from "next/image"
import { Plus } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import type { Formula } from "@/lib/restaurant-types"
import { useAppStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"

interface FormulaCardProps {
  formula: Formula
  restaurantSlug: string
  categoryName?: string
  onCustomize: (formula: Formula, categoryName?: string) => void
  accentColor?: string
  textColor?: string
  mutedColor?: string
}

export function FormulaCard({ formula, restaurantSlug, categoryName, onCustomize, accentColor, textColor, mutedColor }: FormulaCardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAppStore(useShallow((s) => ({ user: s.user }))).user

  const handleAdd = () => {
    if (!user) {
      router.push(`/authentification?redirect=${encodeURIComponent(pathname)}`)
      return
    }
    onCustomize(formula, categoryName)
  }

  const productNames = formula.products.map((fp) => fp.product?.name || "").filter(Boolean)

  return (
    <div className="flex gap-4 py-4 border-b last:border-b-0">
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={accentColor
                ? { backgroundColor: accentColor + "20", color: accentColor }
                : { backgroundColor: "var(--foreground)", color: "var(--background)", opacity: 0.8 }
              }
            >
              Formule
            </span>
          </div>
          <h3 className="font-semibold text-sm" style={textColor ? { color: textColor } : undefined}>
            {formula.name}
          </h3>
          {formula.description && (
            <p className="mt-0.5 text-xs line-clamp-1" style={{ color: mutedColor || "var(--muted-foreground)" }}>
              {formula.description}
            </p>
          )}
          <p className="mt-0.5 text-[11px] line-clamp-1" style={{ color: mutedColor || "var(--muted-foreground)" }}>
            {productNames.join(" + ")}
          </p>
        </div>
        <p className="mt-2 text-sm font-semibold" style={textColor ? { color: textColor } : undefined}>
          {formula.basePrice.toFixed(2)} €
        </p>
      </div>
      <div className="relative h-24 w-24 flex-shrink-0">
        <Image
          src={formula.imageUrl || "/placeholder-product.svg"}
          alt={formula.name}
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
