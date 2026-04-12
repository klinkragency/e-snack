"use client"

import { useCallback, useEffect, useState } from "react"
import { MapPin, Plus, Star, Trash2 } from "lucide-react"
import { useAppStore } from "@/lib/store"
import { listAddresses, createAddress, deleteAddress, setDefaultAddress } from "@/lib/account-client"
import type { DeliveryAddress } from "@/lib/auth-types"

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState("")
  const [address, setAddress] = useState("")
  const [saving, setSaving] = useState(false)
  const setStoreAddress = useAppStore((s) => s.setAddress)

  const fetchAddresses = useCallback(async () => {
    try {
      const list = await listAddresses()
      setAddresses(list)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAddresses()
  }, [fetchAddresses])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim() || !address.trim()) return
    setSaving(true)
    try {
      await createAddress({ label: label.trim(), address: address.trim(), isDefault: addresses.length === 0 })
      setLabel("")
      setAddress("")
      setShowForm(false)
      fetchAddresses()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAddress(id)
      setAddresses((prev) => prev.filter((a) => a.id !== id))
    } catch {
      // ignore
    }
  }

  const handleSetDefault = async (addr: DeliveryAddress) => {
    try {
      await setDefaultAddress(addr.id)
      setStoreAddress(addr.address)
      fetchAddresses()
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Mes adresses</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
        >
          <Plus size={14} />
          Ajouter
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3 rounded-2xl border p-4">
          <input
            type="text"
            placeholder="Label (ex: Maison, Bureau...)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-xl border px-4 py-2.5 text-sm"
          />
          <input
            type="text"
            placeholder="Adresse complète"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-xl border px-4 py-2.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-full border px-4 py-2 text-sm font-medium"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Address list */}
      <div className="mt-6 space-y-2">
        {addresses.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucune adresse enregistrée
          </p>
        ) : (
          addresses.map((addr) => (
            <div
              key={addr.id}
              className="flex items-center justify-between gap-2 rounded-2xl border px-3 py-3 sm:px-4 sm:py-3.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <MapPin size={16} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{addr.label}</span>
                    {addr.isDefault && (
                      <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-medium">
                        Par défaut
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{addr.address}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {!addr.isDefault && (
                  <button
                    onClick={() => handleSetDefault(addr)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                    title="Définir par défaut"
                  >
                    <Star size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(addr.id)}
                  className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
