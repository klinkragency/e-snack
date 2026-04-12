"use client"

import { useState } from "react"
import { Mail, Phone, Shield, CalendarDays, CheckCircle, XCircle, Pencil, Check, X } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useAppStore } from "@/lib/store"
import { updateProfile } from "@/lib/account-client"

export default function ProfilePage() {
  const { user, isLoading } = useAuth()
  const setUser = useAppStore((s) => s.setUser)
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneValue, setPhoneValue] = useState("")
  const [saving, setSaving] = useState(false)

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (!user) return null

  const handleEditPhone = () => {
    setPhoneValue(user.phone || "")
    setEditingPhone(true)
  }

  const handleSavePhone = async () => {
    setSaving(true)
    try {
      const updated = await updateProfile({ phone: phoneValue })
      setUser(updated)
      setEditingPhone(false)
    } catch {
      // Keep editing state on error
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Avatar + email */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-full bg-foreground text-xl sm:text-2xl font-bold text-background">
          {user.email[0].toUpperCase()}
        </div>
        <div>
          <h2 className="text-lg font-semibold">{user.name || user.email}</h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      {/* Info cards */}
      <div className="mt-6 space-y-1 md:mt-8">
        {/* Email */}
        <div className="flex flex-col gap-1 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between hover:bg-muted">
          <div className="flex items-center gap-3">
            <Mail size={16} className="shrink-0 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Email</span>
          </div>
          <div className="flex items-center gap-2 pl-7 sm:pl-0">
            <span className="truncate text-sm font-medium">{user.email}</span>
            {user.emailVerified ? (
              <CheckCircle size={14} className="shrink-0 text-green-600" />
            ) : (
              <XCircle size={14} className="shrink-0 text-amber-500" />
            )}
          </div>
        </div>

        {/* Phone (inline edit) */}
        <div className="flex flex-col gap-1 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between hover:bg-muted">
          <div className="flex items-center gap-3">
            <Phone size={16} className="shrink-0 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Téléphone</span>
          </div>
          {editingPhone ? (
            <div className="flex items-center gap-2 pl-7 sm:pl-0">
              <input
                type="tel"
                value={phoneValue}
                onChange={(e) => setPhoneValue(e.target.value)}
                className="w-full max-w-[200px] rounded-lg border px-2 py-1 text-sm"
                autoFocus
              />
              <button
                onClick={handleSavePhone}
                disabled={saving}
                className="rounded-md p-1 text-green-600 hover:bg-green-50"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => setEditingPhone(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pl-7 sm:pl-0">
              <span className="text-sm font-medium">
                {user.phone || "Non renseigné"}
              </span>
              <button
                onClick={handleEditPhone}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Role */}
        <div className="flex flex-col gap-1 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between hover:bg-muted">
          <div className="flex items-center gap-3">
            <Shield size={16} className="shrink-0 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Rôle</span>
          </div>
          <span className="pl-7 text-sm font-medium capitalize sm:pl-0">{user.role}</span>
        </div>

        {/* Member since */}
        <div className="flex flex-col gap-1 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between hover:bg-muted">
          <div className="flex items-center gap-3">
            <CalendarDays size={16} className="shrink-0 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Membre depuis</span>
          </div>
          <span className="pl-7 text-sm font-medium sm:pl-0">
            {new Date(user.createdAt).toLocaleDateString("fr-FR", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
      </div>
    </div>
  )
}
