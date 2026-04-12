"use client"

import { useState } from "react"
import { CheckCircle, XCircle, Send, Shield, ShieldCheck, Loader2, Copy, Check } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { changePassword } from "@/lib/account-client"
import { OtpVerifyForm } from "@/components/otp-verify-form"

export default function SecurityPage() {
  const { user, isLoading, refetch } = useAuth()
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [resending, setResending] = useState(false)
  const [showOtp, setShowOtp] = useState(false)

  // 2FA state
  const [tfaStep, setTfaStep] = useState<"idle" | "verify" | "backup" | "disable">("idle")
  const [tfaLoading, setTfaLoading] = useState(false)
  const [tfaQr, setTfaQr] = useState("")
  const [tfaSecret, setTfaSecret] = useState("")
  const [tfaCode, setTfaCode] = useState("")
  const [tfaBackupCodes, setTfaBackupCodes] = useState<string[]>([])
  const [tfaCopied, setTfaCopied] = useState(false)

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (!user) return null

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Les mots de passe ne correspondent pas" })
      return
    }

    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "Le mot de passe doit contenir au moins 8 caractères" })
      return
    }
    if (!/[A-Z]/.test(newPassword)) {
      setMessage({ type: "error", text: "Au moins une majuscule requise" })
      return
    }
    if (!/[0-9]/.test(newPassword)) {
      setMessage({ type: "error", text: "Au moins un chiffre requis" })
      return
    }

    setSaving(true)
    try {
      await changePassword(oldPassword, newPassword)
      setMessage({ type: "success", text: "Mot de passe modifié avec succès" })
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const handleSendAndShowOtp = async () => {
    setResending(true)
    try {
      await fetch("/api/auth/verify-email/send", { method: "POST" })
      setShowOtp(true)
    } catch {
      setMessage({ type: "error", text: "Erreur lors de l'envoi" })
    } finally {
      setResending(false)
    }
  }

  const is2FA = user.twoFactorEnabled ?? false

  const tfaAction = async (action: string, data?: Record<string, unknown>) => {
    const res = await fetch("/api/auth/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Erreur" }))
      throw new Error(err.message || "Erreur 2FA")
    }
    return res.json()
  }

  const handleTfaSetup = async () => {
    setTfaLoading(true)
    try {
      const data = await tfaAction("setup")
      setTfaQr(data.qrCode || data.qr_code || "")
      setTfaSecret(data.secret || "")
      setTfaStep("verify")
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message })
    } finally {
      setTfaLoading(false)
    }
  }

  const handleTfaVerify = async () => {
    if (tfaCode.length !== 6) return
    setTfaLoading(true)
    try {
      const data = await tfaAction("enable", { code: tfaCode })
      setTfaBackupCodes(data.backupCodes || data.backup_codes || [])
      setTfaStep("backup")
      await refetch()
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message })
    } finally {
      setTfaLoading(false)
    }
  }

  const handleTfaDisable = async () => {
    if (tfaCode.length !== 6) return
    setTfaLoading(true)
    try {
      await tfaAction("disable", { code: tfaCode })
      setTfaStep("idle")
      setTfaCode("")
      setMessage({ type: "success", text: "2FA désactivée" })
      await refetch()
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message })
    } finally {
      setTfaLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold">Sécurité</h2>

      {/* Email verification status */}
      <div className="mt-4 rounded-2xl border p-3 sm:mt-6 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {user.emailVerified ? (
              <CheckCircle size={18} className="text-green-600" />
            ) : (
              <XCircle size={18} className="text-amber-500" />
            )}
            <div>
              <p className="text-sm font-medium">Vérification email</p>
              <p className="text-xs text-muted-foreground">
                {user.emailVerified ? "Votre email est vérifié" : "Votre email n'est pas encore vérifié"}
              </p>
            </div>
          </div>
          {!user.emailVerified && !showOtp && (
            <button
              onClick={handleSendAndShowOtp}
              disabled={resending}
              className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Send size={12} />
              {resending ? "Envoi..." : "Vérifier"}
            </button>
          )}
        </div>

        {/* Inline OTP form */}
        {!user.emailVerified && showOtp && (
          <div className="mt-4 border-t pt-4">
            <OtpVerifyForm onVerified={() => setShowOtp(false)} />
          </div>
        )}
      </div>

      {/* Change password */}
      <form onSubmit={handleChangePassword} className="mt-6 space-y-4">
        <h3 className="text-sm font-semibold">Changer le mot de passe</h3>

        {message && (
          <div
            className={cn(
              "rounded-xl px-4 py-2.5 text-sm",
              message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            )}
          >
            {message.text}
          </div>
        )}

        <input
          type="password"
          placeholder="Mot de passe actuel"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          className="w-full rounded-xl border px-4 py-2.5 text-sm"
          required
        />
        <input
          type="password"
          placeholder="Nouveau mot de passe"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-xl border px-4 py-2.5 text-sm"
          required
        />
        <input
          type="password"
          placeholder="Confirmer le nouveau mot de passe"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-xl border px-4 py-2.5 text-sm"
          required
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          {saving ? "Modification..." : "Modifier le mot de passe"}
        </button>
      </form>

      {/* 2FA Section */}
      <div className="mt-8 border-t pt-6">
        <h3 className="text-sm font-semibold mb-4">Authentification à deux facteurs (2FA)</h3>

        {tfaStep === "idle" && (
          <div className="rounded-2xl border p-4">
            <div className="flex items-center gap-3 mb-3">
              {is2FA ? (
                <ShieldCheck size={18} className="text-green-500" />
              ) : (
                <Shield size={18} className="text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">{is2FA ? "2FA activée" : "2FA désactivée"}</p>
                <p className="text-xs text-muted-foreground">
                  {is2FA ? "Votre compte est protégé" : "Protégez votre compte avec une app d'authentification"}
                </p>
              </div>
            </div>
            {is2FA ? (
              <button
                onClick={() => { setTfaCode(""); setTfaStep("disable") }}
                disabled={tfaLoading}
                className="rounded-full border border-red-200 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                Désactiver
              </button>
            ) : (
              <button
                onClick={handleTfaSetup}
                disabled={tfaLoading}
                className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50"
              >
                {tfaLoading ? <Loader2 size={14} className="animate-spin" /> : "Activer la 2FA"}
              </button>
            )}
          </div>
        )}

        {tfaStep === "verify" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scannez le QR code avec votre app d&apos;authentification puis entrez le code.
            </p>
            {tfaQr && (
              <div className="flex justify-center">
                <div className="rounded-2xl border p-3 bg-white">
                  <Image src={tfaQr} alt="QR Code" width={180} height={180} unoptimized />
                </div>
              </div>
            )}
            {tfaSecret && (
              <div className="rounded-xl bg-muted/50 p-2 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Clé manuelle :</p>
                <code className="text-xs font-mono">{tfaSecret}</code>
              </div>
            )}
            <input
              type="text"
              value={tfaCode}
              onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-full rounded-xl border px-4 py-3 text-center text-lg font-mono tracking-widest"
            />
            <div className="flex gap-2">
              <button onClick={() => setTfaStep("idle")} className="flex-1 rounded-full border py-2.5 text-xs font-medium hover:bg-muted">
                Annuler
              </button>
              <button
                onClick={handleTfaVerify}
                disabled={tfaLoading || tfaCode.length !== 6}
                className="flex-1 rounded-full bg-foreground py-2.5 text-xs font-semibold text-background disabled:opacity-50"
              >
                {tfaLoading ? <Loader2 size={14} className="mx-auto animate-spin" /> : "Vérifier"}
              </button>
            </div>
          </div>
        )}

        {tfaStep === "backup" && (
          <div className="space-y-4">
            <div className="text-center">
              <ShieldCheck size={24} className="mx-auto text-green-500 mb-2" />
              <p className="text-sm font-bold">2FA activée !</p>
              <p className="text-xs text-muted-foreground">Sauvegardez ces codes de secours</p>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-2xl border p-4">
              {tfaBackupCodes.map((bc, i) => (
                <code key={i} className="rounded bg-muted px-2 py-1.5 text-center text-xs font-mono">{bc}</code>
              ))}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(tfaBackupCodes.join("\n"))
                setTfaCopied(true)
                setTimeout(() => setTfaCopied(false), 2000)
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full border py-2 text-xs font-medium hover:bg-muted"
            >
              {tfaCopied ? <Check size={12} /> : <Copy size={12} />}
              {tfaCopied ? "Copié !" : "Copier les codes"}
            </button>
            <button
              onClick={() => setTfaStep("idle")}
              className="w-full rounded-full bg-foreground py-2.5 text-xs font-semibold text-background"
            >
              Terminé
            </button>
          </div>
        )}

        {tfaStep === "disable" && (
          <div className="space-y-4">
            <div className="text-center">
              <Shield size={24} className="mx-auto text-red-500 mb-2" />
              <p className="text-sm font-bold">Désactiver la 2FA</p>
              <p className="text-xs text-muted-foreground">
                Entrez un code de votre app d&apos;authentification pour confirmer
              </p>
            </div>
            <input
              type="text"
              value={tfaCode}
              onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-full rounded-xl border px-4 py-3 text-center text-lg font-mono tracking-widest"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setTfaStep("idle"); setTfaCode("") }}
                className="flex-1 rounded-full border py-2.5 text-xs font-medium hover:bg-muted"
              >
                Annuler
              </button>
              <button
                onClick={handleTfaDisable}
                disabled={tfaLoading || tfaCode.length !== 6}
                className="flex-1 rounded-full bg-red-600 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {tfaLoading ? <Loader2 size={14} className="mx-auto animate-spin" /> : "Confirmer"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
