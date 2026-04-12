"use client"

import { useEffect, useMemo, useState } from "react"
import { Drawer } from "vaul"
import { X, Loader2, GripVertical, Save } from "lucide-react"
import { toast } from "sonner"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { Category, Product, Formula } from "@/lib/restaurant-types"
import { updateCategory, updateProduct, updateFormula } from "@/lib/admin-client"
import { cn } from "@/lib/utils"

type DraftProduct = Pick<Product, "id" | "name" | "price" | "isAvailable">
type DraftFormula = Pick<Formula, "id" | "name" | "basePrice" | "isAvailable">

type DraftCategory = {
  id: string
  name: string
  isActive: boolean
  products: DraftProduct[]
  formulas: DraftFormula[]
}

type ItemType = "cat" | "prod" | "form"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  onSaved: () => void
}

function parseId(id: string): { type: ItemType; realId: string } | null {
  const idx = id.indexOf(":")
  if (idx === -1) return null
  const type = id.slice(0, idx)
  const realId = id.slice(idx + 1)
  if (type === "cat" || type === "prod" || type === "form") {
    return { type, realId }
  }
  return null
}

function findItemContainer(draft: DraftCategory[], type: "prod" | "form", itemId: string): string | null {
  for (const cat of draft) {
    const list = type === "prod" ? cat.products : cat.formulas
    if (list.some((i) => i.id === itemId)) return cat.id
  }
  return null
}

type Mode = "categories" | "items"

export function MenuOrganizerDrawer({ open, onOpenChange, categories, onSaved }: Props) {
  const [draft, setDraft] = useState<DraftCategory[]>([])
  const [initial, setInitial] = useState<DraftCategory[]>([])
  const [saving, setSaving] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("categories")

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (!open) return
    const snapshot: DraftCategory[] = categories.map((c) => ({
      id: c.id,
      name: c.name,
      isActive: c.isActive,
      products: c.products.map((p) => ({ id: p.id, name: p.name, price: p.price, isAvailable: p.isAvailable })),
      formulas: (c.formulas || []).map((f) => ({ id: f.id, name: f.name, basePrice: f.basePrice, isAvailable: f.isAvailable })),
    }))
    setDraft(snapshot)
    setInitial(structuredClone(snapshot))
    setActiveId(null)
    setMode("categories")
  }, [open, categories])

  const activeItem = useMemo(() => {
    if (!activeId) return null
    const info = parseId(activeId)
    if (!info) return null
    if (info.type === "cat") {
      const c = draft.find((x) => x.id === info.realId)
      return c ? { kind: "cat" as const, label: c.name, count: c.products.length + c.formulas.length } : null
    }
    for (const c of draft) {
      if (info.type === "prod") {
        const p = c.products.find((x) => x.id === info.realId)
        if (p) return { kind: "prod" as const, label: p.name, price: p.price }
      } else {
        const f = c.formulas.find((x) => x.id === info.realId)
        if (f) return { kind: "form" as const, label: f.name, price: f.basePrice }
      }
    }
    return null
  }, [activeId, draft])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const activeInfo = parseId(active.id as string)
    const overInfo = parseId(over.id as string)
    if (!activeInfo || !overInfo) return
    if (activeInfo.type === "cat") return
    if (activeInfo.type !== "prod" && activeInfo.type !== "form") return

    const movingType = activeInfo.type
    const sourceCatId = findItemContainer(draft, movingType, activeInfo.realId)
    if (!sourceCatId) return

    let targetCatId: string | null = null
    let targetIndex = -1

    if (overInfo.type === movingType) {
      targetCatId = findItemContainer(draft, movingType, overInfo.realId)
      if (!targetCatId) return
      const targetCat = draft.find((c) => c.id === targetCatId)!
      const targetList = movingType === "prod" ? targetCat.products : targetCat.formulas
      targetIndex = targetList.findIndex((i) => i.id === overInfo.realId)
    } else if (overInfo.type === "cat") {
      targetCatId = overInfo.realId
      const targetCat = draft.find((c) => c.id === targetCatId)
      if (!targetCat) return
      targetIndex = (movingType === "prod" ? targetCat.products : targetCat.formulas).length
    } else {
      return
    }

    if (sourceCatId === targetCatId) return

    setDraft((prev) => {
      const next = prev.map((c) => ({ ...c, products: [...c.products], formulas: [...c.formulas] }))
      const sourceCat = next.find((c) => c.id === sourceCatId)!
      const targetCat = next.find((c) => c.id === targetCatId)!
      if (movingType === "prod") {
        const sourceIndex = sourceCat.products.findIndex((i) => i.id === activeInfo.realId)
        if (sourceIndex === -1) return prev
        const [moved] = sourceCat.products.splice(sourceIndex, 1)
        const insertAt = Math.min(Math.max(targetIndex, 0), targetCat.products.length)
        targetCat.products.splice(insertAt, 0, moved)
      } else {
        const sourceIndex = sourceCat.formulas.findIndex((i) => i.id === activeInfo.realId)
        if (sourceIndex === -1) return prev
        const [moved] = sourceCat.formulas.splice(sourceIndex, 1)
        const insertAt = Math.min(Math.max(targetIndex, 0), targetCat.formulas.length)
        targetCat.formulas.splice(insertAt, 0, moved)
      }
      return next
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return

    const activeInfo = parseId(active.id as string)
    const overInfo = parseId(over.id as string)
    if (!activeInfo || !overInfo) return

    if (activeInfo.type === "cat" && overInfo.type === "cat") {
      setDraft((prev) => {
        const oldIndex = prev.findIndex((c) => c.id === activeInfo.realId)
        const newIndex = prev.findIndex((c) => c.id === overInfo.realId)
        if (oldIndex === -1 || newIndex === -1) return prev
        return arrayMove(prev, oldIndex, newIndex)
      })
      return
    }

    if (activeInfo.type !== overInfo.type) return
    if (activeInfo.type !== "prod" && activeInfo.type !== "form") return

    const movingType = activeInfo.type
    const container = findItemContainer(draft, movingType, activeInfo.realId)
    if (!container) return

    setDraft((prev) =>
      prev.map((c) => {
        if (c.id !== container) return c
        if (movingType === "prod") {
          const oldIndex = c.products.findIndex((i) => i.id === activeInfo.realId)
          const newIndex = c.products.findIndex((i) => i.id === overInfo.realId)
          if (oldIndex === -1 || newIndex === -1) return c
          return { ...c, products: arrayMove(c.products, oldIndex, newIndex) }
        } else {
          const oldIndex = c.formulas.findIndex((i) => i.id === activeInfo.realId)
          const newIndex = c.formulas.findIndex((i) => i.id === overInfo.realId)
          if (oldIndex === -1 || newIndex === -1) return c
          return { ...c, formulas: arrayMove(c.formulas, oldIndex, newIndex) }
        }
      })
    )
  }

  const diff = useMemo(() => {
    const changedCategories: { id: string; position: number; isActive: boolean }[] = []
    const changedProducts: { id: string; categoryId: string; position: number; isAvailable: boolean }[] = []
    const changedFormulas: { id: string; categoryId: string; position: number }[] = []

    const initialCatIndex = new Map(initial.map((c, i) => [c.id, i]))
    draft.forEach((cat, i) => {
      if (initialCatIndex.get(cat.id) !== i) {
        changedCategories.push({ id: cat.id, position: i, isActive: cat.isActive })
      }
    })

    const initialProductLoc = new Map<string, { catId: string; pos: number }>()
    initial.forEach((cat) => cat.products.forEach((p, i) => initialProductLoc.set(p.id, { catId: cat.id, pos: i })))
    const initialFormulaLoc = new Map<string, { catId: string; pos: number }>()
    initial.forEach((cat) => cat.formulas.forEach((f, i) => initialFormulaLoc.set(f.id, { catId: cat.id, pos: i })))

    draft.forEach((cat) => {
      cat.products.forEach((prod, i) => {
        const before = initialProductLoc.get(prod.id)
        if (!before || before.catId !== cat.id || before.pos !== i) {
          changedProducts.push({ id: prod.id, categoryId: cat.id, position: i, isAvailable: prod.isAvailable })
        }
      })
      cat.formulas.forEach((form, i) => {
        const before = initialFormulaLoc.get(form.id)
        if (!before || before.catId !== cat.id || before.pos !== i) {
          changedFormulas.push({ id: form.id, categoryId: cat.id, position: i })
        }
      })
    })

    return { changedCategories, changedProducts, changedFormulas }
  }, [draft, initial])

  const hasChanges = diff.changedCategories.length + diff.changedProducts.length + diff.changedFormulas.length > 0

  const handleSave = async () => {
    if (!hasChanges) {
      onOpenChange(false)
      return
    }
    setSaving(true)
    try {
      await Promise.all([
        ...diff.changedCategories.map((c) =>
          updateCategory(c.id, { position: c.position, isActive: c.isActive })
        ),
        ...diff.changedProducts.map((p) =>
          updateProduct(p.id, { categoryId: p.categoryId, position: p.position, isAvailable: p.isAvailable })
        ),
        ...diff.changedFormulas.map((f) =>
          updateFormula(f.id, { categoryId: f.categoryId, position: f.position })
        ),
      ])
      toast.success("Menu réorganisé")
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde")
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (hasChanges && !confirm("Abandonner les modifications ?")) return
    onOpenChange(false)
  }

  return (
    <Drawer.Root direction="right" open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content className="fixed right-0 top-0 bottom-0 z-50 flex h-full w-full flex-col bg-background outline-none md:max-w-3xl">
          <Drawer.Title className="sr-only">Organiser le menu</Drawer.Title>
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Organiser le menu</h2>
              <p className="text-xs text-muted-foreground">
                {mode === "categories"
                  ? "Glissez les catégories pour les réordonner rapidement."
                  : "Glissez produits et formules pour les réordonner ou les déplacer d'une catégorie à l'autre."}
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex items-center gap-1 border-b px-4 pt-3 md:px-6">
            <button
              onClick={() => setMode("categories")}
              className={cn(
                "rounded-t-lg px-4 py-2 text-sm font-medium transition-colors border-b-2",
                mode === "categories"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Catégories seulement
            </button>
            <button
              onClick={() => setMode("items")}
              className={cn(
                "rounded-t-lg px-4 py-2 text-sm font-medium transition-colors border-b-2",
                mode === "items"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Produits & formules
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={draft.map((c) => `cat:${c.id}`)} strategy={verticalListSortingStrategy}>
                {mode === "categories" ? (
                  <div className="space-y-2">
                    {draft.map((cat) => (
                      <CompactCategoryCard key={cat.id} cat={cat} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {draft.map((cat) => (
                      <SortableCategory key={cat.id} cat={cat} />
                    ))}
                  </div>
                )}
              </SortableContext>

              <DragOverlay>
                {activeItem ? (
                  <div className="rounded-lg border bg-background px-3 py-2 shadow-xl">
                    <div className="flex items-center gap-2">
                      <GripVertical size={14} className="text-muted-foreground" />
                      <span className={cn("text-sm font-medium", activeItem.kind === "cat" && "text-base font-bold")}>
                        {activeItem.label}
                      </span>
                      {activeItem.kind !== "cat" && (
                        <span className="text-xs text-muted-foreground">{activeItem.price.toFixed(2)} €</span>
                      )}
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t bg-background px-6 py-4">
            <span className="text-xs text-muted-foreground">
              {hasChanges
                ? `${diff.changedCategories.length + diff.changedProducts.length + diff.changedFormulas.length} modification(s) en attente`
                : "Aucune modification"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="rounded-full border border-foreground/20 px-5 py-2 text-sm font-semibold transition-colors hover:bg-foreground/5 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Enregistrer
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function SortableCategory({ cat }: { cat: DraftCategory }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `cat:${cat.id}` })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="rounded-2xl border bg-background">
      {/* Category header (drag handle here) */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <button
          type="button"
          {...listeners}
          aria-label="Déplacer la catégorie"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={16} />
        </button>
        <h3 className="font-semibold truncate flex-1">{cat.name}</h3>
        <span className="text-xs text-muted-foreground shrink-0">
          {cat.products.length} produits{cat.formulas.length > 0 && ` · ${cat.formulas.length} formules`}
        </span>
      </div>

      {/* Products section */}
      <div className="px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Produits</p>
        <SortableContext items={cat.products.map((p) => `prod:${p.id}`)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1 min-h-[28px]">
            {cat.products.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-2 text-xs italic text-muted-foreground">
                Glissez un produit ici
              </p>
            ) : (
              cat.products.map((p) => <SortableProduct key={p.id} product={p} />)
            )}
          </div>
        </SortableContext>
      </div>

      {/* Formulas section */}
      {(cat.formulas.length > 0 || true) && (
        <div className="border-t px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Formules
          </p>
          <SortableContext items={cat.formulas.map((f) => `form:${f.id}`)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1 min-h-[28px]">
              {cat.formulas.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-2 text-xs italic text-muted-foreground">
                  Glissez une formule ici
                </p>
              ) : (
                cat.formulas.map((f) => <SortableFormula key={f.id} formula={f} />)
              )}
            </div>
          </SortableContext>
        </div>
      )}
    </div>
  )
}

function CompactCategoryCard({ cat }: { cat: DraftCategory }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `cat:${cat.id}` })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3 cursor-grab active:cursor-grabbing touch-none hover:bg-muted/30 transition-colors"
    >
      <GripVertical size={16} className="text-muted-foreground shrink-0" />
      <span className="flex-1 truncate font-semibold">{cat.name}</span>
      <span className="text-xs text-muted-foreground shrink-0">
        {cat.products.length} produits
        {cat.formulas.length > 0 && ` · ${cat.formulas.length} formules`}
      </span>
    </div>
  )
}

function SortableProduct({ product }: { product: DraftProduct }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `prod:${product.id}` })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 cursor-grab active:cursor-grabbing touch-none hover:bg-muted/30"
    >
      <GripVertical size={14} className="text-muted-foreground shrink-0" />
      <span className={cn("flex-1 truncate text-sm", !product.isAvailable && "text-muted-foreground line-through")}>
        {product.name}
      </span>
      <span className="text-xs font-semibold text-muted-foreground shrink-0">{product.price.toFixed(2)} €</span>
    </div>
  )
}

function SortableFormula({ formula }: { formula: DraftFormula }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `form:${formula.id}` })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50/50 px-3 py-2 cursor-grab active:cursor-grabbing touch-none hover:bg-purple-100/50 dark:border-purple-900/50 dark:bg-purple-900/10 dark:hover:bg-purple-900/20"
    >
      <GripVertical size={14} className="text-purple-600/60 shrink-0" />
      <span className={cn("flex-1 truncate text-sm", !formula.isAvailable && "text-muted-foreground line-through")}>
        {formula.name}
      </span>
      <span className="text-xs font-semibold text-purple-600 shrink-0 dark:text-purple-400">
        {formula.basePrice.toFixed(2)} €
      </span>
    </div>
  )
}
