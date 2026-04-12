"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createPromo, listAdminRestaurants } from "@/lib/admin-client"
import type { Restaurant } from "@/lib/restaurant-types"
import { cn } from "@/lib/utils"

const DISCOUNT_TYPES = [
  { value: "percentage", label: "Pourcentage (%)" },
  { value: "fixed_amount", label: "Montant fixe (€)" },
  { value: "free_delivery", label: "Livraison gratuite" },
]

export default function NewPromoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])

  // Form state
  const [code, setCode] = useState("")
  const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount" | "free_delivery">("percentage")
  const [discountValue, setDiscountValue] = useState("")
  const [minOrderAmount, setMinOrderAmount] = useState("")
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("")
  const [maxTotalUses, setMaxTotalUses] = useState("")
  const [maxUsesPerUser, setMaxUsesPerUser] = useState("1")
  const [firstOrderOnly, setFirstOrderOnly] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [requiresClaim, setRequiresClaim] = useState(false)
  const [expiresAt, setExpiresAt] = useState("")
  const [description, setDescription] = useState("")
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([])

  useEffect(() => {
    listAdminRestaurants()
      .then(setRestaurants)
      .catch(() => toast.error("Erreur chargement restaurants"))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!code.trim()) {
      toast.error("Le code est requis")
      return
    }

    if (discountType !== "free_delivery" && !discountValue) {
      toast.error("La valeur de réduction est requise")
      return
    }

    setLoading(true)
    try {
      await createPromo({
        code: code.toUpperCase(),
        discountType,
        discountValue: discountType === "free_delivery" ? 0 : parseFloat(discountValue),
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : undefined,
        maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : undefined,
        maxTotalUses: maxTotalUses ? parseInt(maxTotalUses) : undefined,
        maxUsesPerUser: maxUsesPerUser ? parseInt(maxUsesPerUser) : undefined,
        firstOrderOnly,
        isPrivate,
        requiresClaim,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        description: description || undefined,
        restaurantIds: selectedRestaurants.length > 0 ? selectedRestaurants : undefined,
      })
      toast.success("Code promo créé")
      router.push("/admin/promos")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur création")
    } finally {
      setLoading(false)
    }
  }

  const toggleRestaurant = (id: string) => {
    setSelectedRestaurants((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    )
  }

  return (
    <div className="px-4 py-4 md:px-8 md:py-8 max-w-2xl">
      <Link
        href="/admin/promos"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft size={16} />
        Retour aux codes promo
      </Link>

      <h1 className="text-2xl font-bold tracking-tight mb-8">Nouveau code promo</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Code */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="BIENVENUE20"
            className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20 font-mono uppercase"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Description (optionnel)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="20% de réduction pour les nouveaux clients"
            className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>

        {/* Discount Type */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Type de réduction <span className="text-red-500">*</span>
          </label>
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as typeof discountType)}
            className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
          >
            {DISCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Discount Value */}
        {discountType !== "free_delivery" && (
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Valeur de réduction <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                max={discountType === "percentage" ? "100" : undefined}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percentage" ? "20" : "5.00"}
                className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20 pr-10"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                {discountType === "percentage" ? "%" : "€"}
              </span>
            </div>
          </div>
        )}

        {/* Min Order Amount */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Montant minimum de commande (optionnel)</label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              value={minOrderAmount}
              onChange={(e) => setMinOrderAmount(e.target.value)}
              placeholder="15.00"
              className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20 pr-10"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
          </div>
        </div>

        {/* Max Discount Amount (only for percentage) */}
        {discountType === "percentage" && (
          <div>
            <label className="block text-sm font-medium mb-1.5">Réduction maximum (optionnel)</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={maxDiscountAmount}
                onChange={(e) => setMaxDiscountAmount(e.target.value)}
                placeholder="10.00"
                className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20 pr-10"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Plafond de réduction même si le pourcentage donne plus
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Max Total Uses */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Utilisations max (total)</label>
            <input
              type="number"
              min="0"
              value={maxTotalUses}
              onChange={(e) => setMaxTotalUses(e.target.value)}
              placeholder="Illimité"
              className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>

          {/* Max Uses Per User */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Utilisations max / user</label>
            <input
              type="number"
              min="1"
              value={maxUsesPerUser}
              onChange={(e) => setMaxUsesPerUser(e.target.value)}
              placeholder="1"
              className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
        </div>

        {/* Expires At */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Date d&apos;expiration (optionnel)</label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>

        {/* First Order Only */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFirstOrderOnly(!firstOrderOnly)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              firstOrderOnly ? "bg-foreground" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-background transition-transform",
                firstOrderOnly ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
          <label className="text-sm">Réservé aux premières commandes</label>
        </div>

        {/* Private Code */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPrivate(!isPrivate)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              isPrivate ? "bg-foreground" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-background transition-transform",
                isPrivate ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
          <div>
            <label className="text-sm">Code privé</label>
            <p className="text-xs text-muted-foreground">Doit être attribué aux utilisateurs</p>
          </div>
        </div>

        {/* Requires Claim */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRequiresClaim(!requiresClaim)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              requiresClaim ? "bg-foreground" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-background transition-transform",
                requiresClaim ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
          <div>
            <label className="text-sm">Réclamation requise</label>
            <p className="text-xs text-muted-foreground">L&apos;utilisateur doit réclamer le code avant de l&apos;utiliser</p>
          </div>
        </div>

        {/* Restaurant Restrictions */}
        {restaurants.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Restaurants (laisser vide pour tous)
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl border p-3">
              {restaurants.map((r) => (
                <label key={r.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRestaurants.includes(r.id)}
                    onChange={() => toggleRestaurant(r.id)}
                    className="rounded border-2"
                  />
                  <span className="text-sm">{r.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-4">
          <Link
            href="/admin/promos"
            className="flex-1 rounded-full border py-3 text-center text-sm font-medium hover:bg-muted"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Créer le code promo
          </button>
        </div>
      </form>
    </div>
  )
}
