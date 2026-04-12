"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  Loader2,
  Search,
  MoreHorizontal,
  Ban,
  CheckCircle,
  Trash2,
  Shield,
  ShieldOff,
  Mail,
  UserCog,
  X,
} from "lucide-react"
import { toast } from "sonner"
import {
  listAdminUsers,
  banUser,
  unbanUser,
  deleteAdminUser,
  verifyUserEmail,
  toggleUser2FA,
  updateAdminUser,
  type AdminUser,
} from "@/lib/admin-client"
import { cn } from "@/lib/utils"

const ROLES = [
  { value: "", label: "Tous" },
  { value: "admin", label: "Admin" },
  { value: "client", label: "Client" },
  { value: "livreur", label: "Livreur" },
]

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  livreur: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  client: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
}

const AVATAR_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  livreur: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  client: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "À l'instant"
  if (diffMins < 60) return `Il y a ${diffMins} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays < 30) return `Il y a ${diffDays}j`
  return new Date(dateStr).toLocaleDateString("fr-FR")
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [roleFilter, setRoleFilter] = useState("")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)
  const [banModalUser, setBanModalUser] = useState<AdminUser | null>(null)
  const [banReason, setBanReason] = useState("")
  const [roleModalUser, setRoleModalUser] = useState<AdminUser | null>(null)
  const [newRole, setNewRole] = useState("")
  const [deleteModalUser, setDeleteModalUser] = useState<AdminUser | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null)

  const menuRef = useRef<HTMLDivElement>(null)
  const pageSize = 20

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAdminUsers(page, pageSize, roleFilter)
      setUsers(data.users || [])
      setTotal(data.total || 0)
    } catch {
      toast.error("Erreur chargement utilisateurs")
    } finally {
      setLoading(false)
    }
  }, [page, roleFilter])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // Close action menu on click outside
  useEffect(() => {
    if (!actionMenuId) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActionMenuId(null)
        setMenuPosition(null)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") { setActionMenuId(null); setMenuPosition(null) }
    }
    function handleScroll() { setActionMenuId(null); setMenuPosition(null) }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    window.addEventListener("scroll", handleScroll, true)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
      window.removeEventListener("scroll", handleScroll, true)
    }
  }, [actionMenuId])

  const handleOpenMenu = (userId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (actionMenuId === userId) {
      setActionMenuId(null)
      setMenuPosition(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setActionMenuId(userId)
  }

  // Close modals on Escape
  useEffect(() => {
    const activeModal = banModalUser || roleModalUser || deleteModalUser
    if (!activeModal) return
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setBanModalUser(null)
        setRoleModalUser(null)
        setDeleteModalUser(null)
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [banModalUser, roleModalUser, deleteModalUser])

  const filteredUsers = debouncedSearch
    ? users.filter(
        (u) =>
          u.email.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          (u.name && u.name.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
          (u.phone && u.phone.includes(debouncedSearch))
      )
    : users

  const handleBan = async () => {
    if (!banModalUser) return
    try {
      await banUser(banModalUser.id, banReason)
      toast.success("Utilisateur banni")
      setBanModalUser(null)
      setBanReason("")
      loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  const handleUnban = async (user: AdminUser) => {
    try {
      await unbanUser(user.id)
      toast.success("Utilisateur débanni")
      loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  const handleDelete = async () => {
    if (!deleteModalUser) return
    try {
      await deleteAdminUser(deleteModalUser.id)
      toast.success("Utilisateur supprimé")
      setDeleteModalUser(null)
      loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  const handleVerifyEmail = async (user: AdminUser) => {
    try {
      await verifyUserEmail(user.id)
      toast.success("Email vérifié")
      loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  const handleToggle2FA = async (user: AdminUser) => {
    try {
      await toggleUser2FA(user.id, !user.twoFactorEnabled)
      toast.success(user.twoFactorEnabled ? "2FA désactivé" : "2FA activé")
      loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  const handleUpdateRole = async () => {
    if (!roleModalUser || !newRole) return
    try {
      await updateAdminUser(roleModalUser.id, { role: newRole })
      toast.success("Rôle mis à jour")
      setRoleModalUser(null)
      setNewRole("")
      loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  const totalPages = Math.ceil(total / pageSize)
  const startItem = (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, total)

  return (
    <div className="px-4 py-4 md:px-8 md:py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Utilisateurs</h1>
        <span className="rounded-full bg-foreground/10 px-3 py-0.5 text-sm font-medium tabular-nums">
          {total}
        </span>
      </div>

      {/* Filters row */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        {/* Role pill buttons */}
        <div className="flex gap-1">
          {ROLES.map((r) => (
            <button
              key={r.value}
              onClick={() => { setRoleFilter(r.value); setPage(1) }}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-medium transition-colors",
                roleFilter === r.value
                  ? "bg-foreground text-background"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
        {/* Desktop table (sm+) */}
        <div className="hidden sm:block rounded-2xl border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-foreground/[0.02] border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Utilisateur</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Téléphone</th>
                  <th className="text-left px-4 py-3 font-medium">Rôle</th>
                  <th className="text-left px-4 py-3 font-medium">Statut</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Dernière connexion</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      Aucun utilisateur trouvé
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-foreground/[0.03] transition-colors">
                      {/* Avatar + Name + Email */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                              AVATAR_COLORS[user.role] || AVATAR_COLORS.client
                            )}
                          >
                            {(user.name || user.email)[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{user.name || "—"}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {user.phone || "—"}
                      </td>

                      {/* Role badge */}
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          ROLE_COLORS[user.role] || ROLE_COLORS.client
                        )}>
                          {user.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {user.isBanned ? (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                            <Ban size={12} /> Banni
                          </span>
                        ) : user.emailVerified ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <CheckCircle size={12} /> Vérifié
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                            <Mail size={12} /> Non vérifié
                          </span>
                        )}
                      </td>

                      {/* Last login */}
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                        {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt) : "Jamais"}
                      </td>

                      {/* Actions menu */}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => handleOpenMenu(user.id, e)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile card list (< sm) */}
        <div className="sm:hidden rounded-2xl border divide-y">
          {filteredUsers.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Aucun utilisateur trouvé</p>
          ) : (
            filteredUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-3 px-4 py-3.5">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    AVATAR_COLORS[user.role] || AVATAR_COLORS.client
                  )}
                >
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{user.name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", ROLE_COLORS[user.role] || ROLE_COLORS.client)}>
                      {user.role}
                    </span>
                    {user.isBanned ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400"><Ban size={10} /> Banni</span>
                    ) : user.emailVerified ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400"><CheckCircle size={10} /> Vérifié</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-yellow-600 dark:text-yellow-400"><Mail size={10} /> Non vérifié</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => handleOpenMenu(user.id, e)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors shrink-0"
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
            ))
          )}
        </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-muted-foreground">
            Affichage {startItem}–{endItem} sur {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50 hover:bg-muted transition-colors"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50 hover:bg-muted transition-colors"
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* Global action dropdown — fixed position to escape overflow-x-auto clipping */}
      {actionMenuId && menuPosition && (() => {
        const u = users.find(x => x.id === actionMenuId)
        if (!u) return null
        return (
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: menuPosition.top, right: menuPosition.right, zIndex: 50 }}
            className="w-52 rounded-xl border bg-background shadow-lg animate-in fade-in slide-in-from-top-1 duration-150"
          >
            <div className="p-1">
              {!u.emailVerified && (
                <button onClick={() => { handleVerifyEmail(u); setActionMenuId(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors">
                  <Mail size={14} /> Vérifier email
                </button>
              )}
              <button onClick={() => { handleToggle2FA(u); setActionMenuId(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors">
                {u.twoFactorEnabled ? <ShieldOff size={14} /> : <Shield size={14} />}
                {u.twoFactorEnabled ? 'Désactiver 2FA' : 'Activer 2FA'}
              </button>
              <button onClick={() => { setRoleModalUser(u); setNewRole(u.role); setActionMenuId(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors">
                <UserCog size={14} /> Changer rôle
              </button>
              <div className="my-1 border-t" />
              {u.isBanned ? (
                <button onClick={() => { handleUnban(u); setActionMenuId(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                  <CheckCircle size={14} /> Débannir
                </button>
              ) : (
                <button onClick={() => { setBanModalUser(u); setActionMenuId(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">
                  <Ban size={14} /> Bannir
                </button>
              )}
              <button onClick={() => { setDeleteModalUser(u); setActionMenuId(null) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <Trash2 size={14} /> Supprimer
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── Ban Modal ── */}
      {banModalUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-150"
          onClick={() => { setBanModalUser(null); setBanReason("") }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Bannir {banModalUser.name || banModalUser.email}</h2>
              <button
                onClick={() => { setBanModalUser(null); setBanReason("") }}
                className="p-1 hover:bg-muted rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5">Raison du bannissement</label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Expliquez la raison..."
                className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
                rows={3}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setBanModalUser(null); setBanReason("") }}
                className="flex-1 rounded-full border py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleBan}
                className="flex-1 rounded-full bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                Bannir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Role Modal ── */}
      {roleModalUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-150"
          onClick={() => { setRoleModalUser(null); setNewRole("") }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Changer le rôle</h2>
              <button
                onClick={() => { setRoleModalUser(null); setNewRole("") }}
                className="p-1 hover:bg-muted rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{roleModalUser.name || roleModalUser.email}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5">Nouveau rôle</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
              >
                <option value="client">Client</option>
                <option value="livreur">Livreur</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setRoleModalUser(null); setNewRole("") }}
                className="flex-1 rounded-full border py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleUpdateRole}
                className="flex-1 rounded-full bg-foreground py-2.5 text-sm font-medium text-background transition-colors"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteModalUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-150"
          onClick={() => setDeleteModalUser(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-red-600">Supprimer l&apos;utilisateur</h2>
              <button
                onClick={() => setDeleteModalUser(null)}
                className="p-1 hover:bg-muted rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Êtes-vous sûr de vouloir supprimer définitivement <strong className="text-foreground">{deleteModalUser.name || deleteModalUser.email}</strong> ? Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModalUser(null)}
                className="flex-1 rounded-full border py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-full bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
