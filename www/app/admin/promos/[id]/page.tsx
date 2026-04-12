"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, History, Settings, Users, Ban } from "lucide-react"
import { toast } from "sonner"
import {
  getPromo,
  updatePromo,
  getPromoUsage,
  getPromoStats,
  listPromoAssignments,
  listAdminRestaurants,
  revokeUserPromo,
  type PromoCode,
  type PromoUsage,
  type PromoStats,
  type UserPromoCode,
} from "@/lib/admin-client"
import type { Restaurant } from "@/lib/restaurant-types"
import { cn } from "@/lib/utils"

const DISCOUNT_TYPES = [
  { value: "percentage", label: "Pourcentage (%)" },
  { value: "fixed_amount", label: "Montant fixe (€)" },
  { value: "free_delivery", label: "Livraison gratuite" },
]

export default function EditPromoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [promo, setPromo] = useState<PromoCode | null>(null)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [activeTab, setActiveTab] = useState<"settings" | "usage" | "assignments">("settings")
  const [stats, setStats] = useState<PromoStats | null>(null)

  // Usage state
  const [usage, setUsage] = useState<PromoUsage[]>([])
  const [usageTotal, setUsageTotal] = useState(0)
  const [totalDiscountGiven, setTotalDiscountGiven] = useState(0)
  const [usagePage, setUsagePage] = useState(1)
  const [loadingUsage, setLoadingUsage] = useState(false)

  // Assignments state
  const [assignments, setAssignments] = useState<UserPromoCode[]>([])
  const [assignmentsTotal, setAssignmentsTotal] = useState(0)
  const [assignmentsPage, setAssignmentsPage] = useState(1)
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [assignmentFilter, setAssignmentFilter] = useState("")

  // Form state
  const [code, setCode] = useState("")
  const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount" | "free_delivery">("percentage")
  const [discountValue, setDiscountValue] = useState("")
  const [minOrderAmount, setMinOrderAmount] = useState("")
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("")
  const [maxTotalUses, setMaxTotalUses] = useState("")
  const [maxUsesPerUser, setMaxUsesPerUser] = useState("")
  const [firstOrderOnly, setFirstOrderOnly] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [requiresClaim, setRequiresClaim] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [expiresAt, setExpiresAt] = useState("")
  const [description, setDescription] = useState("")
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const [promoData, restaurantsData, statsData] = await Promise.all([
          getPromo(id),
          listAdminRestaurants(),
          getPromoStats(id),
        ])
        setPromo(promoData)
        setRestaurants(restaurantsData)
        setStats(statsData)

        // Populate form
        setCode(promoData.code)
        setDiscountType(promoData.discountType)
        setDiscountValue(promoData.discountValue?.toString() || "")
        setMinOrderAmount(promoData.minOrderAmount?.toString() || "")
        setMaxDiscountAmount(promoData.maxDiscountAmount?.toString() || "")
        setMaxTotalUses(promoData.maxTotalUses?.toString() || "")
        setMaxUsesPerUser(promoData.maxUsesPerUser?.toString() || "1")
        setFirstOrderOnly(promoData.firstOrderOnly)
        setIsPrivate(promoData.isPrivate)
        setRequiresClaim(promoData.requiresClaim)
        setIsActive(promoData.isActive)
        setDescription(promoData.description || "")
        setSelectedRestaurants(promoData.restaurantIds || [])

        if (promoData.expiresAt) {
          const date = new Date(promoData.expiresAt)
          setExpiresAt(date.toISOString().slice(0, 16))
        }
      } catch {
        toast.error("Erreur chargement code promo")
        router.push("/admin/promos")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, router])

  const loadUsage = async () => {
    setLoadingUsage(true)
    try {
      const data = await getPromoUsage(id, usagePage, 20)
      setUsage(data.usage || [])
      setUsageTotal(data.total || 0)
      setTotalDiscountGiven(data.totalDiscountGiven || 0)
    } catch {
      toast.error("Erreur chargement historique")
    } finally {
      setLoadingUsage(false)
    }
  }

  const loadAssignments = async () => {
    setLoadingAssignments(true)
    try {
      const data = await listPromoAssignments(id, assignmentsPage, 20, assignmentFilter)
      setAssignments(data.assignments || [])
      setAssignmentsTotal(data.total || 0)
    } catch {
      toast.error("Erreur chargement attributions")
    } finally {
      setLoadingAssignments(false)
    }
  }

  const handleRevokeAssignment = async (userId: string, userEmail: string) => {
    if (!confirm(`Révoquer le code promo pour ${userEmail} ?`)) return
    try {
      await revokeUserPromo(id, userId, "Révoqué par l'administrateur")
      toast.success("Code promo révoqué")
      loadAssignments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur révocation")
    }
  }

  useEffect(() => {
    if (activeTab === "usage") {
      loadUsage()
    } else if (activeTab === "assignments") {
      loadAssignments()
    }
  }, [activeTab, usagePage, assignmentsPage, assignmentFilter])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!code.trim()) {
      toast.error("Le code est requis")
      return
    }

    setSaving(true)
    try {
      await updatePromo(id, {
        code: code.toUpperCase(),
        discountType,
        discountValue: discountType === "free_delivery" ? 0 : parseFloat(discountValue),
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : 0,
        maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : 0,
        maxTotalUses: maxTotalUses ? parseInt(maxTotalUses) : 0,
        maxUsesPerUser: maxUsesPerUser ? parseInt(maxUsesPerUser) : 1,
        firstOrderOnly,
        isPrivate,
        requiresClaim,
        isActive,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        description: description || undefined,
        restaurantIds: selectedRestaurants,
      })
      toast.success("Code promo mis à jour")
      router.push("/admin/promos")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur mise à jour")
    } finally {
      setSaving(false)
    }
  }

  const toggleRestaurant = (restaurantId: string) => {
    setSelectedRestaurants((prev) =>
      prev.includes(restaurantId) ? prev.filter((r) => r !== restaurantId) : [...prev, restaurantId]
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!promo) return null

  const usageTotalPages = Math.ceil(usageTotal / 20)

  return (
    <div className="px-4 py-4 md:px-8 md:py-8 max-w-3xl">
      <Link
        href="/admin/promos"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft size={16} />
        Retour aux codes promo
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight font-mono">{promo.code}</h1>
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
          promo.isActive
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
        )}>
          {promo.isActive ? "Actif" : "Inactif"}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-2xl border p-4">
          <p className="text-sm text-muted-foreground">Utilisations</p>
          <p className="text-2xl font-bold">
            {promo.currentUses}
            {promo.maxTotalUses ? <span className="text-muted-foreground text-lg"> / {promo.maxTotalUses}</span> : ""}
          </p>
        </div>
        <div className="rounded-2xl border p-4">
          <p className="text-sm text-muted-foreground">Réduction totale</p>
          <p className="text-2xl font-bold">{stats?.totalDiscountGiven.toFixed(2) || "0.00"} €</p>
        </div>
        {promo.isPrivate && (
          <>
            <div className="rounded-2xl border p-4">
              <p className="text-sm text-muted-foreground">Attribués</p>
              <p className="text-2xl font-bold">{stats?.totalAssignments || 0}</p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="text-sm text-muted-foreground">Réclamés</p>
              <p className="text-2xl font-bold">{stats?.claimedCount || 0}</p>
            </div>
          </>
        )}
      </div>

      {/* Type badges */}
      <div className="flex gap-2 mb-6">
        {promo.isPrivate && (
          <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            Code privé
          </span>
        )}
        {promo.requiresClaim && (
          <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            Réclamation requise
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab("settings")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "settings"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Settings size={16} />
          Paramètres
        </button>
        {promo.isPrivate && (
          <button
            onClick={() => setActiveTab("assignments")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === "assignments"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Users size={16} />
            Attributions ({stats?.totalAssignments || 0})
          </button>
        )}
        <button
          onClick={() => setActiveTab("usage")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "usage"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <History size={16} />
          Historique ({usageTotal})
        </button>
      </div>

      {activeTab === "assignments" && promo.isPrivate ? (
        <div>
          {/* Filter */}
          <div className="flex gap-2 mb-4">
            <select
              value={assignmentFilter}
              onChange={(e) => {
                setAssignmentFilter(e.target.value)
                setAssignmentsPage(1)
              }}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="">Tous les statuts</option>
              <option value="assigned">Attribués</option>
              <option value="claimed">Réclamés</option>
              <option value="used">Utilisés</option>
              <option value="revoked">Révoqués</option>
              <option value="expired">Expirés</option>
            </select>
          </div>

          {loadingAssignments ? (
            <div className="flex justify-center py-16">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users size={48} className="mx-auto mb-4 opacity-30" />
              <p>Aucune attribution</p>
              <p className="text-sm mt-2">Attribuez ce code à des utilisateurs depuis la page de gestion des utilisateurs</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-foreground/[0.02] border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Utilisateur</th>
                      <th className="text-left px-4 py-3 font-medium">Statut</th>
                      <th className="text-left px-4 py-3 font-medium">Attribué le</th>
                      <th className="text-left px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {assignments.map((a) => (
                      <tr key={a.id} className="hover:bg-foreground/[0.02]">
                        <td className="px-4 py-3">
                          <p className="font-medium">{a.userName || "—"}</p>
                          <p className="text-xs text-muted-foreground">{a.userEmail}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            a.status === "assigned" ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" :
                            a.status === "claimed" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                            a.status === "used" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                            a.status === "revoked" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                            "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                          )}>
                            {a.status === "assigned" ? "Attribué" :
                             a.status === "claimed" ? "Réclamé" :
                             a.status === "used" ? "Utilisé" :
                             a.status === "revoked" ? "Révoqué" : "Expiré"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {new Date(a.assignedAt).toLocaleString("fr-FR")}
                        </td>
                        <td className="px-4 py-3">
                          {(a.status === "assigned" || a.status === "claimed") && (
                            <button
                              onClick={() => handleRevokeAssignment(a.userId, a.userEmail)}
                              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                            >
                              <Ban size={14} />
                              Révoquer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {Math.ceil(assignmentsTotal / 20) > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => setAssignmentsPage(Math.max(1, assignmentsPage - 1))}
                    disabled={assignmentsPage === 1}
                    className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Précédent
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {assignmentsPage} sur {Math.ceil(assignmentsTotal / 20)}
                  </span>
                  <button
                    onClick={() => setAssignmentsPage(Math.min(Math.ceil(assignmentsTotal / 20), assignmentsPage + 1))}
                    disabled={assignmentsPage === Math.ceil(assignmentsTotal / 20)}
                    className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Suivant
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : activeTab === "settings" ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Active Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border">
            <div>
              <p className="font-medium">Code actif</p>
              <p className="text-sm text-muted-foreground">Les clients peuvent utiliser ce code</p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                isActive ? "bg-green-500" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-background transition-transform",
                  isActive ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>

          {/* Code */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20 font-mono uppercase"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>

          {/* Discount Type */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Type de réduction</label>
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
              <label className="block text-sm font-medium mb-1.5">Valeur de réduction</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={discountType === "percentage" ? "100" : undefined}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
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
            <label className="block text-sm font-medium mb-1.5">Montant minimum de commande</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                placeholder="Aucun"
                className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20 pr-10"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
            </div>
          </div>

          {/* Max Discount Amount */}
          {discountType === "percentage" && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Réduction maximum</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={maxDiscountAmount}
                  onChange={(e) => setMaxDiscountAmount(e.target.value)}
                  placeholder="Aucun"
                  className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20 pr-10"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
              </div>
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
                className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
          </div>

          {/* Expires At */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Date d&apos;expiration</label>
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
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              Enregistrer
            </button>
          </div>
        </form>
      ) : (
        <div>
          {/* Usage History */}
          {loadingUsage ? (
            <div className="flex justify-center py-16">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : usage.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <History size={48} className="mx-auto mb-4 opacity-30" />
              <p>Aucune utilisation enregistrée</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-foreground/[0.02] border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Utilisateur</th>
                      <th className="text-left px-4 py-3 font-medium">Commande</th>
                      <th className="text-left px-4 py-3 font-medium">Réduction</th>
                      <th className="text-left px-4 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {usage.map((u) => (
                      <tr key={u.id} className="hover:bg-foreground/[0.02]">
                        <td className="px-4 py-3">
                          <p className="text-xs text-muted-foreground">{u.userEmail}</p>
                        </td>
                        <td className="px-4 py-3">
                          {u.orderId ? (
                            <Link
                              href={`/admin/orders/${u.orderId}`}
                              className="text-xs text-blue-600 hover:underline font-mono"
                            >
                              {u.orderId.slice(0, 8)}...
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          -{u.discountApplied.toFixed(2)} €
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {new Date(u.createdAt).toLocaleString("fr-FR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {usageTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => setUsagePage(Math.max(1, usagePage - 1))}
                    disabled={usagePage === 1}
                    className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Précédent
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {usagePage} sur {usageTotalPages}
                  </span>
                  <button
                    onClick={() => setUsagePage(Math.min(usageTotalPages, usagePage + 1))}
                    disabled={usagePage === usageTotalPages}
                    className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Suivant
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
