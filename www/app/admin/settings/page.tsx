"use client"

import { useEffect, useState } from "react"
import { Loader2, Eye, EyeOff, Check, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { getMaintenanceStatus, setMaintenanceMode } from "@/lib/admin-client"

export default function AdminSettingsPage() {
  const [apiKey, setApiKey] = useState("")
  const [maskedKey, setMaskedKey] = useState("")
  const [hasKey, setHasKey] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Maintenance state
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState("")
  const [maintenanceSaving, setMaintenanceSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/settings/openai-key")
        .then((r) => r.json())
        .then((data) => {
          setHasKey(data.hasKey)
          setMaskedKey(data.maskedKey || "")
        })
        .catch(() => {}),
      getMaintenanceStatus()
        .then((status) => {
          setMaintenanceEnabled(status.enabled)
          setMaintenanceMessage(status.message || "")
        })
        .catch(() => {
          toast.error("Impossible de charger le statut maintenance")
        }),
    ]).finally(() => setLoading(false))
  }, [])

  const handleToggleMaintenance = async () => {
    const newState = !maintenanceEnabled
    setMaintenanceSaving(true)
    try {
      const status = await setMaintenanceMode(newState, maintenanceMessage)
      setMaintenanceEnabled(status.enabled)
      toast.success(status.enabled ? "Mode maintenance active" : "Mode maintenance desactive")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setMaintenanceSaving(false)
    }
  }

  const handleSaveMaintenanceMessage = async () => {
    if (!maintenanceEnabled) return
    setMaintenanceSaving(true)
    try {
      await setMaintenanceMode(true, maintenanceMessage)
      toast.success("Message mis a jour")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setMaintenanceSaving(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings/openai-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setHasKey(data.hasKey)
      setMaskedKey(data.maskedKey || "")
      setApiKey("")
      setShowKey(false)
      toast.success("Cle API sauvegardee")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings/openai-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setHasKey(false)
      setMaskedKey("")
      setApiKey("")
      toast.success("Cle API supprimee")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setSaving(false)
    }
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
      <h1 className="text-2xl font-bold tracking-tight mb-1">Parametres</h1>
      <p className="text-sm text-muted-foreground mb-8">Configuration de la plateforme</p>

      <div className="max-w-lg space-y-8">
        {/* Maintenance Mode */}
        <div className={`rounded-2xl border p-6 ${maintenanceEnabled ? "border-orange-300 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-900/10" : ""}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className={maintenanceEnabled ? "text-orange-500" : "text-muted-foreground"} />
              <h2 className="font-semibold">Mode maintenance</h2>
            </div>
            <button
              onClick={handleToggleMaintenance}
              disabled={maintenanceSaving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                maintenanceEnabled ? "bg-orange-500" : "bg-muted"
              }`}
            >
              {maintenanceSaving ? (
                <Loader2 size={12} className="absolute left-1/2 -translate-x-1/2 animate-spin text-white" />
              ) : (
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    maintenanceEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              )}
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Quand active, les visiteurs voient une page de maintenance. Les admins gardent l&apos;acces.
          </p>

          {maintenanceEnabled && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-orange-100 px-4 py-2.5 dark:bg-orange-900/30">
                <AlertTriangle size={16} className="text-orange-600 dark:text-orange-400 shrink-0" />
                <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                  Le site est actuellement en maintenance
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  placeholder="Message personnalise (optionnel)"
                  className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-foreground/20"
                />
                <button
                  onClick={handleSaveMaintenanceMessage}
                  disabled={maintenanceSaving}
                  className="rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background disabled:opacity-50 shrink-0"
                >
                  {maintenanceSaving ? <Loader2 size={16} className="animate-spin" /> : "Sauver"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* OpenAI API Key */}
        <div className="rounded-2xl border p-6">
          <h2 className="font-semibold mb-1">Cle API OpenAI</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Necessaire pour la generation de menus et les suggestions IA. Obtenez une cle sur{" "}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">
              platform.openai.com
            </a>
          </p>

          {hasKey && (
            <div className="flex items-center gap-2 mb-4 rounded-lg bg-green-50 px-4 py-2.5 dark:bg-green-900/20">
              <Check size={16} className="text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Cle configuree : {maskedKey}
              </span>
              <button
                onClick={handleRemove}
                className="ml-auto text-xs text-red-500 hover:underline"
              >
                Supprimer
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasKey ? "Remplacer la cle..." : "sk-..."}
                className="w-full rounded-xl border bg-background px-4 py-3 pr-10 text-sm font-mono outline-none transition-all focus:ring-2 focus:ring-foreground/20"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className="rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
