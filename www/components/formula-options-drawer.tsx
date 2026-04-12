"use client"

import { useState, useMemo, useCallback } from "react"
import { Drawer } from "vaul"
import Image from "next/image"
import { Minus, Plus, X, Check } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAppStore, type SelectedOption, type FormulaProductSelection } from "@/lib/store"
import type { Formula, FormulaProductEntry, ProductOption } from "@/lib/restaurant-types"

interface Props {
  formula: Formula | null
  restaurantSlug: string
  categoryName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// A fixed product that's always included
interface FixedItem {
  type: "fixed"
  entry: FormulaProductEntry
}

// A choice group where user picks one product
interface ChoiceGroup {
  type: "choice"
  label: string
  entries: FormulaProductEntry[]
}

type FormulaSection = FixedItem | ChoiceGroup

export function FormulaOptionsDrawer({ formula, restaurantSlug, categoryName, open, onOpenChange }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAppStore((s) => s.user)
  const addToCart = useAppStore((s) => s.addToCart)

  const [quantity, setQuantity] = useState(1)
  // Which product is selected per choice group: { [groupLabel]: productId }
  const [choiceSelections, setChoiceSelections] = useState<Record<string, string>>({})
  // Per-product option selections: { [productId]: { [optionId]: choiceId[] } }
  const [optionSelections, setOptionSelections] = useState<Record<string, Record<string, string[]>>>({})

  // Parse formula products into sections
  const sections = useMemo<FormulaSection[]>(() => {
    if (!formula) return []
    const result: FormulaSection[] = []
    const groupMap = new Map<string, FormulaProductEntry[]>()
    const groupOrder: string[] = []

    for (const fp of formula.products) {
      if (fp.groupLabel) {
        if (!groupMap.has(fp.groupLabel)) {
          groupMap.set(fp.groupLabel, [])
          groupOrder.push(fp.groupLabel)
        }
        groupMap.get(fp.groupLabel)!.push(fp)
      } else {
        result.push({ type: "fixed", entry: fp })
      }
    }
    for (const label of groupOrder) {
      result.push({ type: "choice", label, entries: groupMap.get(label)! })
    }
    return result
  }, [formula])

  // Auto-select first product in each choice group on open
  const handleOpenChange = useCallback((v: boolean) => {
    if (v && formula) {
      setQuantity(1)
      setOptionSelections({})
      // Auto-select first product in each choice group
      const defaults: Record<string, string> = {}
      const groupMap = new Map<string, FormulaProductEntry[]>()
      for (const fp of formula.products) {
        if (fp.groupLabel) {
          if (!groupMap.has(fp.groupLabel)) groupMap.set(fp.groupLabel, [])
          groupMap.get(fp.groupLabel)!.push(fp)
        }
      }
      for (const [label, entries] of groupMap) {
        if (entries.length > 0) defaults[label] = entries[0].productId
      }
      setChoiceSelections(defaults)
    }
    onOpenChange(v)
  }, [formula, onOpenChange])

  // Active products = all fixed + one per choice group
  const activeProducts = useMemo(() => {
    const active: FormulaProductEntry[] = []
    for (const section of sections) {
      if (section.type === "fixed") {
        active.push(section.entry)
      } else {
        const selectedId = choiceSelections[section.label]
        const entry = section.entries.find((e) => e.productId === selectedId)
        if (entry) active.push(entry)
      }
    }
    return active
  }, [sections, choiceSelections])

  const toggleOption = (productId: string, option: ProductOption, choiceId: string) => {
    setOptionSelections((prev) => {
      const productSels = { ...(prev[productId] ?? {}) }
      const current = productSels[option.id] || []
      if (option.type === "single") {
        productSels[option.id] = [choiceId]
      } else {
        productSels[option.id] = current.includes(choiceId)
          ? current.filter((id) => id !== choiceId)
          : [...current, choiceId]
      }
      return { ...prev, [productId]: productSels }
    })
  }

  // Check if all required options are filled for active products
  const missingRequired = useMemo(() => {
    for (const fp of activeProducts) {
      const opts = fp.product?.options ?? []
      const productSels = optionSelections[fp.productId] ?? {}
      for (const opt of opts) {
        if (opt.isRequired && !(productSels[opt.id]?.length)) {
          return true
        }
      }
    }
    return false
  }, [activeProducts, optionSelections])

  // Check if all choice groups have a selection
  const missingChoices = useMemo(() => {
    for (const section of sections) {
      if (section.type === "choice" && !choiceSelections[section.label]) {
        return true
      }
    }
    return false
  }, [sections, choiceSelections])

  // Compute total price
  const totalModifiers = useMemo(() => {
    let modifiers = 0
    for (const fp of activeProducts) {
      const productSels = optionSelections[fp.productId] ?? {}
      const opts = fp.product?.options ?? []
      for (const opt of opts) {
        for (const choiceId of productSels[opt.id] ?? []) {
          const choice = opt.choices.find((c) => c.id === choiceId)
          if (choice) modifiers += choice.priceModifier
        }
      }
    }
    return modifiers
  }, [activeProducts, optionSelections])

  const unitPrice = (formula?.basePrice ?? 0) + totalModifiers
  const totalPrice = unitPrice * quantity

  // Build cart data
  const buildFormulaProducts = (): FormulaProductSelection[] => {
    return activeProducts.map((fp) => {
      const productSels = optionSelections[fp.productId] ?? {}
      const opts = fp.product?.options ?? []
      const selectedOpts: SelectedOption[] = []
      for (const opt of opts) {
        for (const choiceId of productSels[opt.id] ?? []) {
          const choice = opt.choices.find((c) => c.id === choiceId)
          if (choice) {
            selectedOpts.push({
              optionId: opt.id,
              optionName: opt.name,
              choiceId: choice.id,
              choiceName: choice.name,
              priceModifier: choice.priceModifier,
            })
          }
        }
      }
      return {
        productId: fp.productId,
        productName: fp.product?.name ?? "",
        options: selectedOpts,
      }
    })
  }

  const handleAdd = () => {
    if (!formula) return
    if (!user) {
      onOpenChange(false)
      router.push(`/authentification?redirect=${encodeURIComponent(pathname)}`)
      return
    }

    const formulaProds = buildFormulaProducts()
    const optionKey = [
      ...Object.entries(choiceSelections).map(([g, pid]) => `${g}:${pid}`),
      ...formulaProds.flatMap((fp) => fp.options.map((o) => o.choiceId)),
    ].sort().join("-")
    const cartId = `formula-${formula.id}${optionKey ? `-${optionKey}` : ""}`

    for (let i = 0; i < quantity; i++) {
      addToCart({
        id: cartId,
        productId: formula.id,
        name: formula.name,
        price: unitPrice,
        image: formula.imageUrl || "/placeholder-product.svg",
        restaurantSlug,
        categoryName,
        isFormula: true,
        formulaId: formula.id,
        formulaProducts: formulaProds,
      })
    }

    onOpenChange(false)
  }

  if (!formula) return null

  const canAdd = !missingRequired && !missingChoices

  return (
    <Drawer.Root direction="bottom" open={open} onOpenChange={handleOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg rounded-t-3xl bg-background flex flex-col max-h-[85vh]">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="h-1.5 w-12 rounded-full bg-muted" />
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-3 shrink-0">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-bold uppercase">Formule</span>
                <Drawer.Title className="font-bold">{formula.name}</Drawer.Title>
              </div>
              {formula.description && (
                <p className="text-xs text-muted-foreground">{formula.description}</p>
              )}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            {/* Formula image */}
            {formula.imageUrl && (
              <div className="relative h-32 overflow-hidden rounded-xl mb-4">
                <Image
                  src={formula.imageUrl}
                  alt={formula.name}
                  fill
                  className="object-cover"
                  sizes="400px"
                />
              </div>
            )}

            {sections.map((section, sectionIdx) => {
              if (section.type === "fixed") {
                const fp = section.entry
                const product = fp.product
                if (!product) return null
                const opts = product.options ?? []
                const productSels = optionSelections[fp.productId] ?? {}

                return (
                  <div key={`fixed-${fp.productId}`} className="mb-4">
                    {/* Fixed product header */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background shrink-0">
                        <Check size={12} />
                      </div>
                      <span className="text-sm font-medium">{product.name}</span>
                    </div>

                    {/* Options for this fixed product */}
                    {opts.length > 0 && (
                      <div className="ml-7 space-y-3">
                        {opts.map((option) => (
                          <OptionGroup
                            key={option.id}
                            option={option}
                            selected={productSels[option.id] || []}
                            onToggle={(choiceId) => toggleOption(fp.productId, option, choiceId)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              }

              // Choice group
              const selectedProductId = choiceSelections[section.label]
              const selectedEntry = section.entries.find((e) => e.productId === selectedProductId)
              const selectedProduct = selectedEntry?.product
              const selectedOpts = selectedProduct?.options ?? []
              const selectedProductSels = selectedEntry ? (optionSelections[selectedEntry.productId] ?? {}) : {}

              return (
                <div key={`choice-${section.label}`} className="mb-4">
                  {/* Section divider with label */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-foreground/10" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{section.label}</span>
                    <div className="h-px flex-1 bg-foreground/10" />
                  </div>

                  {/* Radio options */}
                  <div className="space-y-1.5">
                    {section.entries.map((entry) => {
                      const isSelected = entry.productId === selectedProductId
                      return (
                        <button
                          key={entry.productId}
                          onClick={() => {
                            setChoiceSelections((prev) => ({ ...prev, [section.label]: entry.productId }))
                            // Clear option selections for the previously selected product in this group
                            if (selectedEntry && selectedEntry.productId !== entry.productId) {
                              setOptionSelections((prev) => {
                                const next = { ...prev }
                                delete next[selectedEntry.productId]
                                return next
                              })
                            }
                          }}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                            isSelected ? "border-foreground bg-foreground/5" : "hover:border-foreground/20"
                          )}
                        >
                          <div className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors shrink-0",
                            isSelected ? "border-foreground bg-foreground" : "border-muted-foreground/30"
                          )}>
                            {isSelected && <div className="h-2 w-2 rounded-full bg-background" />}
                          </div>
                          <span className="flex-1 text-left">{entry.product?.name ?? "?"}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Options for the selected product in this choice group */}
                  {selectedProduct && selectedOpts.length > 0 && (
                    <div className="mt-3 ml-2 space-y-3">
                      {selectedOpts.map((option) => (
                        <OptionGroup
                          key={option.id}
                          option={option}
                          selected={selectedProductSels[option.id] || []}
                          onToggle={(choiceId) => toggleOption(selectedEntry!.productId, option, choiceId)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Price breakdown */}
            {totalModifiers > 0 && (
              <div className="rounded-xl bg-foreground/[0.03] px-4 py-3 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prix de base</span>
                  <span>{formula.basePrice.toFixed(2)} &euro;</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Suppl&eacute;ments</span>
                  <span>+{totalModifiers.toFixed(2)} &euro;</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div className="border-t px-6 py-4 flex items-center gap-4 shrink-0">
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
              disabled={!canAdd}
              className="flex-1 rounded-full bg-foreground py-3.5 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              Ajouter &middot; {totalPrice.toFixed(2)} &euro;
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

// ─── Option Group (reusable for both fixed products and selected choice products) ───

function OptionGroup({
  option,
  selected,
  onToggle,
}: {
  option: ProductOption
  selected: string[]
  onToggle: (choiceId: string) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground">{option.name}</h4>
        {option.isRequired && (
          <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium">Requis</span>
        )}
        <span className="text-[10px] text-muted-foreground">
          {option.type === "single" ? "1 choix" : "Plusieurs choix"}
        </span>
      </div>
      <div className="space-y-1">
        {option.choices.map((choice) => {
          const isSelected = selected.includes(choice.id)
          return (
            <button
              key={choice.id}
              onClick={() => onToggle(choice.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
                isSelected ? "border-foreground bg-foreground/5" : "hover:border-foreground/20"
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "flex h-4 w-4 items-center justify-center border-2 transition-colors",
                  option.type === "single" ? "rounded-full" : "rounded",
                  isSelected ? "border-foreground bg-foreground" : "border-muted-foreground/30"
                )}>
                  {isSelected && (
                    <div className={cn("h-1.5 w-1.5 bg-background", option.type === "single" ? "rounded-full" : "rounded-sm")} />
                  )}
                </div>
                <span className="text-xs">{choice.name}</span>
              </div>
              {choice.priceModifier !== 0 && (
                <span className="text-xs text-muted-foreground">
                  {choice.priceModifier > 0 ? "+" : ""}{choice.priceModifier.toFixed(2)} &euro;
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
