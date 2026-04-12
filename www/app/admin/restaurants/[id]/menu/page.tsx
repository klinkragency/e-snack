"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, Loader2, Eye, EyeOff, X, FileJson, Pencil, Check, ListTree } from "lucide-react"
import { toast } from "sonner"
import { getMenu } from "@/lib/restaurant-client"
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createProduct,
  deleteProduct,
  toggleProductAvailability,
  deleteFormula,
  toggleFormulaAvailability,
  importMenuFromJSON,
  type ImportedCategory,
} from "@/lib/admin-client"
import { ProductDrawer } from "@/components/admin/product-drawer"
import { FormulaDrawer } from "@/components/admin/formula-drawer"
import { MenuOrganizerDrawer } from "@/components/admin/menu-organizer-drawer"
import type { Restaurant, Category, Product, Formula } from "@/lib/restaurant-types"
import { cn } from "@/lib/utils"

export default function MenuManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: restaurantId } = use(params)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // New category form
  const [newCatName, setNewCatName] = useState("")
  const [addingCat, setAddingCat] = useState(false)

  // Inline rename
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState("")
  const [savingRename, setSavingRename] = useState(false)

  // Menu organizer (modal editor)
  const [organizerOpen, setOrganizerOpen] = useState(false)

  // New product form state
  const [productFormCatId, setProductFormCatId] = useState<string | null>(null)
  const [newProduct, setNewProduct] = useState({ name: "", description: "", price: "" })
  const [addingProduct, setAddingProduct] = useState(false)

  // Product drawer
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Formula drawer
  const [formulaDrawerOpen, setFormulaDrawerOpen] = useState(false)
  const [formulaDrawerCatId, setFormulaDrawerCatId] = useState<string>("")
  const [drawerFormula, setDrawerFormula] = useState<Formula | null>(null)

  // JSON Import
  const [showImportModal, setShowImportModal] = useState(false)
  const [jsonInput, setJsonInput] = useState("")
  const [importing, setImporting] = useState(false)
  const [importSuggestions, setImportSuggestions] = useState<ImportedCategory[] | null>(null)
  const [importSelected, setImportSelected] = useState<Record<string, boolean>>({})
  const [applyingImport, setApplyingImport] = useState(false)

  const loadMenu = useCallback(async () => {
    try {
      // We need slug to fetch menu, but we have the ID
      // Fetch restaurant list to find slug from ID
      const res = await fetch(`/api/admin/restaurants`)
      const data = await res.json()
      const rest = (data.restaurants || []).find((r: Restaurant) => r.id === restaurantId)
      if (rest) {
        setRestaurant(rest)
        const menu = await getMenu(rest.slug)
        if (menu) {
          setCategories(menu.categories.sort((a, b) => a.position - b.position))
        }
      }
    } catch {
      toast.error("Erreur chargement menu")
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => { loadMenu() }, [loadMenu])

  // ─── Category CRUD ───

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    setAddingCat(true)
    try {
      await createCategory(restaurantId, { name: newCatName, position: categories.length })
      setNewCatName("")
      toast.success("Catégorie ajoutée")
      await loadMenu()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setAddingCat(false)
    }
  }

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm("Supprimer cette catégorie et tous ses produits ?")) return
    try {
      await deleteCategory(catId)
      setCategories((prev) => prev.filter((c) => c.id !== catId))
      toast.success("Catégorie supprimée")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  const startRenameCategory = (cat: Category) => {
    setEditingCatId(cat.id)
    setEditingCatName(cat.name)
  }

  const cancelRenameCategory = () => {
    setEditingCatId(null)
    setEditingCatName("")
  }

  const commitRenameCategory = async () => {
    if (!editingCatId) return
    const cat = categories.find((c) => c.id === editingCatId)
    if (!cat) {
      cancelRenameCategory()
      return
    }
    const next = editingCatName.trim()
    if (!next || next === cat.name) {
      cancelRenameCategory()
      return
    }
    setSavingRename(true)
    // Optimistic update
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, name: next } : c)))
    try {
      // Send all three fields — backend UpdateCategory overwrites position / isActive
      // with zero-values otherwise (proto3 has no "unset" for scalars).
      await updateCategory(cat.id, { name: next, position: cat.position, isActive: cat.isActive })
      toast.success("Catégorie renommée")
    } catch (err) {
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, name: cat.name } : c)))
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setSavingRename(false)
      cancelRenameCategory()
    }
  }

  // ─── Product CRUD ───

  const handleAddProduct = async (e: React.FormEvent, categoryId: string) => {
    e.preventDefault()
    if (!newProduct.name.trim() || !newProduct.price) return
    setAddingProduct(true)
    try {
      await createProduct(categoryId, {
        name: newProduct.name,
        description: newProduct.description,
        price: parseFloat(newProduct.price),
      })
      setNewProduct({ name: "", description: "", price: "" })
      setProductFormCatId(null)
      toast.success("Produit ajouté")
      await loadMenu()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setAddingProduct(false)
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Supprimer ce produit ?")) return
    try {
      await deleteProduct(productId)
      setCategories((prev) =>
        prev.map((c) => ({
          ...c,
          products: c.products.filter((p) => p.id !== productId),
        }))
      )
      toast.success("Produit supprimé")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  const handleToggleAvailability = async (product: Product) => {
    try {
      await toggleProductAvailability(product.id, !product.isAvailable)
      setCategories((prev) =>
        prev.map((c) => ({
          ...c,
          products: c.products.map((p) =>
            p.id === product.id ? { ...p, isAvailable: !p.isAvailable } : p
          ),
        }))
      )
    } catch {
      toast.error("Erreur")
    }
  }

  // ─── Formula CRUD ───

  const openFormulaDrawer = (categoryId: string, formula: Formula | null = null) => {
    setFormulaDrawerCatId(categoryId)
    setDrawerFormula(formula)
    setFormulaDrawerOpen(true)
  }

  const handleDeleteFormula = async (formulaId: string) => {
    if (!confirm("Supprimer cette formule ?")) return
    try {
      await deleteFormula(formulaId)
      setCategories((prev) =>
        prev.map((c) => ({
          ...c,
          formulas: (c.formulas || []).filter((f) => f.id !== formulaId),
        }))
      )
      toast.success("Formule supprimée")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  const handleToggleFormulaAvailability = async (formula: Formula) => {
    try {
      await toggleFormulaAvailability(formula.id, !formula.isAvailable)
      setCategories((prev) =>
        prev.map((c) => ({
          ...c,
          formulas: (c.formulas || []).map((f) =>
            f.id === formula.id ? { ...f, isAvailable: !f.isAvailable } : f
          ),
        }))
      )
    } catch {
      toast.error("Erreur")
    }
  }

  // ─── JSON Import ───

  const handleImportJSON = async () => {
    if (!jsonInput.trim()) return
    setImporting(true)
    try {
      const suggestions = await importMenuFromJSON(restaurantId, jsonInput)
      setImportSuggestions(suggestions)
      // Select all by default
      const selected: Record<string, boolean> = {}
      suggestions.forEach((cat, ci) => {
        selected[`cat-${ci}`] = true
        cat.products.forEach((_, pi) => {
          selected[`prod-${ci}-${pi}`] = true
        })
      })
      setImportSelected(selected)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur import JSON")
    } finally {
      setImporting(false)
    }
  }

  const handleApplyImport = async () => {
    if (!importSuggestions) return
    setApplyingImport(true)
    try {
      for (let ci = 0; ci < importSuggestions.length; ci++) {
        const cat = importSuggestions[ci]
        if (!importSelected[`cat-${ci}`]) continue
        const created = await createCategory(restaurantId, { name: cat.name, position: categories.length + ci })
        for (let pi = 0; pi < cat.products.length; pi++) {
          if (!importSelected[`prod-${ci}-${pi}`]) continue
          const p = cat.products[pi]
          await createProduct(created.id, {
            name: p.name,
            description: p.description,
            price: p.price,
            allergens: p.allergens,
          })
        }
      }
      toast.success("Menu importe avec succes !")
      setShowImportModal(false)
      setImportSuggestions(null)
      setJsonInput("")
      await loadMenu()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setApplyingImport(false)
    }
  }

  const openProductDrawer = (product: Product) => {
    setDrawerProduct(product)
    setDrawerOpen(true)
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="px-4 py-4 md:px-8 md:py-8">
      <div className="flex items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/admin/restaurants"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">Menu — {restaurant?.name}</h1>
            <p className="text-sm text-muted-foreground">{categories.length} catégories · {categories.reduce((s, c) => s + c.products.length, 0)} produits · {categories.reduce((s, c) => s + (c.formulas?.length || 0), 0)} formules</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setOrganizerOpen(true)}
            disabled={categories.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            <ListTree size={16} />
            <span className="hidden sm:inline">Organiser</span>
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-foreground/5"
          >
            <FileJson size={16} />
            <span className="hidden sm:inline">Importer JSON</span>
          </button>
        </div>
      </div>

      {/* Add category */}
      <form onSubmit={handleAddCategory} className="flex items-center gap-3 mb-8">
        <input
          type="text"
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          placeholder="Nouvelle catégorie..."
          className="flex-1 max-w-xs rounded-xl border bg-background px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-foreground/20"
        />
        <button
          type="submit"
          disabled={addingCat || !newCatName.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
        >
          {addingCat ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Ajouter
        </button>
      </form>

      {/* Categories + Products */}
      <div className="space-y-8">
        {categories.map((cat) => (
          <div key={cat.id} className="rounded-2xl border bg-background">
            {/* Category header */}
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {editingCatId === cat.id ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="text"
                      value={editingCatName}
                      onChange={(e) => setEditingCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); commitRenameCategory() }
                        else if (e.key === "Escape") { e.preventDefault(); cancelRenameCategory() }
                      }}
                      disabled={savingRename}
                      autoFocus
                      className="flex-1 min-w-0 rounded-lg border bg-background px-3 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                    <button
                      type="button"
                      onClick={commitRenameCategory}
                      disabled={savingRename}
                      className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
                      aria-label="Valider"
                    >
                      {savingRename ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={cancelRenameCategory}
                      disabled={savingRename}
                      className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                      aria-label="Annuler"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="font-semibold truncate">{cat.name}</h2>
                    <button
                      type="button"
                      onClick={() => startRenameCategory(cat)}
                      className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
                      aria-label="Renommer la catégorie"
                    >
                      <Pencil size={13} />
                    </button>
                    <span className="shrink-0 text-xs text-muted-foreground">{cat.products.length} produits</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto">
                <button
                  onClick={() => setProductFormCatId(productFormCatId === cat.id ? null : cat.id)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors whitespace-nowrap"
                >
                  <Plus size={14} />
                  Produit
                </button>
                <button
                  onClick={() => openFormulaDrawer(cat.id)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 transition-colors whitespace-nowrap"
                >
                  <Plus size={14} />
                  Formule
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Add product form */}
            {productFormCatId === cat.id && (
              <form onSubmit={(e) => handleAddProduct(e, cat.id)} className="border-b bg-foreground/[0.02] px-5 py-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="Nom du produit *"
                    className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                    required
                    autoFocus
                  />
                  <input
                    type="text"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    placeholder="Description"
                    className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                      placeholder="Prix (€) *"
                      className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                      required
                    />
                    <button
                      type="submit"
                      disabled={addingProduct}
                      className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
                    >
                      {addingProduct ? <Loader2 size={14} className="animate-spin" /> : "Ajouter"}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Product list */}
            <div className="divide-y">
              {cat.products.length === 0 && (!cat.formulas || cat.formulas.length === 0) ? (
                <p className="px-5 py-6 text-center text-sm text-muted-foreground">Aucun produit</p>
              ) : (
                cat.products.map((product) => (
                  <div key={product.id} className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-foreground/[0.02] transition-colors" onClick={() => openProductDrawer(product)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          "text-sm font-medium",
                          !product.isAvailable && "text-muted-foreground line-through"
                        )}>
                          {product.name}
                        </p>
                        {!product.isAvailable && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                            Indisponible
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{product.description}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-sm font-semibold whitespace-nowrap">{product.price.toFixed(2)} €</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleAvailability(product) }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                        title={product.isAvailable ? "Rendre indisponible" : "Rendre disponible"}
                      >
                        {product.isAvailable ? <Eye size={14} /> : <EyeOff size={14} className="text-muted-foreground" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id) }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Formula list */}
            {cat.formulas && cat.formulas.length > 0 && (
              <div className="border-t">
                <div className="px-5 py-2 bg-purple-50/50 dark:bg-purple-900/10">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Formules ({cat.formulas.length})
                  </p>
                </div>
                <div className="divide-y">
                  {cat.formulas.map((formula) => (
                    <div
                      key={formula.id}
                      className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-foreground/[0.02] transition-colors"
                      onClick={() => openFormulaDrawer(cat.id, formula)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                            FORMULE
                          </span>
                          <p className={cn(
                            "text-sm font-medium",
                            !formula.isAvailable && "text-muted-foreground line-through"
                          )}>
                            {formula.name}
                          </p>
                          {!formula.isAvailable && (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                              Indisponible
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {formula.products.map((fp) => fp.product?.name || fp.productId).join(" + ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <span className="text-sm font-semibold whitespace-nowrap">{formula.basePrice.toFixed(2)} €</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleFormulaAvailability(formula) }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                          title={formula.isAvailable ? "Rendre indisponible" : "Rendre disponible"}
                        >
                          {formula.isAvailable ? <Eye size={14} /> : <EyeOff size={14} className="text-muted-foreground" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteFormula(formula.id) }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Menu organizer modal */}
      <MenuOrganizerDrawer
        open={organizerOpen}
        onOpenChange={setOrganizerOpen}
        categories={categories}
        onSaved={() => loadMenu()}
      />

      {/* Product drawer */}
      <ProductDrawer
        product={drawerProduct}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSaved={() => loadMenu()}
      />

      {/* Formula drawer */}
      <FormulaDrawer
        formula={drawerFormula}
        categoryId={formulaDrawerCatId}
        categories={categories}
        open={formulaDrawerOpen}
        onOpenChange={setFormulaDrawerOpen}
        onSaved={() => loadMenu()}
      />

      {/* JSON Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-2xl rounded-2xl bg-background p-6 shadow-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Importer un menu depuis JSON</h2>
              <button onClick={() => { setShowImportModal(false); setImportSuggestions(null); setJsonInput("") }} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            {!importSuggestions ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Collez votre JSON ici</label>
                  <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder={`Exemple:
{
  "categories": [
    {
      "name": "Burgers",
      "products": [
        { "name": "Classic Burger", "price": 12.50 },
        { "name": "Cheese Burger", "price": 14.00 }
      ]
    }
  ]
}

Ou simplement une liste de produits...`}
                    className="w-full h-64 rounded-xl border bg-background px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  L&apos;IA va analyser votre JSON et le convertir au bon format. Elle peut aussi compléter les descriptions et allergènes manquants.
                </p>
                <button
                  onClick={handleImportJSON}
                  disabled={importing || !jsonInput.trim()}
                  className="w-full rounded-full bg-foreground py-3 text-sm font-semibold text-background disabled:opacity-50"
                >
                  {importing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Analyse en cours...
                    </span>
                  ) : (
                    "Analyser et prévisualiser"
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-4">
                  {importSuggestions.length} catégorie(s) et {importSuggestions.reduce((s, c) => s + c.products.length, 0)} produit(s) détectés. Sélectionnez ce que vous souhaitez importer:
                </p>
                {importSuggestions.map((cat, ci) => (
                  <div key={ci} className="rounded-xl border p-3">
                    <label className="flex items-center gap-2 font-semibold text-sm mb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importSelected[`cat-${ci}`] || false}
                        onChange={(e) => {
                          const val = e.target.checked
                          setImportSelected((prev) => {
                            const next = { ...prev, [`cat-${ci}`]: val }
                            cat.products.forEach((_, pi) => { next[`prod-${ci}-${pi}`] = val })
                            return next
                          })
                        }}
                        className="rounded"
                      />
                      {cat.name}
                    </label>
                    <div className="ml-6 space-y-1">
                      {cat.products.map((p, pi) => (
                        <label key={pi} className="flex items-center justify-between text-sm cursor-pointer py-1">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={importSelected[`prod-${ci}-${pi}`] || false}
                              onChange={(e) => setImportSelected((prev) => ({ ...prev, [`prod-${ci}-${pi}`]: e.target.checked }))}
                              className="rounded flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="block">{p.name}</span>
                              {p.description && <span className="block text-xs text-muted-foreground truncate">{p.description}</span>}
                            </div>
                          </div>
                          <span className="text-muted-foreground ml-2 flex-shrink-0">{p.price.toFixed(2)} €</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setImportSuggestions(null) }}
                    className="flex-1 rounded-full border py-3 text-sm font-semibold transition-colors hover:bg-muted"
                  >
                    Modifier le JSON
                  </button>
                  <button
                    onClick={handleApplyImport}
                    disabled={applyingImport}
                    className="flex-1 rounded-full bg-foreground py-3 text-sm font-semibold text-background disabled:opacity-50"
                  >
                    {applyingImport ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        Import en cours...
                      </span>
                    ) : (
                      "Importer"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
