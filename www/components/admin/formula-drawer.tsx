"use client"

import { useEffect, useState, useRef } from "react"
import { Drawer } from "vaul"
import { X, Loader2, Plus, Trash2, ChevronDown, Package, ListChecks } from "lucide-react"
import { toast } from "sonner"
import { createFormula, updateFormula } from "@/lib/admin-client"
import type { FormulaProductInput } from "@/lib/admin-client"
import { ImageUpload } from "@/components/image-upload"
import type { Formula, Product, Category } from "@/lib/restaurant-types"
import { cn } from "@/lib/utils"

// ─── Types ───

type FormulaSlot =
  | { type: "fixed"; product: Product }
  | { type: "choice"; label: string; products: Product[] }

interface Props {
  formula: Formula | null
  categoryId: string
  categories: Category[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function FormulaDrawer({ formula, categoryId, categories, open, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [basePrice, setBasePrice] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [slots, setSlots] = useState<FormulaSlot[]>([])
  const [saving, setSaving] = useState(false)

  // Product picker
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMode, setPickerMode] = useState<"fixed" | "choice">("fixed")
  const [pickerGroupIndex, setPickerGroupIndex] = useState<number | null>(null) // for adding to existing group

  const allProducts = categories.flatMap((c) => c.products)
  const productMap = new Map(allProducts.map((p) => [p.id, p]))

  useEffect(() => {
    if (open) {
      if (formula) {
        setName(formula.name)
        setDescription(formula.description || "")
        setBasePrice(formula.basePrice.toString())
        setImageUrl(formula.imageUrl || "")
        // Rebuild slots from formula products
        const newSlots: FormulaSlot[] = []
        const groupMap = new Map<string, Product[]>()
        const groupOrder: string[] = []
        for (const fp of formula.products) {
          const product = fp.product || productMap.get(fp.productId)
          if (!product) continue
          if (fp.groupLabel) {
            if (!groupMap.has(fp.groupLabel)) {
              groupMap.set(fp.groupLabel, [])
              groupOrder.push(fp.groupLabel)
            }
            groupMap.get(fp.groupLabel)!.push(product)
          } else {
            newSlots.push({ type: "fixed", product })
          }
        }
        for (const label of groupOrder) {
          newSlots.push({ type: "choice", label, products: groupMap.get(label)! })
        }
        setSlots(newSlots)
      } else {
        setName("")
        setDescription("")
        setBasePrice("")
        setImageUrl("")
        setSlots([])
      }
      setPickerOpen(false)
    }
  }, [formula, open])

  // ─── Slot management ───

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index))
  }

  const removeProductFromGroup = (slotIndex: number, productId: string) => {
    setSlots((prev) =>
      prev.map((slot, i) => {
        if (i !== slotIndex || slot.type !== "choice") return slot
        const filtered = slot.products.filter((p) => p.id !== productId)
        return { ...slot, products: filtered }
      }).filter((slot) => slot.type !== "choice" || slot.products.length > 0)
    )
  }

  const updateGroupLabel = (index: number, label: string) => {
    setSlots((prev) =>
      prev.map((slot, i) => (i === index && slot.type === "choice" ? { ...slot, label } : slot))
    )
  }

  // ─── Picker actions ───

  const openPickerForFixed = () => {
    setPickerMode("fixed")
    setPickerGroupIndex(null)
    setPickerOpen(true)
  }

  const openPickerForNewGroup = () => {
    // Create a new empty choice group, then open picker for it
    setSlots((prev) => [...prev, { type: "choice", label: "", products: [] }])
    setPickerMode("choice")
    setPickerGroupIndex(slots.length) // index of the newly added slot
    setPickerOpen(true)
  }

  const openPickerForExistingGroup = (index: number) => {
    setPickerMode("choice")
    setPickerGroupIndex(index)
    setPickerOpen(true)
  }

  const handlePickProduct = (product: Product) => {
    if (pickerMode === "fixed") {
      setSlots((prev) => [...prev, { type: "fixed", product }])
      setPickerOpen(false)
    } else if (pickerGroupIndex !== null) {
      setSlots((prev) =>
        prev.map((slot, i) => {
          if (i !== pickerGroupIndex || slot.type !== "choice") return slot
          // Don't add duplicates
          if (slot.products.some((p) => p.id === product.id)) return slot
          return { ...slot, products: [...slot.products, product] }
        })
      )
      // Keep picker open to add more products
    }
  }

  // ─── Save ───

  const handleSave = async () => {
    if (!name.trim() || !basePrice) {
      toast.error("Nom et prix sont requis")
      return
    }
    if (slots.length === 0) {
      toast.error("Ajoutez au moins un élément à la formule")
      return
    }
    // Validate choice groups
    for (const slot of slots) {
      if (slot.type === "choice") {
        if (!slot.label.trim()) {
          toast.error("Chaque groupe de choix doit avoir un nom")
          return
        }
        if (slot.products.length < 2) {
          toast.error(`Le groupe "${slot.label}" doit avoir au moins 2 options`)
          return
        }
      }
    }

    setSaving(true)
    try {
      const products: FormulaProductInput[] = []
      for (const slot of slots) {
        if (slot.type === "fixed") {
          products.push({ productId: slot.product.id })
        } else {
          for (const p of slot.products) {
            products.push({ productId: p.id, groupLabel: slot.label })
          }
        }
      }

      if (formula) {
        await updateFormula(formula.id, { name, description, basePrice: parseFloat(basePrice), imageUrl, products })
        toast.success("Formule mise à jour")
      } else {
        await createFormula(categoryId, { name, description, basePrice: parseFloat(basePrice), imageUrl, products })
        toast.success("Formule créée")
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  // IDs already in the formula (for greying out in picker)
  const usedProductIds = new Set(
    slots.flatMap((s) => (s.type === "fixed" ? [s.product.id] : s.products.map((p) => p.id)))
  )

  return (
    <Drawer.Root direction="right" open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-background border-l flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
            <Drawer.Title className="font-bold text-lg">
              {formula ? "Modifier la formule" : "Nouvelle formule"}
            </Drawer.Title>
            <button onClick={() => onOpenChange(false)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Body wrapper — relative for overlay positioning */}
          <div className="flex-1 relative overflow-hidden">
            {/* Scrollable body */}
            <div className="h-full overflow-y-auto px-6 py-5 space-y-6">
              {/* Details */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Nom *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Menu Kebab Classic"
                      className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                      autoFocus
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Sandwich + Frites + Boisson au choix"
                      className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Prix (EUR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      placeholder="12.90"
                      className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Image</label>
                    <ImageUpload value={imageUrl} onChange={setImageUrl} category="product" className="w-full" aspectRatio="aspect-[3/2]" />
                  </div>
                </div>
              </div>

              {/* Composition */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Composition de la formule</h3>
                  <span className="text-xs text-muted-foreground">{slots.length} éléments</span>
                </div>

                {slots.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-foreground/10 py-8 text-center">
                    <p className="text-sm text-muted-foreground mb-3">Construisez votre formule</p>
                    <div className="flex items-center justify-center gap-2">
                      <button type="button" onClick={openPickerForFixed} className="inline-flex items-center gap-1.5 rounded-lg bg-foreground/5 px-3 py-2 text-xs font-medium hover:bg-foreground/10 transition-colors">
                        <Package size={14} />
                        Produit fixe
                      </button>
                      <button type="button" onClick={openPickerForNewGroup} className="inline-flex items-center gap-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 px-3 py-2 text-xs font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
                        <ListChecks size={14} />
                        Choix (ex: boisson)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {slots.map((slot, i) => (
                      <SlotCard
                        key={i}
                        slot={slot}
                        index={i}
                        onRemove={() => removeSlot(i)}
                        onRemoveProduct={(pid) => removeProductFromGroup(i, pid)}
                        onUpdateLabel={(label) => updateGroupLabel(i, label)}
                        onAddProduct={() => openPickerForExistingGroup(i)}
                      />
                    ))}

                    {/* Add more */}
                    <div className="flex items-center gap-2 pt-1">
                      <button type="button" onClick={openPickerForFixed} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-foreground/20 px-3 py-2 text-xs font-medium text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors">
                        <Plus size={12} />
                        Produit fixe
                      </button>
                      <button type="button" onClick={openPickerForNewGroup} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-purple-300 dark:border-purple-700 px-3 py-2 text-xs font-medium text-purple-600 dark:text-purple-400 hover:border-purple-500 transition-colors">
                        <Plus size={12} />
                        Groupe de choix
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Product picker overlay — slides up from bottom of the drawer body */}
            {pickerOpen && (
              <>
                <div
                  className="absolute inset-0 bg-black/20 animate-in fade-in duration-200"
                  onClick={() => {
                    setPickerOpen(false)
                    setSlots((prev) => prev.filter((s) => s.type !== "choice" || s.products.length > 0))
                  }}
                />
                <div className="absolute bottom-0 left-0 right-0 animate-in slide-in-from-bottom duration-200" style={{ maxHeight: "60%" }}>
                  <ProductPicker
                    categories={categories}
                    usedIds={pickerMode === "fixed" ? usedProductIds : new Set()}
                    onPick={handlePickProduct}
                    onClose={() => {
                      setPickerOpen(false)
                      setSlots((prev) => prev.filter((s) => s.type !== "choice" || s.products.length > 0))
                    }}
                    mode={pickerMode}
                  />
                </div>
              </>
            )}
          </div>

          {/* Bottom save bar */}
          <div className="border-t bg-background px-6 py-4 shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-full bg-foreground py-3.5 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="mx-auto animate-spin" /> : formula ? "Enregistrer" : "Créer la formule"}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

// ─── Slot Card ───

function SlotCard({
  slot,
  index,
  onRemove,
  onRemoveProduct,
  onUpdateLabel,
  onAddProduct,
}: {
  slot: FormulaSlot
  index: number
  onRemove: () => void
  onRemoveProduct: (id: string) => void
  onUpdateLabel: (label: string) => void
  onAddProduct: () => void
}) {
  if (slot.type === "fixed") {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5 group">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/5 shrink-0">
          <Package size={14} className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{slot.product.name}</p>
          <p className="text-[11px] text-muted-foreground">{slot.product.price.toFixed(2)} €</p>
        </div>
        <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-all">
          <Trash2 size={13} />
        </button>
      </div>
    )
  }

  // Choice group
  return (
    <div className="rounded-xl border border-purple-200 dark:border-purple-800/50 bg-purple-50/30 dark:bg-purple-900/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-purple-200/50 dark:border-purple-800/30">
        <ListChecks size={14} className="text-purple-500 shrink-0" />
        <input
          type="text"
          value={slot.label}
          onChange={(e) => onUpdateLabel(e.target.value)}
          placeholder="Nom du groupe (ex: Boisson au choix)"
          className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-purple-400/60 dark:placeholder:text-purple-500/40"
        />
        <span className="text-[10px] text-purple-500 font-medium shrink-0">
          1 parmi {slot.products.length}
        </span>
        <button onClick={onRemove} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-900/20 text-red-400 transition-colors shrink-0">
          <Trash2 size={12} />
        </button>
      </div>
      <div className="px-2 py-1.5 space-y-0.5">
        {slot.products.map((p) => (
          <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-purple-100/50 dark:hover:bg-purple-800/20 group/item transition-colors">
            <span className="text-sm flex-1 truncate">{p.name}</span>
            <span className="text-[11px] text-muted-foreground">{p.price.toFixed(2)} €</span>
            <button
              onClick={() => onRemoveProduct(p.id)}
              className="opacity-0 group-hover/item:opacity-100 flex h-5 w-5 items-center justify-center rounded-full text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
            >
              <X size={10} />
            </button>
          </div>
        ))}
        <button
          onClick={onAddProduct}
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-purple-500 font-medium hover:text-purple-700 dark:hover:text-purple-300 transition-colors w-full"
        >
          <Plus size={12} />
          Ajouter un choix
        </button>
      </div>
    </div>
  )
}

// ─── Product Picker (inline search/filter) ───

function ProductPicker({
  categories,
  usedIds,
  onPick,
  onClose,
  mode,
}: {
  categories: Category[]
  usedIds: Set<string>
  onPick: (product: Product) => void
  onClose: () => void
  mode: "fixed" | "choice"
}) {
  const [search, setSearch] = useState("")
  const [expandedCat, setExpandedCat] = useState<string | null>(categories[0]?.id || null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const query = search.toLowerCase()

  return (
    <div className="bg-background rounded-t-xl shadow-2xl overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-foreground/[0.02] shrink-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {mode === "fixed" ? "Ajouter un produit fixe" : "Ajouter au groupe de choix"}
        </p>
        <button onClick={onClose} className="rounded-lg bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-foreground/10 transition-colors">
          Fermer
        </button>
      </div>
      <div className="px-4 py-2 border-b shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/50"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {categories.map((cat) => {
          const filteredProducts = cat.products.filter(
            (p) => !query || p.name.toLowerCase().includes(query)
          )
          if (filteredProducts.length === 0) return null
          const isExpanded = query.length > 0 || expandedCat === cat.id

          return (
            <div key={cat.id}>
              <button
                onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-foreground/[0.03] transition-colors"
              >
                <ChevronDown size={12} className={cn("transition-transform", isExpanded ? "" : "-rotate-90")} />
                {cat.name}
                <span className="text-muted-foreground/50">({filteredProducts.length})</span>
              </button>
              {isExpanded && (
                <div className="pb-1">
                  {filteredProducts.map((product) => {
                    const used = usedIds.has(product.id)
                    return (
                      <button
                        key={product.id}
                        onClick={() => !used && onPick(product)}
                        disabled={used}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                          used
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-foreground/[0.04] cursor-pointer"
                        )}
                      >
                        <span className="text-sm flex-1 truncate">{product.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{product.price.toFixed(2)} €</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
