"use client"

import { useEffect, useState } from "react"
import { X, Loader2, MapPin, User, CheckCircle2, Truck, Check } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  listNearbyDrivers,
  listDrivers,
  assignDriverToOrder,
  type DriverDetails,
  type AdminOrder,
} from "@/lib/admin-client"

interface AssignDriverModalProps {
  order: AdminOrder
  onClose: () => void
  onAssigned: (driverId: string) => void
}

export function AssignDriverModal({ order, onClose, onAssigned }: AssignDriverModalProps) {
  const [drivers, setDrivers] = useState<DriverDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [sendNotification, setSendNotification] = useState(true)

  useEffect(() => {
    async function fetchDrivers() {
      setLoading(true)
      try {
        if (order.deliveryLat && order.deliveryLng) {
          const nearby = await listNearbyDrivers(order.deliveryLat, order.deliveryLng, 10)
          if (nearby.drivers && nearby.drivers.length > 0) {
            setDrivers(nearby.drivers)
            return
          }
        }
        const all = await listDrivers("available")
        setDrivers(all.drivers || [])
      } catch (err) {
        console.error("Failed to fetch drivers:", err)
        toast.error("Erreur de chargement des livreurs")
      } finally {
        setLoading(false)
      }
    }

    fetchDrivers()
  }, [order])

  const handleAssign = async (driver: DriverDetails) => {
    if (assignedIds.has(driver.id)) return
    setAssigning(driver.id)
    try {
      await assignDriverToOrder(order.id, driver.id, { sendNotification })
      toast.success(`${driver.name || driver.email} notifié`)
      setAssignedIds((prev) => new Set(prev).add(driver.id))
      onAssigned(driver.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'assignation")
    } finally {
      setAssigning(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-2xl bg-background p-6 shadow-xl mx-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold">Assigner des livreurs</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Commande #{order.id.slice(0, 8)}
              {assignedIds.size > 0 && (
                <span className="ml-2 text-green-600 dark:text-green-400 font-medium">
                  · {assignedIds.size} notifié{assignedIds.size > 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="rounded-xl border p-4 mb-4">
          <div className="flex items-start gap-2 text-sm">
            <MapPin size={14} className="mt-0.5 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">{order.deliveryAddress || "Adresse non disponible"}</span>
          </div>
          <div className="mt-2 text-sm font-semibold">{order.total.toFixed(2)} €</div>
        </div>

        {assignedIds.size > 0 && (
          <p className="text-xs text-muted-foreground mb-3 px-1">
            Le premier livreur à accepter prendra la commande. Les autres recevront une annulation automatique.
          </p>
        )}

        <label className="flex items-center gap-3 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={sendNotification}
            onChange={(e) => setSendNotification(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm">Envoyer une notification WhatsApp</span>
        </label>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : drivers.length === 0 ? (
          <div className="text-center py-8">
            <User size={40} className="mx-auto text-muted-foreground opacity-50" />
            <p className="mt-3 text-sm text-muted-foreground">Aucun livreur disponible</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {drivers.map((driver) => (
              <DriverRow
                key={driver.id}
                driver={driver}
                onAssign={() => handleAssign(driver)}
                assigning={assigning === driver.id}
                assigned={assignedIds.has(driver.id)}
              />
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-full border py-3 text-sm font-medium hover:bg-muted transition-colors"
        >
          {assignedIds.size > 0 ? "Fermer" : "Annuler"}
        </button>
      </div>
    </div>
  )
}

function DriverRow({
  driver,
  onAssign,
  assigning,
  assigned,
}: {
  driver: DriverDetails
  onAssign: () => void
  assigning: boolean
  assigned: boolean
}) {
  const status = driver.status?.status || "offline"
  const isAvailable = status === "available"
  const isOnDelivery = status === "on_delivery"

  return (
    <div className={cn(
      "flex items-center justify-between rounded-xl border p-4 transition-colors",
      assigned && "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
    )}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <User size={18} className="text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-sm">{driver.name || driver.email}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {isAvailable ? (
              <>
                <CheckCircle2 size={10} className="text-green-500" />
                Disponible
              </>
            ) : isOnDelivery ? (
              <>
                <Truck size={10} className="text-blue-500" />
                En livraison
              </>
            ) : (
              "Hors ligne"
            )}
            {driver.stats && (
              <span className="ml-2">· {driver.stats.deliveriesToday} aujourd'hui</span>
            )}
          </p>
        </div>
      </div>
      <button
        onClick={onAssign}
        disabled={assigning || assigned || !isAvailable}
        className={cn(
          "rounded-full px-4 py-2 text-xs font-semibold transition-colors min-w-[80px] flex items-center justify-center gap-1",
          assigned
            ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 cursor-default"
            : isAvailable
              ? "bg-foreground text-background hover:opacity-90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        {assigning ? (
          <Loader2 size={14} className="animate-spin" />
        ) : assigned ? (
          <><Check size={12} /> Notifié</>
        ) : (
          "Assigner"
        )}
      </button>
    </div>
  )
}

