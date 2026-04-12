"use client"

import { useEffect, useState, useRef } from "react"
import { Drawer } from "vaul"
import { X, Trash2, Plus, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import {
  updateProduct,
  createProductOption,
  deleteProductOption,
  addOptionChoice,
  updateProductOption,
  updateOptionChoice,
  deleteOptionChoice,
  suggestProductDetails,
  type AISuggestion,
} from "@/lib/admin-client"
import { ImageUpload } from "@/components/image-upload"
import type { Product, ProductOption } from "@/lib/restaurant-types"

interface Props {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function ProductDrawer({ product, open, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [allergens, setAllergens] = useState("")
  const [options, setOptions] = useState<ProductOption[]>([])
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)

  // New option form
  const [showNewOption, setShowNewOption] = useState(false)
  const [newOptName, setNewOptName] = useState("")
  const [newOptType, setNewOptType] = useState<"single" | "multiple">("single")
  const [newOptRequired, setNewOptRequired] = useState(false)
  const [newOptMaxSelections, setNewOptMaxSelections] = useState(0)
  const [newOptChoices, setNewOptChoices] = useState<{ name: string; priceModifier: number }[]>([
    { name: "", priceModifier: 0 },
  ])
  const [addingOption, setAddingOption] = useState(false)

  // New choice for existing option
  const [addChoiceFor, setAddChoiceFor] = useState<string | null>(null)
  const [newChoiceName, setNewChoiceName] = useState("")
  const [newChoicePrice, setNewChoicePrice] = useState(0)

  // Track original values for dirty-check on blur
  const originalOptions = useRef<Map<string, { name: string; type: string; isRequired: boolean; maxSelections: number }>>(new Map())
  const originalChoices = useRef<Map<string, { name: string; priceModifier: number }>>(new Map())

  useEffect(() => {
    if (product && open) {
      setName(product.name)
      setDescription(product.description || "")
      setPrice(product.price.toString())
      setImageUrl(product.imageUrl || "")
      setAllergens((product.allergens || []).join(", "))
      setOptions(product.options || [])
      setShowNewOption(false)

      // Store originals for dirty checking
      const optMap = new Map<string, { name: string; type: string; isRequired: boolean; maxSelections: number }>()
      const choiceMap = new Map<string, { name: string; priceModifier: number }>()
      for (const opt of product.options || []) {
        optMap.set(opt.id, { name: opt.name, type: opt.type, isRequired: opt.isRequired, maxSelections: opt.maxSelections ?? 0 })
        for (const c of opt.choices) {
          choiceMap.set(c.id, { name: c.name, priceModifier: c.priceModifier })
        }
      }
      originalOptions.current = optMap
      originalChoices.current = choiceMap
    }
  }, [product, open])

  const handleSave = async () => {
    if (!product) return
    setSaving(true)
    try {
      await updateProduct(product.id, {
        name,
        description,
        price: parseFloat(price),
        imageUrl,
        isAvailable: product.isAvailable,
        allergens: allergens.split(",").map((a) => a.trim()).filter(Boolean),
      })
      toast.success("Produit mis a jour")
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  const handleAddOption = async () => {
    if (!product || !newOptName.trim()) return
    const validChoices = newOptChoices.filter((c) => c.name.trim())
    if (validChoices.length === 0) {
      toast.error("Ajoutez au moins un choix")
      return
    }
    setAddingOption(true)
    try {
      const created = await createProductOption(product.id, {
        name: newOptName,
        type: newOptType,
        isRequired: newOptRequired,
        maxSelections: newOptType === "multiple" ? newOptMaxSelections : 0,
        choices: validChoices,
      })
      setOptions((prev) => [...prev, created as unknown as ProductOption])
      // Track new option originals
      const opt = created as unknown as ProductOption
      originalOptions.current.set(opt.id, { name: opt.name, type: opt.type, isRequired: opt.isRequired, maxSelections: opt.maxSelections ?? 0 })
      for (const c of opt.choices) {
        originalChoices.current.set(c.id, { name: c.name, priceModifier: c.priceModifier })
      }
      setShowNewOption(false)
      setNewOptName("")
      setNewOptType("single")
      setNewOptRequired(false)
      setNewOptMaxSelections(0)
      setNewOptChoices([{ name: "", priceModifier: 0 }])
      toast.success("Option ajoutee")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setAddingOption(false)
    }
  }

  const handleDeleteOption = async (optionId: string) => {
    if (!confirm("Supprimer cette option ?")) return
    try {
      await deleteProductOption(optionId)
      setOptions((prev) => prev.filter((o) => o.id !== optionId))
      originalOptions.current.delete(optionId)
      toast.success("Option supprimee")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  const handleAddChoice = async (optionId: string) => {
    if (!newChoiceName.trim()) return
    try {
      const choice = await addOptionChoice(optionId, {
        name: newChoiceName,
        priceModifier: newChoicePrice,
      })
      const typedChoice = choice as unknown as ProductOption["choices"][0]
      setOptions((prev) =>
        prev.map((o) =>
          o.id === optionId ? { ...o, choices: [...o.choices, typedChoice] } : o
        )
      )
      originalChoices.current.set(typedChoice.id, { name: typedChoice.name, priceModifier: typedChoice.priceModifier })
      setAddChoiceFor(null)
      setNewChoiceName("")
      setNewChoicePrice(0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  // Auto-save option on blur (only if changed)
  const handleOptionBlur = async (opt: ProductOption) => {
    const orig = originalOptions.current.get(opt.id)
    if (!orig) return
    if (orig.name === opt.name && orig.type === opt.type && orig.isRequired === opt.isRequired && orig.maxSelections === (opt.maxSelections ?? 0)) return
    if (!opt.name.trim()) return
    try {
      await updateProductOption(opt.id, { name: opt.name, type: opt.type, isRequired: opt.isRequired, maxSelections: opt.maxSelections ?? 0 })
      originalOptions.current.set(opt.id, { name: opt.name, type: opt.type, isRequired: opt.isRequired, maxSelections: opt.maxSelections ?? 0 })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  // Auto-save choice on blur (only if changed)
  const handleChoiceBlur = async (choice: ProductOption["choices"][0]) => {
    const orig = originalChoices.current.get(choice.id)
    if (!orig) return
    if (orig.name === choice.name && orig.priceModifier === choice.priceModifier) return
    if (!choice.name.trim()) return
    try {
      await updateOptionChoice(choice.id, { name: choice.name, priceModifier: choice.priceModifier })
      originalChoices.current.set(choice.id, { name: choice.name, priceModifier: choice.priceModifier })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  const handleDeleteChoice = async (optionId: string, choiceId: string) => {
    try {
      await deleteOptionChoice(choiceId)
      setOptions((prev) =>
        prev.map((o) =>
          o.id === optionId ? { ...o, choices: o.choices.filter((c) => c.id !== choiceId) } : o
        )
      )
      originalChoices.current.delete(choiceId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  // Update local option state
  const updateLocalOption = (optionId: string, patch: Partial<ProductOption>) => {
    setOptions((prev) =>
      prev.map((o) => (o.id === optionId ? { ...o, ...patch } : o))
    )
  }

  // Update local choice state
  const updateLocalChoice = (optionId: string, choiceId: string, patch: Partial<ProductOption["choices"][0]>) => {
    setOptions((prev) =>
      prev.map((o) =>
        o.id === optionId
          ? { ...o, choices: o.choices.map((c) => (c.id === choiceId ? { ...c, ...patch } : c)) }
          : o
      )
    )
  }

  const handleAISuggest = async () => {
    if (!product) return
    setSuggesting(true)
    try {
      const suggestion: AISuggestion = await suggestProductDetails(name || product.name)
      setDescription(suggestion.description)
      setPrice(suggestion.suggestedPrice.toString())
      setAllergens(suggestion.allergens.join(", "))
      toast.success("Suggestions IA appliquees")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur IA")
    } finally {
      setSuggesting(false)
    }
  }

  if (!product) return null

  return (
    <Drawer.Root direction="right" open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-background border-l overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-4">
            <Drawer.Title className="font-bold text-lg">Modifier le produit</Drawer.Title>
            <button
              onClick={() => onOpenChange(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Details section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Details</h3>
                <button
                  onClick={handleAISuggest}
                  disabled={suggesting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-purple-100 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-200 transition-colors dark:bg-purple-900/30 dark:text-purple-400 disabled:opacity-50"
                >
                  {suggesting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Suggestions IA
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nom</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Prix (EUR)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Image</label>
                <ImageUpload value={imageUrl} onChange={setImageUrl} category="product" className="w-full" aspectRatio="aspect-[3/2]" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Allergenes (separes par des virgules)</label>
                <input
                  type="text"
                  value={allergens}
                  onChange={(e) => setAllergens(e.target.value)}
                  placeholder="Gluten, Lait, Oeufs"
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
            </div>

            {/* Options section */}
            <div className="border-t pt-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Options / Supplements</h3>
                <button
                  onClick={() => setShowNewOption(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Plus size={14} />
                  Ajouter
                </button>
              </div>

              {options.length === 0 && !showNewOption && (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune option</p>
              )}

              <div className="space-y-3">
                {options.map((opt) => (
                  <div key={opt.id} className="rounded-xl border p-3">
                    {/* Editable option header — row 1: name + delete */}
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={opt.name}
                        onChange={(e) => updateLocalOption(opt.id, { name: e.target.value })}
                        onBlur={() => handleOptionBlur(opt)}
                        className="flex-1 rounded-lg border bg-background px-2 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-foreground/20"
                      />
                      <button
                        onClick={() => handleDeleteOption(opt.id)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {/* Row 2: type + requis + max */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <select
                        value={opt.type}
                        onChange={(e) => {
                          const newType = e.target.value as "single" | "multiple"
                          updateLocalOption(opt.id, { type: newType, maxSelections: 0 })
                          updateProductOption(opt.id, { name: opt.name, type: newType, isRequired: opt.isRequired, maxSelections: 0 })
                            .then(() => originalOptions.current.set(opt.id, { name: opt.name, type: newType, isRequired: opt.isRequired, maxSelections: 0 }))
                            .catch((err) => toast.error(err instanceof Error ? err.message : "Erreur"))
                        }}
                        className="rounded-lg border bg-background px-2 py-1 text-xs outline-none"
                      >
                        <option value="single">Choix unique</option>
                        <option value="multiple">Choix multiple</option>
                      </select>
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={opt.isRequired}
                          onChange={(e) => {
                            const newRequired = e.target.checked
                            updateLocalOption(opt.id, { isRequired: newRequired })
                            updateProductOption(opt.id, { name: opt.name, type: opt.type, isRequired: newRequired, maxSelections: opt.maxSelections ?? 0 })
                              .then(() => originalOptions.current.set(opt.id, { name: opt.name, type: opt.type, isRequired: newRequired, maxSelections: opt.maxSelections ?? 0 }))
                              .catch((err) => toast.error(err instanceof Error ? err.message : "Erreur"))
                          }}
                          className="rounded"
                        />
                        <span>Requis</span>
                      </label>
                      {opt.type === "multiple" && (
                        <label className="flex items-center gap-1.5 text-xs ml-auto">
                          <span className="text-muted-foreground">Max choix</span>
                          <input
                            type="number"
                            min="0"
                            value={opt.maxSelections ?? 0}
                            onChange={(e) => updateLocalOption(opt.id, { maxSelections: parseInt(e.target.value) || 0 })}
                            onBlur={() => handleOptionBlur(opt)}
                            className="w-14 rounded-lg border bg-background px-2 py-1 text-xs text-center outline-none focus:ring-2 focus:ring-foreground/20"
                            title="0 = illimité"
                          />
                          <span className="text-[10px] text-muted-foreground/60">(0 = illim.)</span>
                        </label>
                      )}
                    </div>

                    {/* Editable choice rows */}
                    <div className="space-y-1">
                      {opt.choices.map((choice) => (
                        <div key={choice.id} className="flex items-center gap-2 px-1">
                          <input
                            type="text"
                            value={choice.name}
                            onChange={(e) => updateLocalChoice(opt.id, choice.id, { name: e.target.value })}
                            onBlur={() => handleChoiceBlur(choice)}
                            className="flex-1 rounded-lg border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-foreground/20"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={choice.priceModifier}
                            onChange={(e) => updateLocalChoice(opt.id, choice.id, { priceModifier: parseFloat(e.target.value) || 0 })}
                            onBlur={() => handleChoiceBlur(choice)}
                            className="w-20 rounded-lg border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-foreground/20"
                          />
                          <span className="text-[10px] text-muted-foreground">EUR</span>
                          <button
                            onClick={() => handleDeleteChoice(opt.id, choice.id)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {addChoiceFor === opt.id ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={newChoiceName}
                          onChange={(e) => setNewChoiceName(e.target.value)}
                          placeholder="Nom du choix"
                          className="flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs outline-none"
                          autoFocus
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={newChoicePrice}
                          onChange={(e) => setNewChoicePrice(parseFloat(e.target.value) || 0)}
                          placeholder="Prix"
                          className="w-20 rounded-lg border bg-background px-2 py-1.5 text-xs outline-none"
                        />
                        <button
                          onClick={() => handleAddChoice(opt.id)}
                          className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setAddChoiceFor(null)}
                          className="rounded-lg px-2 py-1.5 text-xs hover:bg-muted"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddChoiceFor(opt.id)}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus size={10} />
                        Ajouter un choix
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* New option form */}
              {showNewOption && (
                <div className="mt-3 rounded-xl border bg-foreground/[0.02] p-4 space-y-3">
                  <input
                    type="text"
                    value={newOptName}
                    onChange={(e) => setNewOptName(e.target.value)}
                    placeholder="Nom de l'option (ex: Sauce, Taille)"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none"
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-3">
                    <select
                      value={newOptType}
                      onChange={(e) => {
                        const t = e.target.value as "single" | "multiple"
                        setNewOptType(t)
                        if (t === "single") setNewOptMaxSelections(0)
                      }}
                      className="rounded-lg border bg-background px-3 py-2 text-sm outline-none"
                    >
                      <option value="single">Choix unique</option>
                      <option value="multiple">Choix multiple</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newOptRequired}
                        onChange={(e) => setNewOptRequired(e.target.checked)}
                        className="rounded"
                      />
                      Requis
                    </label>
                    {newOptType === "multiple" && (
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Max choix</span>
                        <input
                          type="number"
                          min="0"
                          value={newOptMaxSelections}
                          onChange={(e) => setNewOptMaxSelections(parseInt(e.target.value) || 0)}
                          className="w-16 rounded-lg border bg-background px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-foreground/20"
                        />
                        <span className="text-xs text-muted-foreground">(0 = illimité)</span>
                      </label>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Choix</p>
                    {newOptChoices.map((c, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="text"
                          value={c.name}
                          onChange={(e) => {
                            const copy = [...newOptChoices]
                            copy[i] = { ...copy[i], name: e.target.value }
                            setNewOptChoices(copy)
                          }}
                          placeholder="Nom"
                          className="flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs outline-none"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={c.priceModifier}
                          onChange={(e) => {
                            const copy = [...newOptChoices]
                            copy[i] = { ...copy[i], priceModifier: parseFloat(e.target.value) || 0 }
                            setNewOptChoices(copy)
                          }}
                          placeholder="+ EUR"
                          className="w-20 rounded-lg border bg-background px-2 py-1.5 text-xs outline-none"
                        />
                        {newOptChoices.length > 1 && (
                          <button
                            onClick={() => setNewOptChoices(newOptChoices.filter((_, j) => j !== i))}
                            className="text-red-500"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setNewOptChoices([...newOptChoices, { name: "", priceModifier: 0 }])}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      + Ajouter un choix
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddOption}
                      disabled={addingOption}
                      className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
                    >
                      {addingOption ? <Loader2 size={14} className="animate-spin" /> : "Creer l'option"}
                    </button>
                    <button
                      onClick={() => setShowNewOption(false)}
                      className="rounded-lg px-4 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom save bar */}
          <div className="sticky bottom-0 border-t bg-background px-6 py-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-full bg-foreground py-3.5 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Enregistrer"}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
