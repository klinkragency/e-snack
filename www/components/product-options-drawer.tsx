"use client"

import { useState, useMemo } from "react"
import { Drawer } from "vaul"
import Image from "next/image"
import { Minus, Plus, X } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAppStore, type SelectedOption } from "@/lib/store"
import type { Product, ProductOption } from "@/lib/restaurant-types"

interface Props {
  product: Product | null
  restaurantSlug: string
  categoryName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProductOptionsDrawer({ product, restaurantSlug, categoryName, open, onOpenChange }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAppStore((s) => s.user)
  const addToCart = useAppStore((s) => s.addToCart)
  const [selections, setSelections] = useState<Record<string, string[]>>({})
  const [quantity, setQuantity] = useState(1)

  // Reset on open
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setSelections({})
      setQuantity(1)
    }
    onOpenChange(v)
  }

  const options = product?.options ?? []

  const selectedOptions: SelectedOption[] = useMemo(() => {
    const result: SelectedOption[] = []
    for (const opt of options) {
      const choiceIds = selections[opt.id] || []
      for (const choiceId of choiceIds) {
        const choice = opt.choices.find((c) => c.id === choiceId)
        if (choice) {
          result.push({
            optionId: opt.id,
            optionName: opt.name,
            choiceId: choice.id,
            choiceName: choice.name,
            priceModifier: choice.priceModifier,
          })
        }
      }
    }
    return result
  }, [options, selections])

  const optionsExtra = selectedOptions.reduce((sum, o) => sum + o.priceModifier, 0)
  const unitPrice = (product?.price ?? 0) + optionsExtra
  const totalPrice = unitPrice * quantity

  const toggleChoice = (option: ProductOption, choiceId: string) => {
    setSelections((prev) => {
      const current = prev[option.id] || []
      if (option.type === "single") {
        return { ...prev, [option.id]: [choiceId] }
      }
      // multiple
      if (current.includes(choiceId)) {
        return { ...prev, [option.id]: current.filter((id) => id !== choiceId) }
      }
      // Enforce max selections
      if (option.maxSelections > 0 && current.length >= option.maxSelections) {
        return prev
      }
      return { ...prev, [option.id]: [...current, choiceId] }
    })
  }

  const missingRequired = options.filter((o) => o.isRequired && !(selections[o.id]?.length))

  const handleAdd = () => {
    if (!product || missingRequired.length > 0) return

    // Check if user is authenticated
    if (!user) {
      onOpenChange(false) // Close drawer first
      router.push(`/authentification?redirect=${encodeURIComponent(pathname)}`)
      return
    }

    // Create unique cart key based on product + selected options
    const optionKey = selectedOptions.map((o) => o.choiceId).sort().join("-")
    const cartId = optionKey ? `${product.id}-${optionKey}` : product.id

    addToCart({
      id: cartId,
      productId: product.id,
      name: product.name,
      price: unitPrice,
      image: product.imageUrl || "/placeholder-product.svg",
      restaurantSlug,
      categoryName,
      options: selectedOptions.length > 0 ? selectedOptions : undefined,
    })

    // Add extra quantities
    for (let i = 1; i < quantity; i++) {
      addToCart({
        id: cartId,
        productId: product.id,
        name: product.name,
        price: unitPrice,
        image: product.imageUrl || "/placeholder-product.svg",
        restaurantSlug,
        categoryName,
        options: selectedOptions.length > 0 ? selectedOptions : undefined,
      })
    }

    onOpenChange(false)
  }

  if (!product) return null

  return (
    <Drawer.Root direction="bottom" open={open} onOpenChange={handleOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg rounded-t-3xl bg-background">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1.5 w-12 rounded-full bg-muted" />
          </div>

          <div className="max-h-[80vh] overflow-y-auto">
            {/* Product header */}
            <div className="flex gap-4 px-6 py-4">
              {product.imageUrl && (
                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={product.imageUrl || "/placeholder-product.svg"}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
              )}
              <div className="flex-1">
                <Drawer.Title className="font-bold">{product.name}</Drawer.Title>
                <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
                <p className="mt-2 font-semibold">{product.price.toFixed(2)} €</p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors self-start"
              >
                <X size={18} />
              </button>
            </div>

            {/* Options */}
            {options.length > 0 && (
              <div className="space-y-6 px-6 pb-4">
                {options.map((option) => {
                  const selected = selections[option.id] || []
                  return (
                    <div key={option.id}>
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="font-semibold text-sm">{option.name}</h3>
                        {option.isRequired && (
                          <span className="rounded bg-foreground/10 px-2 py-0.5 text-[10px] font-medium">
                            Requis
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {option.type === "single"
                            ? "1 choix"
                            : option.maxSelections > 0
                              ? `${selected.length}/${option.maxSelections}`
                              : "Plusieurs choix"}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {option.choices.map((choice) => {
                          const isSelected = selected.includes(choice.id)
                          const atMax = option.type === "multiple" && option.maxSelections > 0 && selected.length >= option.maxSelections && !isSelected
                          return (
                            <button
                              key={choice.id}
                              onClick={() => toggleChoice(option, choice.id)}
                              disabled={atMax}
                              className={cn(
                                "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors",
                                isSelected ? "border-foreground bg-foreground/5" : "hover:border-foreground/20",
                                atMax && "opacity-40 cursor-not-allowed"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "flex h-5 w-5 items-center justify-center border-2 transition-colors",
                                    option.type === "single" ? "rounded-full" : "rounded-md",
                                    isSelected ? "border-foreground bg-foreground" : "border-muted-foreground/30"
                                  )}
                                >
                                  {isSelected && (
                                    <div className={cn("h-2 w-2 bg-background", option.type === "single" ? "rounded-full" : "rounded-sm")} />
                                  )}
                                </div>
                                <span>{choice.name}</span>
                              </div>
                              {choice.priceModifier !== 0 && (
                                <span className="text-muted-foreground">
                                  {choice.priceModifier > 0 ? "+" : ""}{choice.priceModifier.toFixed(2)} €
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Options summary */}
            {selectedOptions.length > 0 && (
              <div className="mx-6 mb-4 rounded-xl bg-foreground/[0.03] px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">Personnalisation</p>
                <p className="text-sm">
                  {selectedOptions.map((o) => o.choiceName).join(", ")}
                  {optionsExtra > 0 && (
                    <span className="text-muted-foreground"> (+{optionsExtra.toFixed(2)} €)</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Bottom bar: quantity + add */}
          <div className="border-t px-6 py-4 flex items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full border hover:bg-muted transition-colors"
              >
                <Minus size={16} />
              </button>
              <span className="w-6 text-center font-semibold">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-full border hover:bg-muted transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            <button
              onClick={handleAdd}
              disabled={missingRequired.length > 0}
              className="flex-1 rounded-full bg-foreground py-3.5 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              Ajouter · {totalPrice.toFixed(2)} €
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
